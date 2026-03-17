import { Router, Request, Response } from 'express';
import crypto  from 'crypto';
import config  from '../config.js';
import prisma  from '../db.js';

const router = Router();

function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

function verifyOAuthHmac(query: Record<string, string | string[] | undefined>): boolean {
  const { hmac, signature: _sig, ...rest } = query;
  if (!hmac) return false;

  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${Array.isArray(rest[k]) ? (rest[k] as string[]).join(',') : rest[k]}`)
    .join('&');

  const expected = crypto
    .createHmac('sha256', config.shopify.apiSecret)
    .update(message)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(typeof hmac === 'string' ? hmac : hmac[0])
    );
  } catch { return false; }
}

// Nonce store
const pendingNonces = new Map<string, { shop: string; expiresAt: number }>();

function saveNonce(state: string, shop: string): void {
  const now = Date.now();
  for (const [k, v] of pendingNonces) {
    if (v.expiresAt < now) pendingNonces.delete(k);
  }
  pendingNonces.set(state, { shop, expiresAt: now + 10 * 60 * 1000 });
}

function consumeNonce(state: string): { shop: string } | null {
  const entry = pendingNonces.get(state);
  if (!entry) return null;
  pendingNonces.delete(state);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

// ── GET /auth/shopify ──────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const shop = req.query.shop as string | undefined;

  if (!shop)                   { res.status(400).send('Missing parameter: shop'); return; }
  if (!isValidShopDomain(shop)) { res.status(400).send('Invalid shop domain');    return; }

  const state       = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${config.appUrl}/auth/shopify/callback`;

  saveNonce(state, shop);

  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set('client_id',    config.shopify.apiKey);
  url.searchParams.set('scope',        config.shopify.scopes.join(','));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state',        state);

  res.redirect(url.toString());
});

// ── GET /auth/shopify/callback ─────────────────────────────────────────────
router.get('/callback', async (req: Request, res: Response) => {
  const { shop, code, state } = req.query as Record<string, string | undefined>;

  if (!verifyOAuthHmac(req.query as Record<string, string>)) {
    res.status(401).send('HMAC verification failed');
    return;
  }

  if (!shop || !isValidShopDomain(shop)) {
    res.status(400).send('Invalid shop domain');
    return;
  }

  const nonce = state ? consumeNonce(state) : null;
  if (!nonce || nonce.shop !== shop) {
    res.status(403).send('State mismatch');
    return;
  }

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ client_id: config.shopify.apiKey, client_secret: config.shopify.apiSecret, code }),
    });

    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.statusText}`);

    const { access_token: accessToken, scope } = await tokenRes.json() as {
      access_token: string;
      scope:        string;
    };

    // Fetch shop info
    const shopRes = await fetch(
      `https://${shop}/admin/api/${config.shopify.apiVersion}/shop.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );

    let shopName:  string | null = null;
    let shopEmail: string | null = null;

    if (shopRes.ok) {
      const { shop: sd } = await shopRes.json() as { shop: { name: string; email: string } };
      shopName  = sd.name;
      shopEmail = sd.email;
    }

    await prisma.shop.upsert({
      where:  { domain: shop },
      update: { accessToken, scope, name: shopName, email: shopEmail },
      create: { domain: shop, accessToken, scope, name: shopName, email: shopEmail },
    });

    registerWebhooks(shop, accessToken).catch((err: Error) =>
      console.error('[oauth] webhook registration error:', err.message)
    );

    res.redirect(`https://${shop}/admin/apps/${config.shopify.apiKey}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).send(`Installation failed: ${msg}`);
  }
});

async function registerWebhooks(shop: string, accessToken: string): Promise<void> {
  const topics = [
    'orders/create', 'orders/updated',
    'customers/create', 'customers/update', 'customers/delete',
    'app/uninstalled',
  ];

  for (const topic of topics) {
    try {
      await fetch(
        `https://${shop}/admin/api/${config.shopify.apiVersion}/webhooks.json`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
          body:    JSON.stringify({
            webhook: { topic, address: `${config.appUrl}/api/webhooks/shopify`, format: 'json' },
          }),
        }
      );
      console.log(`[oauth] registered webhook: ${topic}`);
    } catch (err) {
      console.warn(`[oauth] failed to register ${topic}:`, err instanceof Error ? err.message : err);
    }
  }
}

export default router;