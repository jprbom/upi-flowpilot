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

export function getRequestRole(req: Request): Role {
  const headerRole = req.header('x-user-role');
  if (headerRole && roles.includes(headerRole as Role)) {
    return headerRole as Role;
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
