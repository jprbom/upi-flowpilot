# API Reference

Base URL: http://127.0.0.1:4101

Authentication model: signed local demo bearer tokens from `POST /api/auth/demo-token`. Raw `x-user-role` headers are ignored for authorization.

## Health

GET /api/health

Returns service status, author, and role catalogue.

## Metrics

GET /api/metrics

Returns operational KPIs for the dashboard.

## Auth

POST /api/auth/demo-token

Returns a one-hour signed local demo bearer token for one of the documented RBAC roles.

## Payment Ecosystem Simulator

POST /api/payments/initiate
GET /api/payments/:id/status
POST /api/payments/:id/simulate-event
GET /api/payments/:id/timeline
GET /api/reconciliation/batches
POST /api/refunds/initiate
POST /api/disputes/raise
POST /api/webhooks/payment-gateway
POST /api/webhooks/payment-aggregator
POST /api/webhooks/tpap
POST /api/webhooks/npci

These endpoints simulate PG checkout, PA payment attempts, TPAP app authorization, PSP/bank outcomes, NPCI-style UPI rail states, HMAC webhooks, settlement, refunds, disputes, duplicate delivery, and out-of-order webhook handling.

## Domain Intelligence

POST /api/recommendations

Returns a recommendation, score, action, reason codes, and plain-language explanation for the product domain.

## CRUD

This repository implements list, create, update, and delete operations for payment events and routing rules. Write endpoints require write permission. Delete endpoints require admin permission.
