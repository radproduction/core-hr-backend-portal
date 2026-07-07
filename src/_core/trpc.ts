import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { checkPermission, type HcmModule, type PermissionAction } from "../rbac";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Super Admin only. RBAC is resolved in createContext → ctx.hcmRoleSlug,
 * which maps the owner (`user.role === "admin"`) and any user assigned the
 * `super_admin` HCM role to "super_admin".
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.hcmRoleSlug !== "super_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }
  return next();
});

/** Super Admin or HR Admin — for company-wide HR operations. */
export const hrAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.hcmRoleSlug !== "super_admin" && ctx.hcmRoleSlug !== "hr_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Requires HR Admin or Super Admin" });
  }
  return next();
});

/**
 * Permission-gated procedure. Enforces the caller's role has `action` on
 * `module` per the RBAC matrix (DB overrides → predefined defaults).
 * Usage: permissionProcedure("payroll", "create").mutation(...)
 */
export function permissionProcedure(module: HcmModule, action: PermissionAction) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const allowed = await checkPermission(
      ctx.hcmRoleId,
      ctx.hcmRoleSlug,
      ctx.companyId,
      module,
      action
    );
    if (!allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Permission denied: ${module}.${action}` });
    }
    return next();
  });
}
