import { Router, Request, Response, NextFunction } from 'express';
import {
  processDueSubscriptions,
  refundBilling,
  getBillingHistory,
} from '../services/billingService.js';

const router = Router();

// ── POST /api/billing/process-due ─────────────────────────────────────────
router.post('/process-due', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      const secret = req.headers['x-cron-secret'];
      if (!secret || secret !== process.env.CRON_SECRET) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }
    const results = await processDueSubscriptions();
    res.json({ message: 'Billing run complete', ...results });
  } catch (err) { next(err); }
});

// ── GET /api/billing/:subscriptionId ──────────────────────────────────────
router.get('/:subscriptionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query as Record<string, string | undefined>;
    const result = await getBillingHistory(req.params.subscriptionId, {
      page:  page  ? parseInt(page, 10)  : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ── POST /api/billing/:billingId/refund ───────────────────────────────────
router.post('/:billingId/refund', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body as { amount?: number };
    const billing = await refundBilling(req.params.billingId, amount ?? null);
    res.json({ billing, message: 'Refund processed' });
  } catch (err) { next(err); }
});

export default router;