import { z } from 'zod';

export const paymentFlowSchema = z.enum(['UPI_INTENT', 'UPI_QR', 'UPI_COLLECT', 'UPI_LITE']);
export const paymentStatusSchema = z.enum(['SUCCESS', 'FAILED', 'PENDING', 'RETRIED']);

export const paymentEventInputSchema = z.object({
  merchantId: z.string().min(3),
  amount: z.number().positive().max(500000),
  payerBank: z.string().min(2),
  psp: z.string().min(2),
  flow: paymentFlowSchema,
  status: paymentStatusSchema,
  latencyMs: z.number().int().nonnegative(),
  failureReason: z.string().optional(),
  riskScore: z.number().min(0).max(100)
});

export const routingRuleInputSchema = z.object({
  name: z.string().min(3),
  condition: z.string().min(3),
  recommendedFlow: paymentFlowSchema,
  active: z.boolean()
});

export const recommendationInputSchema = z.object({
  amount: z.number().positive().max(500000),
  payerBank: z.string().min(2),
  psp: z.string().min(2),
  collectDeclineRate: z.number().min(0).max(1),
  payerBankSuccessRate: z.number().min(0).max(1),
  customerSegment: z.enum(['new', 'returning', 'high_value']),
  riskScore: z.number().min(0).max(100)
});

export type PaymentEventInput = z.infer<typeof paymentEventInputSchema>;
export type RoutingRuleInput = z.infer<typeof routingRuleInputSchema>;
export type RecommendationInput = z.infer<typeof recommendationInputSchema>;
export type PaymentFlow = z.infer<typeof paymentFlowSchema>;

