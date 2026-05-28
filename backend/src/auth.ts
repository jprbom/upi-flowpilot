import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Express } from 'express';
import type { NextFunction, Request, Response } from 'express';

export type Role = 'ADMIN' | 'OPS_MANAGER' | 'MERCHANT_ANALYST' | 'SUPPORT_AGENT' | 'VIEWER';
export type Permission = 'read' | 'write' | 'admin';

const roles = ["ADMIN","OPS_MANAGER","MERCHANT_ANALYST","SUPPORT_AGENT","VIEWER"] as Role[];
const defaultRole: Role = 'VIEWER';
const permissionsByRole: Record<Role, Permission[]> = {
  "ADMIN": [
    "read",
    "write",
    "admin"
  ],
  "OPS_MANAGER": [
    "read",
    "write"
  ],
  "MERCHANT_ANALYST": [
    "read"
  ],
  "SUPPORT_AGENT": [
    "read",
    "write"
  ],
  "VIEWER": [
    "read"
  ]
};

type DemoTokenPayload = {
  sub: string;
  tenantId: string;
  role: Role;
  iat: number;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function authSecret() {
  return process.env.DEMO_AUTH_SECRET || 'upi-flowpilot-local-demo-secret';
}

function sign(input: string) {
  return createHmac('sha256', authSecret()).update(input).digest('base64url');
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && roles.includes(value as Role);
}

export function signDemoToken(role: Role, tenantId = 'tenant_demo_bfsi', subject = 'prashant.demo') {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'local-demo' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(JSON.stringify({
    sub: subject,
    tenantId,
    role,
    iat: now,
    exp: now + 60 * 60
  } satisfies DemoTokenPayload));
  const body = header + '.' + payload;
  return body + '.' + sign(body);
}

function verifyDemoToken(token: string): DemoTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const body = parts[0] + '.' + parts[1];
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const payload = JSON.parse(base64UrlDecode(parts[1])) as DemoTokenPayload;
  if (!isRole(payload.role)) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function registerAuthRoutes(app: Express) {
  app.post('/api/auth/demo-token', (req, res) => {
    const requestedRole = req.body?.role;
    if (!isRole(requestedRole)) {
      res.status(400).json({ error: 'INVALID_ROLE', roles });
      return;
    }
    const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId : 'tenant_demo_bfsi';
    res.json({
      tokenType: 'Bearer',
      expiresInSeconds: 3600,
      token: signDemoToken(requestedRole, tenantId),
      principal: {
        subject: 'prashant.demo',
        tenantId,
        role: requestedRole,
        permissions: permissionsByRole[requestedRole]
      }
    });
  });
}

export function getRequestRole(req: Request): Role {
  const authorization = req.header('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (match) {
    const payload = verifyDemoToken(match[1]);
    if (payload) return payload.role;
  }
  return defaultRole;
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = getRequestRole(req);
    if (!permissionsByRole[role].includes(permission)) {
      res.status(403).json({
        error: 'RBAC_DENIED',
        message: 'Role ' + role + ' cannot perform ' + permission + ' operations.',
        role
      });
      return;
    }
    next();
  };
}

export function roleCatalogue() {
  return roles.map((role) => ({
    role,
    permissions: permissionsByRole[role]
  }));
}
