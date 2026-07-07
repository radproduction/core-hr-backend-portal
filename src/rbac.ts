import { TRPCError } from "@trpc/server";
import { getRolePermissions } from "./mongoDb";

// ─── HCM Module constants ─────────────────────────────────────────────────────
export const HCM_MODULES = [
  "employees",
  "leave",
  "attendance",
  "payroll",
  "expenses",
  "recruitment",
  "performance",
  "training",
  "assets",
  "documents",
  "announcements",
  "reports",
  "settings",
  "org_structure",
  "workflow",
  "notifications",
  "audit_logs",
  "roles",
  "dashboard",
  "access_management",
  "recruitment_requisition",
  "recruitment_shortlist",
  "recruitment_interview",
  "recruitment_offer",
] as const;

export type HcmModule = (typeof HCM_MODULES)[number];

export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

// ─── Six predefined CORE HR roles ─────────────────────────────────────────────────
export const PREDEFINED_ROLES = [
  {
    slug: "super_admin",
    name: "Super Admin",
    description: "Full access to all modules across all companies",
  },
  {
    slug: "hr_admin",
    name: "HR Admin",
    description: "Full access to all HR modules within the company",
  },
  {
    slug: "hr_manager",
    name: "HR Manager",
    description: "Manage employees, leave, attendance, and approvals",
  },
  {
    slug: "payroll_admin",
    name: "Payroll Admin",
    description: "Full payroll processing, salary structures, expenses; read-only employees",
  },
  {
    slug: "department_manager",
    name: "Department Manager",
    description: "View and approve requests for their department",
  },
  {
    slug: "employee",
    name: "Employee",
    description: "Self-service access: own profile, leave, attendance",
  },
  {
    slug: "viewer",
    name: "Viewer / Read-Only",
    description: "Read-only access to permitted modules",
  },
] as const;

export type PredefinedRoleSlug = (typeof PREDEFINED_ROLES)[number]["slug"];

// Default permission matrix for predefined roles
export const DEFAULT_PERMISSIONS: Record<
  PredefinedRoleSlug,
  Partial<Record<HcmModule, Partial<Record<PermissionAction, boolean>>>>
> = {
  super_admin: Object.fromEntries(
    HCM_MODULES.map((m) => [m, { view: true, create: true, edit: true, delete: true, approve: true, export: true }])
  ) as Record<HcmModule, Record<PermissionAction, boolean>>,

  hr_admin: Object.fromEntries(
    HCM_MODULES.map((m) => [m, { view: true, create: true, edit: true, delete: m !== "audit_logs", approve: true, export: true }])
  ) as Record<HcmModule, Record<PermissionAction, boolean>>,

  hr_manager: {
    employees: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
    leave: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
    attendance: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
    payroll: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    expenses: { view: true, create: true, edit: false, delete: false, approve: true, export: true },
    recruitment: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
    performance: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
    training: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
    assets: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
    documents: { view: true, create: true, edit: true, delete: false, approve: false, export: true },
    announcements: { view: true, create: true, edit: true, delete: false, approve: false, export: false },
    reports: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    settings: { view: false },
    org_structure: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    workflow: { view: true, create: false, edit: false, delete: false, approve: true, export: false },
    notifications: { view: true },
    audit_logs: { view: true, export: true },
    roles: { view: true },
    dashboard: { view: true },
    access_management: { view: false },
    recruitment_requisition: { view: true, create: true, edit: true, delete: false, approve: true, export: false },
    recruitment_shortlist: { view: true, create: true, edit: true, delete: false, approve: true, export: false },
    recruitment_interview: { view: true, create: true, edit: true, delete: false, approve: true, export: false },
    recruitment_offer: { view: true, create: true, edit: true, delete: false, approve: true, export: false },
  },

  payroll_admin: {
    employees: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    leave: { view: false },
    attendance: { view: false },
    payroll: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
    expenses: { view: true, create: true, edit: true, delete: false, approve: true, export: true },
    recruitment: { view: false },
    performance: { view: false },
    training: { view: false },
    assets: { view: false },
    documents: { view: false },
    announcements: { view: false },
    reports: { view: true, create: false, edit: false, delete: false, approve: false, export: true },
    settings: { view: false },
    org_structure: { view: false },
    workflow: { view: false },
    notifications: { view: true },
    audit_logs: { view: false },
    roles: { view: false },
    dashboard: { view: true },
    access_management: { view: false },
    recruitment_requisition: { view: false },
    recruitment_shortlist: { view: false },
    recruitment_interview: { view: false },
    recruitment_offer: { view: false },
  },

  department_manager: {
    employees: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    leave: { view: true, create: true, edit: false, delete: false, approve: true, export: false },
    attendance: { view: true, create: false, edit: false, delete: false, approve: true, export: false },
    payroll: { view: false },
    expenses: { view: true, create: true, edit: false, delete: false, approve: true, export: false },
    recruitment: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    performance: { view: true, create: true, edit: true, delete: false, approve: true, export: false },
    training: { view: true, create: false, edit: false, delete: false, approve: true, export: false },
    assets: { view: true },
    documents: { view: true },
    announcements: { view: true },
    reports: { view: true, export: false },
    settings: { view: false },
    org_structure: { view: true },
    workflow: { view: true, approve: true },
    notifications: { view: true },
    audit_logs: { view: false },
    roles: { view: false },
    dashboard: { view: true },
    access_management: { view: false },
    recruitment_requisition: { view: true, create: true, edit: false, delete: false, approve: true, export: false },
    recruitment_shortlist: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    recruitment_interview: { view: true, create: true, edit: true, delete: false, approve: false, export: false },
    recruitment_offer: { view: false },
  },

  employee: {
    employees: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    leave: { view: true, create: true, edit: true, delete: false, approve: false, export: false },
    attendance: { view: true, create: true, edit: false, delete: false, approve: false, export: false },
    payroll: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    expenses: { view: true, create: true, edit: false, delete: false, approve: false, export: false },
    recruitment: { view: false },
    performance: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    training: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
    assets: { view: true },
    documents: { view: true, create: true, edit: false, delete: false, approve: false, export: false },
    announcements: { view: true },
    reports: { view: false },
    settings: { view: false },
    org_structure: { view: true },
    workflow: { view: true, create: true },
    notifications: { view: true },
    audit_logs: { view: false },
    roles: { view: false },
    dashboard: { view: true },
    access_management: { view: false },
    recruitment_requisition: { view: false },
    recruitment_shortlist: { view: false },
    recruitment_interview: { view: false },
    recruitment_offer: { view: false },
  },

  viewer: Object.fromEntries(
    HCM_MODULES.map((m) => [m, { view: true, create: false, edit: false, delete: false, approve: false, export: false }])
  ) as Record<HcmModule, Record<PermissionAction, boolean>>,
};

// ─── Runtime permission check ─────────────────────────────────────────────────

/**
 * Check if a given HCM role has permission for a module+action.
 * Falls back to predefined defaults if no DB row exists.
 */
export async function checkPermission(
  hcmRoleId: number,
  roleSlug: string,
  companyId: number,
  module: HcmModule,
  action: PermissionAction
): Promise<boolean> {
  // Super admin always passes
  if (roleSlug === "super_admin") return true;

  // Try DB-stored permissions first
  try {
    const perms = await getRolePermissions(hcmRoleId, companyId);
    const modulePerm = perms.find((p) => p.module === module);
    if (modulePerm) {
      const key = `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as keyof typeof modulePerm;
      return Boolean(modulePerm[key]);
    }
  } catch {
    // Fall through to defaults
  }

  // Fall back to predefined defaults
  const slug = roleSlug as PredefinedRoleSlug;
  const defaults = DEFAULT_PERMISSIONS[slug];
  if (!defaults) return false;
  const moduleDef = defaults[module];
  if (!moduleDef) return false;
  return Boolean(moduleDef[action]);
}

/**
 * tRPC middleware factory — throws FORBIDDEN if the caller lacks the permission.
 * Usage: protectedProcedure.use(requirePermission("employees", "create"))
 */
export function requirePermission(module: HcmModule, action: PermissionAction) {
  return async ({ ctx, next }: { ctx: { user: { id: number } | null; companyId?: number; hcmRoleId?: number; hcmRoleSlug?: string }; next: () => Promise<unknown> }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    const companyId = ctx.companyId ?? 0;
    const hcmRoleId = ctx.hcmRoleId ?? 0;
    const hcmRoleSlug = ctx.hcmRoleSlug ?? "employee";
    const allowed = await checkPermission(hcmRoleId, hcmRoleSlug, companyId, module, action);
    if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: `Permission denied: ${module}.${action}` });
    return next();
  };
}
