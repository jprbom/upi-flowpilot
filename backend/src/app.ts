import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { roleCatalogue } from './auth.js';
import { createDefaultDatabase, type JsonDatabase } from './db.js';
import { registerOperationalEndpoints } from './observability.js';
import { registerRoutes } from './routes.js';

export function createApp(database: JsonDatabase = createDefaultDatabase()) {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
  app.use(rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '512kb' }));
  registerOperationalEndpoints(app, { service: 'UPI FlowPilot', port: Number(process.env.PORT ?? 4101) });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'UPI FlowPilot',
      author: 'Prashant Jagtap <jprbom@gmail.com>',
      roles: roleCatalogue()
    });
  });

  registerRoutes(app, database);

  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        issues: err.issues
      });
      return;
    }
    const status = err.status || 500;
    res.status(status).json({
      error: status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR',
      message: err.message
    });
  });

  return app;
}
