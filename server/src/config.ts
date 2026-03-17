/**
 * config.ts — typed configuration from environment variables.
 *
 * TypeScript note: we define an interface for the config shape so every
 * consumer knows exactly what properties exist and what type they are.
 */

import dotenv from "dotenv";
dotenv.config();

// ── Helper functions ───────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\nCheck your .env file.`,
    );
  }
  return value;
}

function optionalEnv(key: string, fallback: string = ""): string {
  return process.env[key] ?? fallback;
}

// ── Config interface ───────────────────────────────────────────────────────
// Defining this interface means any code that imports config gets full
// autocomplete and TypeScript will catch typos like config.shopify.aipKey

interface Config {
  port: number;
  nodeEnv: string;
  appUrl: string;
  isDev: boolean;
  databaseUrl: string;

  shopify: {
    apiKey: string;
    apiSecret: string;
    scopes: string[];
    apiVersion: string;
  };

  jwt: {
    secret: string;
    expiry: string;
  };

  stripe: {
    secretKey: string;
    webhookSecret: string;
  };

  corsOrigins: string[];
  portalUrl: string;

  email: {
    resendApiKey: string;
    fromAddress: string;
  };
}

// ── Build config ───────────────────────────────────────────────────────────

const config: Config = {
  port: parseInt(optionalEnv("PORT", "3000"), 10),
  nodeEnv: optionalEnv("NODE_ENV", "development"),
  appUrl: optionalEnv("APP_URL", "http://localhost:3000"),
  isDev: optionalEnv("NODE_ENV", "development") === "development",
  databaseUrl: requireEnv("DATABASE_URL"),

  shopify: {
    apiKey: requireEnv("SHOPIFY_API_KEY"),
    apiSecret: requireEnv("SHOPIFY_API_SECRET"),
    scopes: optionalEnv(
      "SHOPIFY_SCOPES",
      "read_products,read_customers,read_orders",
    ).split(","),
    apiVersion: optionalEnv("SHOPIFY_API_VERSION", "2024-01"),
  },

  jwt: {
    secret: requireEnv("JWT_SECRET"),
    expiry: optionalEnv("JWT_EXPIRY", "7d"),
  },

  stripe: {
    secretKey: optionalEnv("STRIPE_SECRET_KEY"),
    webhookSecret: optionalEnv("STRIPE_WEBHOOK_SECRET"),
  },

  corsOrigins: optionalEnv(
    "CORS_ORIGIN",
    "http://localhost:3001,http://localhost:3002",
  )
    .split(",")
    .map((s) => s.trim()),

  portalUrl: optionalEnv("PORTAL_URL", "http://localhost:3002"),

  email: {
    resendApiKey: optionalEnv("RESEND_API_KEY"), // leave blank to disable sending in dev
    fromAddress: optionalEnv("EMAIL_FROM", "noreply@yourdomain.com"),
  },
};

export default config;
