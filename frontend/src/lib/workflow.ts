export type MockScenario = 'HAPPY_PATH' | 'DEGRADED_BANK' | 'BANK_TIMEOUT' | 'RISK_HOLD' | 'STEP_UP';

export type WorkflowTab = {
  id: string;
  label: string;
  description: string;
  cta: string;
  drillDown: string;
  apiFlow: string;
  mockScenario: MockScenario;
};

export const workflowTabs: WorkflowTab[] = [
  {
    "id": "overview",
    "label": "Overview",
    "description": "Executive checkout health, success rate, and revenue leakage overview.",
    "cta": "Open Reliability Drill-down",
    "drillDown": "Inspect KPI, failed value, and latest payment health.",
    "apiFlow": "GET /metrics -> KPIs and failure mix",
    "mockScenario": "HAPPY_PATH"
  },
  {
    "id": "flows",
    "label": "Flow Optimizer",
    "description": "UPI Intent, QR, Collect, and Lite decisioning based on context.",
    "cta": "Mock Intent vs Collect",
    "drillDown": "Compare flow rank and suggested fallback.",
    "apiFlow": "POST /recommendations -> ranked UPI flows",
    "mockScenario": "DEGRADED_BANK"
  },
  {
    "id": "transactions",
    "label": "Transactions",
    "description": "Payment attempts, failures, retries, and admin CRUD.",
    "cta": "Create Test Payment",
    "drillDown": "Open payment event detail and lifecycle actions.",
    "apiFlow": "CRUD /payment-events",
    "mockScenario": "HAPPY_PATH"
  },
  {
    "id": "reliability",
    "label": "Reliability SRE",
    "description": "Bank and PSP degradation signals with merchant impact.",
    "cta": "Trigger Degradation Probe",
    "drillDown": "Trace timeout, app-switch drop, and retry window.",
    "apiFlow": "POST /api/mock-upi -> bank/PSP callback",
    "mockScenario": "BANK_TIMEOUT"
  },
  {
    "id": "rules",
    "label": "Routing Rules",
    "description": "Merchant routing rules and UPI Lite fallback policies.",
    "cta": "Review Active Rule",
    "drillDown": "Inspect rule condition and target flow.",
    "apiFlow": "CRUD /routing-rules",
    "mockScenario": "HAPPY_PATH"
  },
  {
    "id": "simulator",
    "label": "NPCI Mock Rail",
    "description": "Synthetic NPCI-style request/response sandbox for demos.",
    "cta": "Send Mock UPI Request",
    "drillDown": "View RRN, response code, and settlement state.",
    "apiFlow": "POST /mock-upi",
    "mockScenario": "HAPPY_PATH"
  }
];

export function getWorkflowTab(id: string) {
  return workflowTabs.find((tab) => tab.id === id) ?? workflowTabs[0];
}

export function buildMockUpiRequest(tab: WorkflowTab, amount: number) {
  return {
    txnId: 'TXN-' + tab.id.toUpperCase() + '-' + Date.now().toString(36).toUpperCase(),
    payerVpa: 'demo.payer@oksbi',
    payeeVpa: 'upiflowpilot@upi',
    amount,
    flow: tab.id.includes('qr') ? 'UPI_QR' : tab.id.includes('lite') ? 'UPI_LITE' : 'UPI_INTENT',
    purpose: 'UPI FlowPilot ' + tab.label + ' sandbox payment',
    riskScore: tab.mockScenario === 'RISK_HOLD' ? 88 : tab.mockScenario === 'STEP_UP' ? 66 : 24,
    scenario: tab.mockScenario
  };
}
