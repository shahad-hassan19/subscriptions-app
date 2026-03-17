import express, { Request, Response, NextFunction } from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import morgan  from 'morgan';
import config  from './config.js';

import shopifyAuthRouter from './routes/shopifyAuth.js';
import webhookRouter     from './routes/webhooks.js';
import billingPlanRouter  from './routes/billingPlans.js';
import subscriptionRouter from './routes/subscriptions.js';
import billingRouter      from './routes/billing.js';
import customerRouter     from './routes/customer.js';

const app = express();

// ── Security ──────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      frameAncestors: ["'self'", 'https://*.shopify.com', 'https://*.myshopify.com'],
    },
  },
  frameguard: false,
}));

app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(morgan(config.isDev ? 'dev' : 'combined'));

// ── Webhooks BEFORE body parser ───────────────────────────────────────────
app.use('/api/webhooks', webhookRouter);

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/auth/shopify',      shopifyAuthRouter);
app.use('/api/billing-plans', billingPlanRouter);
app.use('/api/subscriptions', subscriptionRouter);
app.use('/api/billing',       billingRouter);
app.use('/api/customer',      customerRouter);

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (_req: Request, res: Response) => {
  res.json({ app: 'Shopify Subscriptions API', version: '1.0.0' });
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// ── Error handler ─────────────────────────────────────────────────────────
// TypeScript: error handlers need the 4-argument signature to be recognised
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', config.isDev ? err : err.message);
  const status  = err.status ?? 500;
  const message = status === 500 && !config.isDev ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n🚀  Server  →  http://localhost:${config.port}`);
  console.log(`🔑  Install →  http://localhost:${config.port}/auth/shopify?shop=STORE.myshopify.com`);
  console.log(`❤️   Health  →  http://localhost:${config.port}/health\n`);
});

export default app;