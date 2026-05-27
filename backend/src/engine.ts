import type { RecommendationInput, PaymentFlow } from './schemas.js';

type FlowScore = {
  flow: PaymentFlow;
  score: number;
  estimatedLatencySeconds: number;
};

export function recommendPaymentFlow(input: RecommendationInput) {
  const scores: FlowScore[] = [
    { flow: 'UPI_INTENT', score: 82, estimatedLatencySeconds: 2.4 },
    { flow: 'UPI_QR', score: 78, estimatedLatencySeconds: 3.1 },
    { flow: 'UPI_COLLECT', score: 70, estimatedLatencySeconds: 4.0 },
    { flow: 'UPI_LITE', score: input.amount <= 500 ? 90 : 40, estimatedLatencySeconds: 1.2 }
  ];

  const reasonCodes: string[] = [];

  if (input.collectDeclineRate > 0.2) {
    scores.find((score) => score.flow === 'UPI_COLLECT')!.score -= 28;
    scores.find((score) => score.flow === 'UPI_INTENT')!.score += 8;
    reasonCodes.push('COLLECT_DECLINE_RATE_HIGH');
  }

  if (input.payerBankSuccessRate < 0.93) {
    scores.find((score) => score.flow === 'UPI_QR')!.score += 6;
    scores.find((score) => score.flow === 'UPI_INTENT')!.score += 4;
    scores.find((score) => score.flow === 'UPI_COLLECT')!.score -= 12;
    reasonCodes.push('PAYER_BANK_DEGRADED');
  }

  if (input.amount <= 500) {
    scores.find((score) => score.flow === 'UPI_LITE')!.score += 12;
    reasonCodes.push('LOW_TICKET_LITE_ELIGIBLE');
  }

  if (input.customerSegment === 'new') {
    scores.find((score) => score.flow === 'UPI_QR')!.score += 4;
    reasonCodes.push('NEW_CUSTOMER_NEEDS_LOW_FRICTION');
  }

  if (input.riskScore > 80) {
    return {
      recommendedFlow: 'DECLINE',
      successProbability: 0.12,
      estimatedLatencySeconds: 0,
      reasonCodes: ['RISK_SCORE_BLOCK'],
      customerNudge: 'Payment needs additional verification before retry.',
      merchantAction: 'Send to risk review before another payment attempt.',
      alternatives: scores.sort((a, b) => b.score - a.score)
    };
  }

  const ranked = scores.sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const successProbability = Math.max(0.05, Math.min(0.995, best.score / 100));

  return {
    recommendedFlow: best.flow,
    successProbability,
    estimatedLatencySeconds: best.estimatedLatencySeconds,
    reasonCodes,
    customerNudge: best.flow === 'UPI_LITE' ? 'Use UPI Lite for a faster low-value payment.' : 'Use ' + best.flow.replace('UPI_', 'UPI ') + ' for the best chance of success.',
    merchantAction: 'Default checkout to ' + best.flow.replace('UPI_', 'UPI ') + ' for this context and monitor bank health for 15 minutes.',
    alternatives: ranked
  };
}
