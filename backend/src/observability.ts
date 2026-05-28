import type { Express } from 'express';

type OperationalInfo = {
  service: string;
  port: number;
};

const startedAt = new Date();

function prometheusLabel(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function registerOperationalEndpoints(app: Express, info: OperationalInfo) {
  app.get('/api/live', (_req, res) => {
    res.json({
      status: 'live',
      service: info.service,
      uptimeSeconds: Math.round(process.uptime()),
      startedAt: startedAt.toISOString()
    });
  });

  app.get('/api/ready', (_req, res) => {
    res.json({
      status: 'ready',
      service: info.service,
      checks: {
        api: 'ok',
        persistence: process.env.DB_FILE ? 'json-file-configured' : 'in-memory-or-default-json',
        mockUpiRail: 'ok'
      },
      generatedAt: new Date().toISOString()
    });
  });

  app.get('/api/metrics/prometheus', (_req, res) => {
    const memory = process.memoryUsage();
    const labels = `service="${prometheusLabel(info.service)}",port="${info.port}"`;
    res.type('text/plain').send([
      '# HELP upi_service_info Static service metadata for the UPI AI prototype.',
      '# TYPE upi_service_info gauge',
      `upi_service_info{${labels}} 1`,
      '# HELP upi_process_uptime_seconds Node.js process uptime.',
      '# TYPE upi_process_uptime_seconds gauge',
      `upi_process_uptime_seconds{${labels}} ${process.uptime().toFixed(3)}`,
      '# HELP upi_process_resident_memory_bytes Resident memory size.',
      '# TYPE upi_process_resident_memory_bytes gauge',
      `upi_process_resident_memory_bytes{${labels}} ${memory.rss}`,
      '# HELP upi_process_heap_used_bytes V8 heap used.',
      '# TYPE upi_process_heap_used_bytes gauge',
      `upi_process_heap_used_bytes{${labels}} ${memory.heapUsed}`
    ].join('\n') + '\n');
  });
}
