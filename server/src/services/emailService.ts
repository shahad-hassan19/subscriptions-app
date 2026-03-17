/**
 * emailService.ts — sends transactional emails via Resend.
 *
 * WHY RESEND:
 * - Simple REST API, no SMTP config
 * - Free tier: 3,000 emails/month
 * - Great deliverability out of the box
 *
 * TO SWITCH TO POSTMARK OR NODEMAILER:
 * Only change this file. The routes call sendMagicLink() and
 * sendSubscriptionCancelled() — those signatures stay the same.
 *
 * SETUP:
 * 1. npm install resend
 * 2. Add RESEND_API_KEY and EMAIL_FROM to .env
 * 3. Verify your sending domain in Resend dashboard (or use onboarding@resend.dev for testing)
 */

import { Resend } from "resend";
import config from "../config.js";

// ── Init ───────────────────────────────────────────────────────────────────

// Resend client — null if key not configured (skips sending in dev)
const resend = config.email.resendApiKey
  ? new Resend(config.email.resendApiKey)
  : null;

// ── Types ──────────────────────────────────────────────────────────────────

interface MagicLinkEmailOptions {
  to: string;
  magicLink: string;
  shopName?: string;
}

interface SubscriptionEventEmailOptions {
  to: string;
  shopName?: string;
  planName: string;
  nextDate?: string; // ISO date string
  amount?: number;
  reason?: string;
}

// ── Send magic link ────────────────────────────────────────────────────────

export async function sendMagicLink(
  opts: MagicLinkEmailOptions,
): Promise<void> {
  const { to, magicLink, shopName = "Your Store" } = opts;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width" />
    </head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
              <tr>
                <td>
                  <h1 style="margin:0 0 8px;font-size:20px;color:#111;font-weight:600;">
                    Log in to ${shopName}
                  </h1>
                  <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                    Click the button below to log in to your subscription portal.
                    This link expires in <strong>15 minutes</strong>.
                  </p>

                  <a href="${magicLink}"
                    style="display:inline-block;padding:12px 28px;background:#111;color:#fff;
                           text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                    Log in to my subscriptions
                  </a>

                  <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
                    If you didn't request this, you can safely ignore this email.
                    <br />
                    Or paste this link: <a href="${magicLink}" style="color:#6b7280;">${magicLink}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await send({
    to,
    subject: `Your login link for ${shopName}`,
    html,
  });
}

// ── Send subscription paused email ─────────────────────────────────────────

export async function sendSubscriptionPaused(
  opts: SubscriptionEventEmailOptions,
): Promise<void> {
  const { to, shopName = "Your Store", planName, nextDate } = opts;

  const resumeText = nextDate
    ? `Your subscription will automatically resume on <strong>${formatDate(nextDate)}</strong>.`
    : "You can resume your subscription any time from your account.";

  const html = buildSimpleEmail({
    shopName,
    title: "Your subscription is paused",
    body: `
      <p>Your <strong>${planName}</strong> subscription has been paused.</p>
      <p>${resumeText}</p>
    `,
    ctaText: "Manage subscriptions",
    ctaUrl: config.portalUrl,
  });

  await send({ to, subject: `Your ${planName} subscription is paused`, html });
}

// ── Send subscription resumed email ───────────────────────────────────────

export async function sendSubscriptionResumed(
  opts: SubscriptionEventEmailOptions,
): Promise<void> {
  const { to, shopName = "Your Store", planName, nextDate, amount } = opts;

  const html = buildSimpleEmail({
    shopName,
    title: "Your subscription is back on",
    body: `
      <p>Your <strong>${planName}</strong> subscription has been resumed.</p>
      ${nextDate ? `<p>Your next billing date is <strong>${formatDate(nextDate)}</strong>${amount ? ` for <strong>$${amount.toFixed(2)}</strong>` : ""}.</p>` : ""}
    `,
    ctaText: "View my subscriptions",
    ctaUrl: config.portalUrl,
  });

  await send({
    to,
    subject: `Your ${planName} subscription is active again`,
    html,
  });
}

// ── Send subscription cancelled email ─────────────────────────────────────

export async function sendSubscriptionCancelled(
  opts: SubscriptionEventEmailOptions,
): Promise<void> {
  const { to, shopName = "Your Store", planName, reason } = opts;

  const html = buildSimpleEmail({
    shopName,
    title: "Subscription cancelled",
    body: `
      <p>Your <strong>${planName}</strong> subscription has been cancelled.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ""}
      <p>If this was a mistake, you can always start a new subscription from the store.</p>
    `,
    ctaText: "Visit the store",
    ctaUrl: config.portalUrl,
  });

  await send({
    to,
    subject: `Your ${planName} subscription has been cancelled`,
    html,
  });
}

// ── Send payment failed email ──────────────────────────────────────────────

export async function sendPaymentFailed(
  opts: SubscriptionEventEmailOptions,
): Promise<void> {
  const { to, shopName = "Your Store", planName, nextDate, amount } = opts;

  const html = buildSimpleEmail({
    shopName,
    title: "Payment failed",
    body: `
      <p>We couldn't process your payment of <strong>$${amount?.toFixed(2) ?? "—"}</strong>
         for your <strong>${planName}</strong> subscription.</p>
      <p>Please update your payment method to avoid losing your subscription.</p>
      ${nextDate ? `<p>We'll try again on <strong>${formatDate(nextDate)}</strong>.</p>` : ""}
    `,
    ctaText: "Update payment method",
    ctaUrl: `${config.portalUrl}?tab=billing`,
  });

  await send({
    to,
    subject: `Action needed: payment failed for ${planName}`,
    html,
  });
}

// ── Core send function ─────────────────────────────────────────────────────

async function send(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!resend) {
    // Dev mode — log instead of sending
    console.log(`\n[email] DEV MODE — would send to: ${opts.to}`);
    console.log(`[email] Subject: ${opts.subject}\n`);
    return;
  }

  const { error } = await resend.emails.send({
    from: config.email.fromAddress,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (error) {
    // Log but don't throw — a failed email shouldn't crash the API
    console.error("[email] Send failed:", error);
  }
}

// ── Email template helper ──────────────────────────────────────────────────

function buildSimpleEmail(opts: {
  shopName: string;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
        <tr><td align="center">
          <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
            <tr><td>
              <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;">${opts.shopName}</p>
              <h1 style="margin:0 0 16px;font-size:20px;color:#111;font-weight:600;">${opts.title}</h1>
              <div style="color:#374151;font-size:15px;line-height:1.7;margin-bottom:24px;">
                ${opts.body}
              </div>
              <a href="${opts.ctaUrl}"
                style="display:inline-block;padding:12px 24px;background:#111;color:#fff;
                       text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                ${opts.ctaText}
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
