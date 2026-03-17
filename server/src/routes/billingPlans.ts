/**
 * billingPlans.ts — HTTP routes for billing plan management.
 *
 * TypeScript note: Request<Params, ResBody, ReqBody, Query> lets you
 * type the shape of route params, response, body, and query string.
 * We keep it simple here and just type what we actually use.
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createBillingPlan,
  getBillingPlans,
  getBillingPlan,
  updateBillingPlan,
  deactivateBillingPlan,
  calculatePrice,
} from '../services/billingPlanService.js';
import type { CreateBillingPlanInput } from '../types/index.js';

const router = Router();

function getShopId(req: Request): string {
  const shopId = (req.query.shopId as string | undefined) ?? req.body?.shopId as string | undefined;
  if (!shopId) throw Object.assign(new Error('shopId is required'), { status: 400 });
  return shopId;
}

function requireObjectBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  throw Object.assign(new Error('Request body must be a JSON object'), { status: 400 });
}

// ── GET /api/billing-plans/public ─────────────────────────────────────────
router.get('/public', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shopId = getShopId(req);
    const plans  = await getBillingPlans(shopId, { activeOnly: true });
    res.json({ plans });
  } catch (err) { next(err); }
});

// ── GET /api/billing-plans ────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await getBillingPlans(getShopId(req));
    res.json({ plans });
  } catch (err) { next(err); }
});

// ── POST /api/billing-plans ───────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = requireObjectBody(req.body) as unknown as CreateBillingPlanInput;
    const plan = await createBillingPlan(getShopId(req), body);
    res.status(201).json({ plan });
  } catch (err) { next(err); }
});

// ── GET /api/billing-plans/:id ────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await getBillingPlan(getShopId(req), req.params.id);
    res.json({ plan });
  } catch (err) { next(err); }
});

// ── PATCH /api/billing-plans/:id ──────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await updateBillingPlan(getShopId(req), req.params.id, req.body as object);
    res.json({ plan });
  } catch (err) { next(err); }
});

// ── DELETE /api/billing-plans/:id ─────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plan = await deactivateBillingPlan(getShopId(req), req.params.id);
    res.json({ plan, message: 'Billing plan deactivated' });
  } catch (err) { next(err); }
});

// ── POST /api/billing-plans/calculate-price ───────────────────────────────
router.post('/calculate-price', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shopId, planId, subtotal } = req.body as {
      shopId?: string; planId?: string; subtotal?: number;
    };

    if (!shopId || !planId || subtotal === undefined) {
      res.status(400).json({ error: 'shopId, planId, and subtotal are required' });
      return;
    }

    const plan   = await getBillingPlan(shopId, planId);
    const result = calculatePrice(Number(subtotal), plan);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;