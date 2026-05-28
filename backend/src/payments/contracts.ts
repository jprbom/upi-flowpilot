export type PaymentActor =
  | 'MERCHANT'
  | 'PAYMENT_GATEWAY'
  | 'PAYMENT_AGGREGATOR'
  | 'TPAP'
  | 'PSP'
  | 'ISSUER_BANK'
  | 'ACQUIRER_BANK'
  | 'NPCI_SIMULATOR'
  | 'RISK_ENGINE'
  | 'CUSTOMER';

export type PaymentLifecycleEvent = {
  sequence: number;
  state: string;
  actor: PaymentActor;
  at: string;
  reasonCode?: string;
  raw?: Record<string, unknown>;
};

export type PaymentScenarioCode =
  | 'HAPPY_PATH'
  | 'CUSTOMER_DECLINED'
  | 'BANK_TIMEOUT'
  | 'PSP_DOWN'
  | 'DUPLICATE_REQUEST'
  | 'VPA_INVALID'
  | 'INSUFFICIENT_FUNDS'
  | 'RISK_HOLD'
  | 'DEEMED_SUCCESS'
  | 'LATE_SUCCESS_AFTER_FAILURE'
  | 'REVERSAL'
  | 'WEBHOOK_DUPLICATE'
  | 'WEBHOOK_OUT_OF_ORDER';

export type UpiFlow = 'UPI_INTENT' | 'UPI_QR' | 'UPI_COLLECT' | 'UPI_LITE' | 'MANDATE';

export type NpciRailRequest = {
  txnId: string;
  idempotencyKey: string;
  payerVpaHash: string;
  payeeVpaHash: string;
  amountPaise: number;
  purpose: string;
  mcc: string;
  initiationMode: UpiFlow;
  payerPsp: string;
  payeePsp: string;
  payerBank: string;
  payeeBank: string;
  deviceFingerprintHash?: string;
  riskScore?: number;
  scenario: PaymentScenarioCode;
};

export type NpciRailResponse = {
  gateway: 'NPCI_UPI_SIMULATOR';
  txnId: string;
  upiRequestId: string;
  rrn: string;
  responseCode: string;
  responseMessage: string;
  railStatus: 'SUCCESS' | 'FAILED' | 'DEEMED_PENDING' | 'TIMEOUT' | 'RISK_HOLD' | 'REVERSAL_PENDING';
  settlementState: 'NOT_SETTLED' | 'READY_FOR_SETTLEMENT' | 'PRE_SETTLEMENT_HOLD' | 'SETTLED' | 'REVERSAL_PENDING';
  timeline: PaymentLifecycleEvent[];
  callback: {
    eventId: string;
    eventType: string;
    callbackUrl: string;
    retryCount: number;
  };
};

export type TpapRequest = {
  txnId: string;
  app: 'PHONEPE' | 'GPAY' | 'PAYTM' | 'BHIM' | 'OTHER';
  flow: Extract<UpiFlow, 'UPI_INTENT' | 'UPI_QR' | 'UPI_COLLECT'>;
  deviceTrustScore: number;
  customerAction: 'APPROVE' | 'DECLINE' | 'RETRY' | 'APP_SWITCH_DROP' | 'PIN_FAILURE' | 'TIMEOUT';
};

export type TpapResponse = {
  txnId: string;
  app: string;
  tpapStatus: 'APPROVED' | 'DECLINED' | 'RETRY_STARTED' | 'APP_SWITCH_DROPPED' | 'TIMEOUT';
  customerVisibleMessage: string;
  nextAction: 'SEND_TO_NPCI' | 'RETRY_ALLOWED' | 'FAIL_PAYMENT' | 'STEP_UP_REQUIRED';
  timeline: PaymentLifecycleEvent[];
};

export type BankHealth = {
  bankCode: string;
  successRate: number;
  p95LatencyMs: number;
  timeoutRate: number;
  degradationLevel: 'NORMAL' | 'MINOR' | 'MAJOR' | 'OUTAGE';
  affectedFlows: Array<'UPI_INTENT' | 'UPI_QR' | 'UPI_COLLECT' | 'UPI_LITE'>;
};

export type BankResponse = {
  txnId: string;
  bankStatus:
    | 'PIN_VALIDATION_SUCCESS'
    | 'PIN_VALIDATION_FAILED'
    | 'BANK_CORE_TIMEOUT'
    | 'INSUFFICIENT_FUNDS'
    | 'ACCOUNT_BLOCKED'
    | 'DAILY_LIMIT_EXCEEDED'
    | 'SUCCESS'
    | 'REVERSAL';
  health: BankHealth;
  timeline: PaymentLifecycleEvent[];
};

export type PaymentGatewayCreatePaymentRequest = {
  merchantOrderId: string;
  amount: number;
  expireAfter?: number;
  paymentFlow: {
    type: 'PG_CHECKOUT';
    message?: string;
    merchantUrls: {
      redirectUrl: string;
    };
    paymentModeConfig?: {
      enabledPaymentModes?: Array<{ type: 'UPI_INTENT' | 'UPI_QR' | 'CARD' | 'NET_BANKING' }>;
      disabledPaymentModes?: Array<{ type: 'UPI_INTENT' | 'UPI_QR' | 'CARD' | 'NET_BANKING' }>;
    };
  };
  metaInfo?: Record<string, string>;
};

export type PaymentGatewayCreatePaymentResponse = {
  merchantOrderId: string;
  gatewayOrderId: string;
  checkoutUrl: string;
  status: 'CHECKOUT_CREATED';
  expiresAt: string;
  timeline: PaymentLifecycleEvent[];
};

export type PaymentAttempt = {
  paymentId: string;
  orderId: string;
  method: 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET';
  flow?: Extract<UpiFlow, 'UPI_INTENT' | 'UPI_QR' | 'UPI_COLLECT' | 'UPI_LITE'>;
  status: 'NOT_ATTEMPTED' | 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'SUCCESS';
  rrn?: string;
  bankReferenceId?: string;
  errorCode?: string;
  errorReason?: string;
};

export type PaymentAggregatorOrder = {
  orderId: string;
  merchantId: string;
  amountPaise: number;
  currency: 'INR';
  status: 'CREATED' | 'ATTEMPTED' | 'PAID' | 'FAILED' | 'EXPIRED';
  attempts: PaymentAttempt[];
  timeline: PaymentLifecycleEvent[];
};

export type AggregatorWebhook = {
  eventId: string;
  event:
    | 'payment.authorized'
    | 'payment.captured'
    | 'payment.failed'
    | 'payment.downtime.started'
    | 'payment.downtime.resolved'
    | 'refund.processed'
    | 'settlement.processed'
    | 'risk.pre_settlement_hold';
  orderId: string;
  paymentId: string;
  payload: Record<string, unknown>;
  signature: string;
  createdAt: string;
};

export type PaymentScenario = {
  txnId: string;
  orderId: string;
  idempotencyKey: string;
  merchantId: string;
  payerVpaHash: string;
  payeeVpaHash: string;
  amountPaise: number;
  purpose: string;
  mcc: string;
  flow: UpiFlow;
  payerPsp: string;
  payeePsp: string;
  payerBank: string;
  payeeBank: string;
  tpapApp: TpapRequest['app'];
  deviceFingerprintHash?: string;
  deviceTrustScore: number;
  customerAction: TpapRequest['customerAction'];
  scenario: PaymentScenarioCode;
  riskScore: number;
  repoContext?: 'FLOWPILOT' | 'INTERDICT' | 'CASHFLOW' | 'GUARDIAN' | 'SOCIAL_PROOF' | 'SPEND_BRAKE';
  consentPolicyId?: string;
  agentId?: string;
  promptInjectionRisk?: number;
  humanApprovalRequired?: boolean;
  spendBrakeDecision?: 'ALLOW' | 'NUDGE' | 'COOLING_PERIOD' | 'BLOCK';
};

export type PaymentSimulationResult = {
  txnId: string;
  orderId: string;
  paymentId: string;
  finalStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'DEEMED' | 'RISK_HOLD' | 'REVERSED';
  rrn?: string;
  timeline: PaymentLifecycleEvent[];
  webhooks: AggregatorWebhook[];
  reconciliation: {
    settlementBatchId?: string;
    settlementStatus: 'NOT_READY' | 'READY' | 'HELD' | 'SETTLED' | 'REVERSED';
  };
  adapters: {
    gatewayOrderId: string;
    tpapStatus: TpapResponse['tpapStatus'];
    bankHealth: BankHealth;
    railStatus: NpciRailResponse['railStatus'];
  };
};

export type WebhookEventStore = {
  eventId: string;
  provider: 'NPCI_SIM' | 'TPAP_SIM' | 'PA_SIM' | 'PG_SIM' | 'BANK_SIM';
  paymentId: string;
  orderId: string;
  eventType: string;
  receivedAt: string;
  processed: boolean;
  duplicate: boolean;
  rawPayload: Record<string, unknown>;
};

