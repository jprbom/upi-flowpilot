export function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

export function percent(value: number) {
  return Math.round(value * 1000) / 10 + '%';
}

export function scoreTone(score: number) {
  if (score >= 80 || score >= 760) return 'critical';
  if (score >= 60 || score >= 680) return 'warning';
  return 'healthy';
}

export function toneForRisk(value: number) {
  return scoreTone(value);
}

export function formatValue(key: string, value: unknown) {
  if (typeof value === 'number' && /rate|ratio|probability/i.test(key) && value >= 0 && value <= 1) {
    return percent(value);
  }
  if (typeof value === 'number' && /amount|limit|inflow|outflow|threshold|value/i.test(key)) {
    return formatInr(value);
  }
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value ?? '');
}
