# UPI FlowPilot Design

## Product Thesis

A payment reliability command center that recommends UPI Intent, QR, Collect, Lite, retry, or risk decline paths using success prediction, bank/PSP degradation signals, and GenAI-style operational explanations.

## UX

The first screen is the usable operations console. It avoids a landing page and starts directly with role-aware KPIs, command actions, CRUD tables, and a model explanation panel.

## Backend

Express provides validated JSON APIs, demo RBAC, rate limits, security headers, and synthetic persistence.

## Frontend

React provides a responsive SaaS dashboard with rich colors, logo, animations, role switcher, and domain-specific action flows.

## Testing

Vitest validates API behavior, RBAC, CRUD, and frontend view helpers.

