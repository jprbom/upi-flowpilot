import type { NpciRailResponse, PaymentScenario } from '../contracts.js';
import { stableHash } from '../paymentScenario.js';

export type SettlementBatch = {
  settlementBatchId: string;
  txnId: string;
  orderId: string;
  status: 'NOT_READY' | 'READY' | 'HELD' | 'SETTLED' | 'REVERSED';
  amountPaise: number;
  rrn?: string;
  createdAt: string;
};

export function settlementSimulator(input: PaymentScenario, npci: NpciRailResponse): SettlementBatch {
  return {
    settlementBatchId: `set_${stableHash(input.orderId + npci.rrn).slice(0, 12)}`,
    txnId: input.txnId,
    orderId: input.orderId,
    status: settlementStatus(npci),
    amountPaise: input.amountPaise,
    rrn: npci.rrn,
    createdAt: new Date().toISOString()
  };
}

function settlementStatus(npci: NpciRailResponse): SettlementBatch['status'] {
  if (npci.settlementState === 'SETTLED') return 'SETTLED';
  if (npci.settlementState === 'READY_FOR_SETTLEMENT') return 'READY';
  if (npci.settlementState === 'PRE_SETTLEMENT_HOLD') return 'HELD';
  if (npci.settlementState === 'REVERSAL_PENDING') return 'REVERSED';
  return 'NOT_READY';
}

