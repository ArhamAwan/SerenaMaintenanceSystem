import type { RoleKey, User, WorkOrder } from './types';

export type Permission =
  | 'dashboard.exec'
  | 'wo.view_all'
  | 'wo.create'
  | 'wo.assign'
  | 'wo.review'
  | 'wo.execute'
  | 'wo.cancel'
  | 'asset.view'
  | 'asset.manage'
  | 'plan.manage'
  | 'template.manage'
  | 'fault.report'
  | 'employee.view'
  | 'employee.manage'
  | 'audit.view'
  | 'settings.manage';

// Seeded permission policy. In production these rows live in Roles/Permissions/UserRoles tables
// and are editable by a Super Administrator; the server enforces them on every request.
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  admin: [
    'dashboard.exec', 'wo.view_all', 'wo.create', 'asset.view', 'asset.manage', 'plan.manage',
    'template.manage', 'fault.report', 'employee.view', 'employee.manage', 'audit.view', 'settings.manage',
  ],
  manager: [
    'dashboard.exec', 'wo.view_all', 'wo.create', 'wo.assign', 'wo.review', 'wo.cancel', 'asset.view', 'asset.manage',
    'plan.manage', 'template.manage', 'fault.report', 'employee.view', 'audit.view',
  ],
  supervisor: [
    'wo.view_all', 'wo.create', 'wo.assign', 'wo.review', 'wo.cancel', 'asset.view', 'plan.manage', 'template.manage',
    'fault.report', 'employee.view',
  ],
  technician: ['wo.execute', 'asset.view', 'fault.report'],
  requester: ['fault.report'],
};

export const ROLE_LABEL: Record<RoleKey, string> = {
  admin: 'Super Administrator',
  manager: 'Chief Engineer',
  supervisor: 'Engineering Supervisor',
  technician: 'Maintenance Technician',
  requester: 'Department Manager',
};

export function can(user: User | null | undefined, p: Permission): boolean {
  if (!user || user.status !== 'active') return false;
  return ROLE_PERMISSIONS[user.role].includes(p);
}

/** Resource-level check: may this user see this work order? */
export function canViewWO(user: User, wo: WorkOrder): boolean {
  if (wo.propertyId !== user.propertyId) return false; // property isolation
  if (can(user, 'wo.view_all')) return true;
  if (wo.requestedById === user.id) return true;
  if (user.role === 'technician') return wo.leadTechId === user.id || wo.helperIds.includes(user.id);
  if (user.role === 'requester') return wo.requestedById === user.id;
  return false;
}
