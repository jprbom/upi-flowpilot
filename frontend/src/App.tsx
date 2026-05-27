import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, Bell, GitBranch, Lock, Radar, RefreshCw, Route, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { apiRequest } from './api';
import { formatInr, percent } from './lib/viewModel';

type Role = 'ADMIN' | 'OPS_MANAGER' | 'MERCHANT_ANALYST' | 'SUPPORT_AGENT' | 'VIEWER';
type PaymentEvent = {
  id: string;
  merchantId: string;
  amount: number;
  payerBank: string;
  psp: string;
  flow: string;
  status: string;
  latencyMs: number;
  failureReason?: string;
  riskScore: number;
  createdAt: string;
};
type Metrics = {
  kpis: {
    totalAttempts: number;
    successRate: number;
    failureRate: number;
    averageLatencyMs: number;
  };
  failureReasons: Record<string, number>;
};
type Recommendation = {
  recommendedFlow: string;
  successProbability: number;
  estimatedLatencySeconds: number;
  reasonCodes: string[];
  customerNudge: string;
  merchantAction: string;
};

const roles: Role[] = ['ADMIN', 'OPS_MANAGER', 'MERCHANT_ANALYST', 'SUPPORT_AGENT', 'VIEWER'];
const fallbackEvents: PaymentEvent[] = [
  { id: 'pay_001', merchantId: 'kirana-mumbai-44', amount: 2450, payerBank: 'HDFC Bank', psp: 'PhonePe', flow: 'UPI_INTENT', status: 'SUCCESS', latencyMs: 1380, riskScore: 18, createdAt: '2026-05-27T12:04:00.000Z' },
  { id: 'pay_002', merchantId: 'food-cart-pune-11', amount: 190, payerBank: 'SBI', psp: 'GPay', flow: 'UPI_COLLECT', status: 'FAILED', latencyMs: 8900, failureReason: 'BANK_TIMEOUT', riskScore: 22, createdAt: '2026-05-27T12:05:00.000Z' },
  { id: 'pay_003', merchantId: 'd2c-jaipur-88', amount: 8600, payerBank: 'ICICI Bank', psp: 'Paytm', flow: 'UPI_QR', status: 'RETRIED', latencyMs: 4100, failureReason: 'APP_SWITCH_DROP', riskScore: 31, createdAt: '2026-05-27T12:07:00.000Z' }
];
const fallbackMetrics: Metrics = {
  kpis: { totalAttempts: 1820000, successRate: 0.9628, failureRate: 0.0372, averageLatencyMs: 1480 },
  failureReasons: { BANK_TIMEOUT: 35, APP_SWITCH_DROP: 28, INSUFFICIENT_FUNDS: 14, SUCCESS: 86 }
};

export default function App() {
  const [role, setRole] = useState<Role>('OPS_MANAGER');
  const [events, setEvents] = useState<PaymentEvent[]>(fallbackEvents);
  const [metrics, setMetrics] = useState<Metrics>(fallbackMetrics);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState(240);

  async function load() {
    try {
      const [nextMetrics, nextEvents] = await Promise.all([
        apiRequest<Metrics>('/metrics', role),
        apiRequest<PaymentEvent[]>('/payment-events', role)
      ]);
      setMetrics(nextMetrics);
      setEvents(nextEvents);
      setError('');
    } catch {
      setError('API offline: showing synthetic portfolio data.');
    }
  }

  useEffect(() => {
    void load();
  }, [role]);

  const revenueLeakage = useMemo(() => events.filter((event) => event.status === 'FAILED').reduce((sum, event) => sum + event.amount, 0), [events]);

  async function simulate() {
    const result = await apiRequest<Recommendation>('/recommendations', role, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        payerBank: 'SBI',
        psp: 'GPay',
        collectDeclineRate: 0.31,
        payerBankSuccessRate: 0.9,
        customerSegment: amount <= 500 ? 'returning' : 'new',
        riskScore: 18
      })
    });
    setRecommendation(result);
  }

  async function createEvent() {
    const created = await apiRequest<PaymentEvent>('/payment-events', role, {
      method: 'POST',
      body: JSON.stringify({
        merchantId: 'demo-merchant-' + Math.floor(Math.random() * 900),
        amount,
        payerBank: 'SBI',
        psp: 'GPay',
        flow: amount <= 500 ? 'UPI_LITE' : 'UPI_INTENT',
        status: 'PENDING',
        latencyMs: 1200,
        riskScore: 18
      })
    });
    setEvents([created, ...events]);
  }

  async function removeEvent(id: string) {
    await apiRequest<void>('/payment-events/' + id, role, { method: 'DELETE' });
    setEvents(events.filter((event) => event.id !== id));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><img src="/logo.svg" alt="" /><span>UPI FlowPilot</span></div>
        {['Overview', 'Flows', 'Transactions', 'Reliability', 'Routing Rules', 'Banks and PSPs', 'Alerts', 'Simulator'].map((item, index) => (
          <button className={index === 0 ? 'nav-item active' : 'nav-item'} key={item}><Route size={16} />{item}</button>
        ))}
        <div className="region-card"><span>Region</span><strong>Bharat</strong><small>Live synthetic UPI network</small></div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <h1>Real-time UPI Checkout Reliability</h1>
            <p>Flow selection, retry intelligence, UPI Lite fallback, and bank degradation diagnosis.</p>
          </div>
          <div className="top-actions">
            <span className="live-dot">Live</span>
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>{roles.map((item) => <option key={item}>{item}</option>)}</select>
            <button onClick={load}><RefreshCw size={16} />Refresh</button>
          </div>
        </header>
        {error ? <div className="notice">{error}</div> : null}
        <section className="kpi-grid">
          <Metric title="Attempts" value={metrics.kpis.totalAttempts.toLocaleString('en-IN')} detail="+12.6% synthetic load" icon={<Activity />} />
          <Metric title="Success Rate" value={percent(metrics.kpis.successRate)} detail="best route model" icon={<ShieldCheck />} />
          <Metric title="Avg Latency" value={metrics.kpis.averageLatencyMs + ' ms'} detail="bank and PSP health" icon={<Radar />} />
          <Metric title="Leakage Watch" value={formatInr(revenueLeakage)} detail="failed value in table" icon={<Bell />} />
        </section>
        <section className="workspace-grid">
          <div className="panel span-two">
            <div className="panel-title"><GitBranch size={18} /> Smart Flow Recommendation</div>
            <div className="simulator-row">
              <label>Amount <input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
              <button onClick={simulate}><Sparkles size={16} />Simulate</button>
              <button onClick={createEvent}><Activity size={16} />Create Payment Event</button>
            </div>
            <div className="recommendation-card">
              <div>
                <span>Recommended Flow</span>
                <strong>{recommendation?.recommendedFlow || 'Run simulator'}</strong>
              </div>
              <div>
                <span>Success Probability</span>
                <strong>{recommendation ? percent(recommendation.successProbability) : '0%'}</strong>
              </div>
              <p>{recommendation?.merchantAction || 'The optimizer weighs payer bank health, collect decline history, amount, risk, and customer segment.'}</p>
            </div>
          </div>
          <div className="panel">
            <div className="panel-title"><Radar size={18} /> Failure Mix</div>
            {Object.entries(metrics.failureReasons).map(([reason, value]) => (
              <div className="bar-row" key={reason}><span>{reason}</span><div><i style={{ width: Math.min(value * 2, 100) + '%' }} /></div><b>{value}</b></div>
            ))}
          </div>
          <div className="panel span-three">
            <div className="panel-title"><Lock size={18} /> Payment Events CRUD</div>
            <div className="table">
              <div className="table-row header"><span>Merchant</span><span>Flow</span><span>Status</span><span>Amount</span><span>Latency</span><span>Action</span></div>
              {events.map((event) => (
                <div className="table-row" key={event.id}>
                  <span>{event.merchantId}</span><span>{event.flow}</span><span className={'status ' + event.status.toLowerCase()}>{event.status}</span><span>{formatInr(event.amount)}</span><span>{event.latencyMs} ms</span>
                  <span><button className="icon-button" onClick={() => void removeEvent(event.id)}><Trash2 size={15} /></button></span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="metric-card"><div>{icon}</div><span>{title}</span><strong>{value}</strong><small>{detail}</small></div>;
}

