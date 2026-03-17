import { Router, Request, Response } from 'express';
import { captureRawBody, verifyShopifyWebhook, verifyStripeWebhook } from '../middleware/verifyHmac.js';
import prisma from '../db.js';

const router = Router();

// ── Shopify ────────────────────────────────────────────────────────────────
router.post('/shopify', captureRawBody, verifyShopifyWebhook, async (req: Request, res: Response) => {
  res.status(200).json({ received: true });

  const topic      = req.headers['x-shopify-topic'] as string;
  const shopDomain = req.headers['x-shopify-shop-domain'] as string;

  handleShopifyEvent(topic, shopDomain, req.body as Record<string, unknown>).catch((err: Error) =>
    console.error(`[webhook] ${topic}:`, err.message)
  );
});

// ── Stripe ─────────────────────────────────────────────────────────────────
router.post('/stripe', captureRawBody, verifyStripeWebhook, async (req: Request, res: Response) => {
  res.status(200).json({ received: true });

  const event = req.body as { type: string; data: { object: Record<string, unknown> } };
  handleStripeEvent(event).catch((err: Error) =>
    console.error(`[webhook] stripe ${event.type}:`, err.message)
  );
});

// ── Shopify handlers ───────────────────────────────────────────────────────

async function handleShopifyEvent(
  topic:      string,
  shopDomain: string,
  payload:    Record<string, unknown>
): Promise<void> {
  switch (topic) {
    case 'customers/create':
    case 'customers/update':
      await syncCustomer(shopDomain, payload);
      break;
    case 'customers/delete':
      await handleCustomerDelete(payload);
      break;
    case 'app/uninstalled':
      await prisma.shop.update({ where: { domain: shopDomain }, data: { accessToken: '' } });
      console.log(`[webhook] app uninstalled from ${shopDomain}`);
      break;
    default:
      console.log(`[webhook] unhandled: ${topic}`);
  }
}

async function syncCustomer(shopDomain: string, c: Record<string, unknown>): Promise<void> {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return;

  await prisma.customer.upsert({
    where:  { shopId_email: { shopId: shop.id, email: c.email as string } },
    update: {
      shopifyCustomerId: String(c.id),
      firstName:         (c.first_name as string | null) ?? null,
      lastName:          (c.last_name  as string | null) ?? null,
      phone:             (c.phone      as string | null) ?? null,
    },
    create: {
      shopId:            shop.id,
      shopifyCustomerId: String(c.id),
      email:             c.email as string,
      firstName:         (c.first_name as string | null) ?? null,
      lastName:          (c.last_name  as string | null) ?? null,
      phone:             (c.phone      as string | null) ?? null,
    },
  });
}

async function handleCustomerDelete(c: Record<string, unknown>): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { shopifyCustomerId: String(c.id) },
  });
  if (!customer) return;

  await prisma.subscription.updateMany({
    where: { customerId: customer.id, status: 'ACTIVE' },
    data:  { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'customer_deleted' },
  });
}

// ── Stripe handlers ────────────────────────────────────────────────────────

async function handleStripeEvent(event: {
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<void> {
  const obj = event.data.object;

  switch (event.type) {
    case 'payment_intent.succeeded':
      await prisma.billing.updateMany({
        where: { stripePaymentIntentId: obj.id as string },
        data:  { status: 'SUCCEEDED', succeededAt: new Date() },
      });
      break;

    case 'payment_intent.payment_failed': {
      const billing = await prisma.billing.findFirst({
        where: { stripePaymentIntentId: obj.id as string },
      });
      if (billing) {
        await prisma.billing.update({
          where: { id: billing.id },
          data:  { status: 'FAILED', failureReason: 'payment_failed' },
        });
      }
      break;
    }

    case 'charge.refunded':
      await prisma.billing.updateMany({
        where: { stripePaymentIntentId: obj.payment_intent as string },
        data:  { status: 'REFUNDED', refundedAt: new Date() },
      });
      break;

    default:
      console.log(`[webhook] unhandled stripe event: ${event.type}`);
  }
}

export default router;