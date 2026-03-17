/**
 * verifyHmac.ts — webhook signature verification middleware.
 *
 * TypeScript note: Express middleware functions have the signature:
 *   (req: Request, res: Response, next: NextFunction) => void
 *
 * We import those types from 'express' so TypeScript verifies we're
 * using req/res/next correctly.
 */

import crypto                              from 'crypto';
import { Request, Response, NextFunction } from 'express';
import config                              from '../config.js';

// ── Raw body capture ───────────────────────────────────────────────────────

export function captureRawBody(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => chunks.push(chunk));

  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);

    try {
      req.body = JSON.parse(req.rawBody.toString('utf8')) as unknown;
    } catch {
      req.body = {};
    }

    next();
  });

  req.on('error', next);
}

// ── Shopify HMAC ───────────────────────────────────────────────────────────

export function verifyShopifyWebhook(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const signature = req.headers['x-shopify-hmac-sha256'];

  if (typeof signature !== 'string') {
    res.status(401).json({ error: 'Missing Shopify HMAC header' });
    return;
  }

  if (!req.rawBody) {
    res.status(400).json({ error: 'rawBody not captured — check middleware order' });
    return;
  }

  const expected = crypto
    .createHmac('sha256', config.shopify.apiSecret)
    .update(req.rawBody)
    .digest('base64');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );

  if (!isValid) {
    console.warn('[webhook] Shopify HMAC mismatch');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  next();
}

// ── Stripe HMAC ────────────────────────────────────────────────────────────

export function verifyStripeWebhook(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const sigHeader = req.headers['stripe-signature'];

  if (typeof sigHeader !== 'string') {
    res.status(401).json({ error: 'Missing Stripe-Signature header' });
    return;
  }

  if (!config.stripe.webhookSecret) {
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET not set — skipping in dev');
    next();
    return;
  }

  const parts    = sigHeader.split(',');
  const tPart    = parts.find((p) => p.startsWith('t='));
  const v1Hashes = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));

  if (!tPart || v1Hashes.length === 0) {
    res.status(401).json({ error: 'Malformed Stripe-Signature header' });
    return;
  }

  const timestamp  = tPart.slice(2);
  const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);

  if (ageSeconds > 300) {
    res.status(401).json({ error: 'Stripe webhook timestamp too old' });
    return;
  }

  const payload  = `${timestamp}.${req.rawBody?.toString('utf8') ?? ''}`;
  const expected = crypto
    .createHmac('sha256', config.stripe.webhookSecret)
    .update(payload)
    .digest('hex');

  const isValid = v1Hashes.some((hash) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
    } catch {
      return false;
    }
  });

  if (!isValid) {
    console.warn('[webhook] Stripe HMAC mismatch');
    res.status(401).json({ error: 'Invalid Stripe webhook signature' });
    return;
  }

  next();
}