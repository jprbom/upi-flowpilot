import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requirePermission } from './auth.js';
import type { JsonDatabase } from './db.js';
import { recommendPaymentFlow } from './engine.js';
import { paymentEventInputSchema, recommendationInputSchema, routingRuleInputSchema } from './schemas.js';

const nonEmptyPatch = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.partial().refine((value) => Object.keys(value).length > 0, 'Patch must contain at least one field.');

export function registerRoutes(app: Express, db: JsonDatabase) {
  app.get('/api/metrics', requirePermission('read'), async (_req, res, next) => {
    try {
      const events = await db.list<any>('paymentEvents');
      const total = events.length;
      const success = events.filter((event) => event.status === 'SUCCESS').length;
      const failed = events.filter((event) => event.status === 'FAILED').length;
      const averageLatencyMs = Math.round(events.reduce((sum, event) => sum + event.latencyMs, 0) / Math.max(total, 1));
      const reasons = events.reduce<Record<string, number>>((acc, event) => {
        const reason = event.failureReason || 'SUCCESS';
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {});
      res.json({
        kpis: {
          totalAttempts: total,
          successRate: Number((success / Math.max(total, 1)).toFixed(3)),
          failureRate: Number((failed / Math.max(total, 1)).toFixed(3)),
          averageLatencyMs
        },
        failureReasons: reasons,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/payment-events', requirePermission('read'), async (_req, res, next) => {
    try {
      res.json(await db.list('paymentEvents'));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/payment-events', requirePermission('write'), async (req, res, next) => {
    try {
      const body = paymentEventInputSchema.parse(req.body);
      const item = { id: 'pay_' + randomUUID(), createdAt: new Date().toISOString(), ...body };
      res.status(201).json(await db.create('paymentEvents', item));
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/payment-events/:id', requirePermission('write'), async (req, res, next) => {
    try {
      const patch = nonEmptyPatch(paymentEventInputSchema).parse(req.body);
      res.json(await db.update('paymentEvents', String(req.params.id), patch));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/payment-events/:id', requirePermission('admin'), async (req, res, next) => {
    try {
      await db.delete('paymentEvents', String(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/routing-rules', requirePermission('read'), async (_req, res, next) => {
    try {
      res.json(await db.list('routingRules'));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/routing-rules', requirePermission('write'), async (req, res, next) => {
    try {
      const body = routingRuleInputSchema.parse(req.body);
      const item = { id: 'rule_' + randomUUID(), createdAt: new Date().toISOString(), ...body };
      res.status(201).json(await db.create('routingRules', item));
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/routing-rules/:id', requirePermission('write'), async (req, res, next) => {
    try {
      const patch = nonEmptyPatch(routingRuleInputSchema).parse(req.body);
      res.json(await db.update('routingRules', String(req.params.id), patch));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/routing-rules/:id', requirePermission('admin'), async (req, res, next) => {
    try {
      await db.delete('routingRules', String(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/recommendations', requirePermission('read'), (req, res, next) => {
    try {
      res.json(recommendPaymentFlow(recommendationInputSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });
}


