/**
 * db.ts — Prisma client singleton.
 *
 * TypeScript note: PrismaClient is fully typed — every query method has
 * typed parameters and return values generated from your schema.prisma.
 * Run `npm run db:generate` after changing the schema to refresh those types.
 */

import { PrismaClient } from "@prisma/client";

// Extend globalThis so TypeScript knows about our cached client
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export default prisma;
