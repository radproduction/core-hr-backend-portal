import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getEmployeeByUserId, getUserRoles } from "../mongoDb";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** Active company (single-tenant for now). */
  companyId: number;
  /** Resolved HCM role slug for the caller (drives RBAC). */
  hcmRoleSlug: string;
  /** hcmRoles.id of the caller's active role (0 if none). */
  hcmRoleId: number;
  /** Employee record id linked to this user (null if not linked) — used for self scope. */
  employeeId: number | null;
  /** Department of the linked employee — used for team/department scope. */
  departmentId: number | null;
};

const DEFAULT_COMPANY_ID = 1;

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const companyId = DEFAULT_COMPANY_ID;
  let hcmRoleSlug = "employee";
  let hcmRoleId = 0;
  let employeeId: number | null = null;
  let departmentId: number | null = null;

  if (user) {
    const isOwnerAdmin = (user as unknown as { role?: string }).role === "admin";
    try {
      const roles = await getUserRoles(user.id, companyId);
      const primary = roles.find((r: { isActive?: boolean }) => r.isActive) ?? roles[0];
      if (primary?.roleSlug) {
        hcmRoleSlug = primary.roleSlug;
        hcmRoleId = primary.hcmRoleId ?? 0;
      } else if (isOwnerAdmin) {
        hcmRoleSlug = "super_admin";
      }

      const emp = await getEmployeeByUserId(user.id, companyId);
      if (emp) {
        employeeId = emp.id ?? null;
        departmentId = emp.departmentId ?? null;
      }
    } catch {
      if (isOwnerAdmin) hcmRoleSlug = "super_admin";
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    companyId,
    hcmRoleSlug,
    hcmRoleId,
    employeeId,
    departmentId,
  };
}
