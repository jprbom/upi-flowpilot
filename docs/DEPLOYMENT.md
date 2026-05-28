# Deployment

For local Docker and cloud reference architecture, see [`ENTERPRISE_DEPLOYMENT.md`](ENTERPRISE_DEPLOYMENT.md).

## Enterprise Cloud Pattern

- Frontend: CDN or managed static web hosting.
- API: containerized service on Kubernetes, ECS, Cloud Run, or App Service.
- Database: managed PostgreSQL with PITR backups.
- Cache/session/rate limits: managed Redis.
- Events: managed Kafka/Pub/Sub/Event Hubs/SQS.
- Secrets: cloud KMS/Secrets Manager/Key Vault.
- Observability: OpenTelemetry, Prometheus, Grafana, and centralized logs.
- Security: WAF, private networking, workload identity, image scanning, IaC scanning, and SAST.

## Release Flow

```text
commit -> CI verify -> unit tests -> E2E smoke -> audit -> image build -> scan -> deploy staging -> smoke -> approve -> deploy production
```

