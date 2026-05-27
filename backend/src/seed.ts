export type PaymentEvent = {
  id: string;
  merchantId: string;
  amount: number;
  payerBank: string;
  psp: string;
  flow: 'UPI_INTENT' | 'UPI_QR' | 'UPI_COLLECT' | 'UPI_LITE';
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'RETRIED';
  latencyMs: number;
  failureReason?: string;
  riskScore: number;
  createdAt: string;
};

export type RoutingRule = {
  id: string;
  name: string;
  condition: string;
  recommendedFlow: 'UPI_INTENT' | 'UPI_QR' | 'UPI_COLLECT' | 'UPI_LITE';
  active: boolean;
  createdAt: string;
};

export type DatabaseShape = {
  paymentEvents: PaymentEvent[];
  routingRules: RoutingRule[];
};

export const seed: DatabaseShape = {
  paymentEvents: [
    { id: 'pay_001', merchantId: 'kirana-mumbai-44', amount: 2450, payerBank: 'HDFC Bank', psp: 'PhonePe', flow: 'UPI_INTENT', status: 'SUCCESS', latencyMs: 1380, riskScore: 18, createdAt: '2026-05-27T12:04:00.000Z' },
    { id: 'pay_002', merchantId: 'food-cart-pune-11', amount: 190, payerBank: 'SBI', psp: 'GPay', flow: 'UPI_COLLECT', status: 'FAILED', latencyMs: 8900, failureReason: 'BANK_TIMEOUT', riskScore: 22, createdAt: '2026-05-27T12:05:00.000Z' },
    { id: 'pay_003', merchantId: 'd2c-jaipur-88', amount: 8600, payerBank: 'ICICI Bank', psp: 'Paytm', flow: 'UPI_QR', status: 'RETRIED', latencyMs: 4100, failureReason: 'APP_SWITCH_DROP', riskScore: 31, createdAt: '2026-05-27T12:07:00.000Z' },
    { id: 'pay_004', merchantId: 'pharma-nagpur-09', amount: 440, payerBank: 'Axis Bank', psp: 'BHIM', flow: 'UPI_LITE', status: 'SUCCESS', latencyMs: 620, riskScore: 9, createdAt: '2026-05-27T12:09:00.000Z' }
  ],
  routingRules: [
    { id: 'rule_001', name: 'Low ticket Lite nudge', condition: 'amount <= 500 and payer opted-in', recommendedFlow: 'UPI_LITE', active: true, createdAt: '2026-05-27T10:00:00.000Z' },
    { id: 'rule_002', name: 'Collect degradation fallback', condition: 'collect decline rate above 20 percent', recommendedFlow: 'UPI_INTENT', active: true, createdAt: '2026-05-27T10:05:00.000Z' }
  ]
};

