import { describe, expect, it } from 'vitest';
import { buildMockUpiRequest, getWorkflowTab, workflowTabs } from './workflow';

describe('workflow navigation model', () => {
  it('defines clickable tabs with unique drill-down targets', () => {
    const ids = workflowTabs.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(workflowTabs.length).toBeGreaterThanOrEqual(6);
    expect(workflowTabs.every((tab) => tab.cta && tab.drillDown && tab.apiFlow)).toBe(true);
  });

  it('builds a mock UPI/NPCI request payload from the active tab', () => {
    const tab = getWorkflowTab(workflowTabs[1].id);
    const payload = buildMockUpiRequest(tab, 875);

    expect(payload.txnId).toMatch(/^TXN-/);
    expect(payload.payerVpa).toContain('@');
    expect(payload.payeeVpa).toContain('@');
    expect(payload.amount).toBe(875);
    expect(payload.scenario).toBe(tab.mockScenario);
  });
});
