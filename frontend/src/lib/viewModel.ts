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

