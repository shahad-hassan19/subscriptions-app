import { Router, Request, Response, NextFunction } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import {
  createSubscription,
  getSubscription,
  listSubscriptions,
  getCustomerSubscriptions,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  skipNextDelivery,
  updateSubscriptionProducts,
} from '../services/subscriptionService.js';
import type { CreateSubscriptionInput, SubscriptionProduct } from '../types/index.js';

const router = Router();

function getShopId(req: Request): string {
  const id = (req.query.shopId as string | undefined) ?? (req.body?.shopId as string | undefined);
  if (!id) throw Object.assign(new Error('shopId is required'), { status: 400 });
  return id;
}

function requireObjectBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  throw Object.assign(new Error('Request body must be a JSON object'), { status: 400 });
}

// ── Customer portal: my subscriptions ────────────────────────────────────
router.get('/my', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subs = await getCustomerSubscriptions(req.customer!.id);
    res.json({ subscriptions: subs });
  } catch (err) { next(err); }
});

// ── List (admin) ──────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, customerId, page, limit } = req.query as Record<string, string | undefined>;
    const result = await listSubscriptions(getShopId(req), {
      status,
      customerId,
      page:  page  ? parseInt(page, 10)  : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ── Get single ────────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await getSubscription(getShopId(req), req.params.id);
    res.json({ subscription: sub });
  } catch (err) { next(err); }
});

// ── Create ────────────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObjectBody(req.body) as unknown as CreateSubscriptionInput;
    const sub = await createSubscription(getShopId(req), body);
    res.status(201).json({ subscription: sub });
  } catch (err) { next(err); }
});

// ── Pause ─────────────────────────────────────────────────────────────────
router.post('/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resumeDate } = req.body as { resumeDate?: string };
    const sub = await pauseSubscription(
      getShopId(req),
      req.params.id,
      resumeDate ? new Date(resumeDate) : null
    );
    res.json({ subscription: sub, message: 'Subscription paused' });
  } catch (err) { next(err); }
});

// ── Resume ────────────────────────────────────────────────────────────────
router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await resumeSubscription(getShopId(req), req.params.id);
    res.json({ subscription: sub, message: 'Subscription resumed' });
  } catch (err) { next(err); }
});

// ── Cancel ────────────────────────────────────────────────────────────────
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body as { reason?: string };
    const sub = await cancelSubscription(getShopId(req), req.params.id, reason ?? null);
    res.json({ subscription: sub, message: 'Subscription cancelled' });
  } catch (err) { next(err); }
});

// ── Skip ──────────────────────────────────────────────────────────────────
router.post('/:id/skip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await skipNextDelivery(getShopId(req), req.params.id);
    res.json({ subscription: sub, message: 'Next delivery skipped' });
  } catch (err) { next(err); }
});

// ── Update products ───────────────────────────────────────────────────────
router.patch('/:id/products', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { products } = req.body as { products?: SubscriptionProduct[] };
    if (!products) { res.status(400).json({ error: 'products array is required' }); return; }
    const sub = await updateSubscriptionProducts(getShopId(req), req.params.id, products);
    res.json({ subscription: sub, message: 'Products updated' });
  } catch (err) { next(err); }
});

export default router;