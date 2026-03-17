/**
 * customer.ts — customer-facing API routes.
 *
 * TWO GROUPS OF ROUTES:
 *
 * 1. Auth (no JWT required):
 *    POST /api/customer/auth/magic-link   — send login link to email
 *    POST /api/customer/auth/verify       — verify token, return session JWT
 *
 * 2. Portal (JWT required via requireAuth middleware):
 *    GET  /api/customer/me                — get profile
 *    GET  /api/customer/subscriptions     — list my subscriptions
 *    POST /api/customer/subscriptions/:id/pause
 *    POST /api/customer/subscriptions/:id/resume
 *    POST /api/customer/subscriptions/:id/cancel
 *    POST /api/customer/subscriptions/:id/skip
 *
 * MAGIC LINK FLOW:
 *   1. Customer enters email
 *   2. Server finds customer in DB, generates a short-lived JWT (15 min)
 *   3. Server emails the link: https://portal.com/auth/verify?token=JWT
 *   4. Customer clicks link, portal POSTs token to /verify
 *   5. Server validates token, returns a 7-day session JWT
 *   6. Portal stores session JWT, customer is logged in
 */

import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../db.js";
import config from "../config.js";
import requireAuth from "../middleware/requireAuth.js";
import { sendMagicLink as sendMagicLinkEmail } from "../services/emailService.js";
import {
  getCustomerSubscriptions,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  skipNextDelivery,
} from "../services/subscriptionService.js";

const router = Router();

// ── Types ──────────────────────────────────────────────────────────────────

interface MagicLinkPayload {
  type: "magic-link";
  email: string;
  customerId: string;
  shopId: string;
  iat?: number;
  exp?: number;
}

interface SessionPayload {
  type: "session";
  email: string;
  customerId: string;
  shopId: string;
}

// ── POST /api/customer/auth/magic-link ────────────────────────────────────

router.post(
  "/auth/magic-link",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, shopId } = req.body as { email?: string; shopId?: string };

      if (!email?.trim()) {
        res.status(400).json({ error: "email is required" });
        return;
      }

      if (!shopId) {
        res.status(400).json({ error: "shopId is required" });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }

      // Find or create the customer
      const shop = await prisma.shop.findUnique({ where: { id: shopId } });
      if (!shop) {
        res.status(404).json({ error: "Shop not found" });
        return;
      }

      let customer = await prisma.customer.findFirst({
        where: { shopId, email: email.toLowerCase().trim() },
      });

      if (!customer) {
        // Customer doesn't exist yet — create a record so we have an ID for the JWT
        customer = await prisma.customer.create({
          data: {
            shopId,
            email: email.toLowerCase().trim(),
          },
        });
      }

      // Generate a short-lived magic-link token (15 minutes)
      const magicToken = jwt.sign(
        {
          type: "magic-link",
          email: customer.email,
          customerId: customer.id,
          shopId,
        } satisfies Omit<MagicLinkPayload, "iat" | "exp">,
        config.jwt.secret,
        { expiresIn: "15m" },
      );

      const magicLink = `${config.portalUrl}/auth/verify?token=${magicToken}`;

      // Send the magic link email
      await sendMagicLinkEmail({
        to: customer.email,
        magicLink: `${magicLink}`,
        shopName: shop.name ?? undefined,
      });

      console.log(`[magic-link] sent to ${customer.email}`);

      res.json({
        message: "Magic link sent — check your email",
        // DEV ONLY — remove before production:
        _devMagicLink: config.isDev ? magicLink : undefined,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/customer/auth/verify ────────────────────────────────────────

router.post(
  "/auth/verify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body as { token?: string };

      if (!token) {
        res.status(400).json({ error: "token is required" });
        return;
      }

      // Verify and decode the magic-link token
      let decoded: MagicLinkPayload;
      try {
        decoded = jwt.verify(token, config.jwt.secret) as MagicLinkPayload;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          res
            .status(401)
            .json({ error: "Link expired. Please request a new one." });
        } else {
          res
            .status(401)
            .json({ error: "Invalid link. Please request a new one." });
        }
        return;
      }

      if (decoded.type !== "magic-link") {
        res.status(401).json({ error: "Invalid token type" });
        return;
      }

      // Make sure the customer still exists
      const customer = await prisma.customer.findUnique({
        where: { id: decoded.customerId },
      });

      if (!customer) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }

      // Issue a long-lived session JWT
      const sessionToken = jwt.sign(
        {
          type: "session",
          email: customer.email,
          customerId: customer.id,
          shopId: decoded.shopId,
        } satisfies SessionPayload,
        config.jwt.secret,
        { expiresIn: config.jwt.expiry } as jwt.SignOptions,
      );

      res.json({
        sessionToken,
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/customer/me ──────────────────────────────────────────────────

router.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.customer!.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
        },
      });

      if (!customer) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }

      res.json({ customer });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/customer/subscriptions ───────────────────────────────────────

router.get(
  "/subscriptions",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscriptions = await getCustomerSubscriptions(req.customer!.id);
      res.json({ subscriptions });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/customer/subscriptions/:id/pause ────────────────────────────

router.post(
  "/subscriptions/:id/pause",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resumeDate } = req.body as { resumeDate?: string };

      // Customers can only touch their own subscriptions — we verify ownership
      // by looking up the subscription and checking customerId matches
      const sub = await prisma.subscription.findFirst({
        where: { id: req.params.id, customerId: req.customer!.id },
      });

      if (!sub) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      const updated = await pauseSubscription(
        sub.shopId,
        req.params.id,
        resumeDate ? new Date(resumeDate) : null,
      );

      res.json({ subscription: updated, message: "Subscription paused" });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/customer/subscriptions/:id/resume ───────────────────────────

router.post(
  "/subscriptions/:id/resume",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await prisma.subscription.findFirst({
        where: { id: req.params.id, customerId: req.customer!.id },
      });

      if (!sub) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      const updated = await resumeSubscription(sub.shopId, req.params.id);
      res.json({ subscription: updated, message: "Subscription resumed" });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/customer/subscriptions/:id/cancel ───────────────────────────

router.post(
  "/subscriptions/:id/cancel",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body as { reason?: string };

      const sub = await prisma.subscription.findFirst({
        where: { id: req.params.id, customerId: req.customer!.id },
      });

      if (!sub) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      const updated = await cancelSubscription(
        sub.shopId,
        req.params.id,
        reason ?? null,
      );
      res.json({ subscription: updated, message: "Subscription cancelled" });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/customer/subscriptions/:id/skip ─────────────────────────────

router.post(
  "/subscriptions/:id/skip",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await prisma.subscription.findFirst({
        where: { id: req.params.id, customerId: req.customer!.id },
      });

      if (!sub) {
        res.status(404).json({ error: "Subscription not found" });
        return;
      }

      const updated = await skipNextDelivery(sub.shopId, req.params.id);
      res.json({ subscription: updated, message: "Next delivery skipped" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
