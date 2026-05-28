import type { PaymentSimulationResult } from '../contracts.js';
import { stableHash } from '../paymentScenario.js';

export type DisputeRecord = {
  disputeId: string;
  txnId: string;
  orderId: string;
  paymentId: string;
  reason: string;
  status: 'OPENED' | 'EVIDENCE_REQUIRED' | 'CUSTOMER_CREDIT_PENDING' | 'CLOSED';
  createdAt: string;
};

export function disputeSimulator(payment: PaymentSimulationResult, reason = 'CUSTOMER_CLAIMS_PAYMENT_NOT_RECEIVED'): DisputeRecord {
  return {
    disputeId: `disp_${stableHash(payment.txnId + reason).slice(0, 14)}`,
    txnId: payment.txnId,
    orderId: payment.orderId,
    paymentId: payment.paymentId,
    reason,
    status: payment.finalStatus === 'SUCCESS' ? 'EVIDENCE_REQUIRED' : 'CUSTOMER_CREDIT_PENDING',
    createdAt: new Date().toISOString()
  };
}

