/**
 * accessRouter.ts — User & Access Management tRPC router
 * Sub-routers: users, roles, permissions, overrides, dataScope, audit
 * All write operations require super_admin or hr_admin role.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { HCM_MODULES, PREDEFINED_ROLES } from "../rbac";
import {
  assignUserRole,
  cloneHcmRole,
  createHcmRoleExtended,
  createUserProfile,
  deactivateUserProfile,
  deleteHcmRole,
  deleteUserPermissionOverride,
  getEffectivePermissions,
  getHcmRole,
  getRolePermissionMatrix,
  getUserAccessProfile,
  getUserDataScope,
  getUserPermissionOverrides,
  getUserProfile,
  getUserRoles,
  listHcmRoles,
  listUserProfiles,
  revokeUserRole,
  setRolePermission,
  setUserRoles,
  updateHcmRole,
  updateUserProfile,
  upsertUserAccessProfile,
  upsertUserPermissionOverride,
  writeAccessAuditLog,
} from "../mongoDb";
import { protectedProcedure, router } from "../_core/trpc";

const COMPANY_ID = 1; // TODO: derive from ctx when multi-tenant is wired

// ─── Guard: only super_admin or hr_admin ──────────────────────────────────────
async function assertAdminAccess(ctx: { user: { id: number } | null }) {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  // For now, all authenticated users can access — real enforcement via requirePermission middleware
  // In production, check ctx.hcmRoleSlug here
}

// ─── Users sub-router ─────────────────────────────────────────────────────────
const usersRouter = router({
  list: protectedProcedure.query(async () => {
    return listUserProfiles(COMPANY_ID);
  }),

  get: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return getUserProfile(input.userId, COMPANY_ID);
    }),

  create: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        employeeId: z.number().optional(),
        isActive: z.boolean().default(true),
        roleIds: z.array(z.number()).default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const existing = await getUserProfile(input.userId, COMPANY_ID);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "User profile already exists" });
      await createUserProfile({
        userId: input.userId,
        companyId: COMPANY_ID,
        employeeId: input.employeeId,
        isActive: input.isActive,
      });
      if (input.roleIds.length > 0) {
        await setUserRoles(input.userId, COMPANY_ID, input.roleIds, ctx.user!.id);
      }
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "create_user",
        entityType: "user",
        entityId: input.userId,
        after: input,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        employeeId: z.number().optional().nullable(),
        isActive: z.boolean().optional(),
        roleIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const before = await getUserProfile(input.userId, COMPANY_ID);
      const profile = await getUserProfile(input.userId, COMPANY_ID);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      await updateUserProfile(profile.id, {
        employeeId: input.employeeId ?? undefined,
        isActive: input.isActive,
      });
      if (input.roleIds !== undefined) {
        await setUserRoles(input.userId, COMPANY_ID, input.roleIds, ctx.user!.id);
      }
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "update_user",
        entityType: "user",
        entityId: input.userId,
        before,
        after: input,
      });
      return { success: true };
    }),

  deactivate: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      await deactivateUserProfile(input.userId, COMPANY_ID);
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "deactivate_user",
        entityType: "user",
        entityId: input.userId,
      });
      return { success: true };
    }),

  getRoles: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return getUserRoles(input.userId, COMPANY_ID);
    }),

  setRoles: protectedProcedure
    .input(z.object({ userId: z.number(), roleIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const before = await getUserRoles(input.userId, COMPANY_ID);
      await setUserRoles(input.userId, COMPANY_ID, input.roleIds, ctx.user!.id);
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "set_user_roles",
        entityType: "user",
        entityId: input.userId,
        before,
        after: { roleIds: input.roleIds },
      });
      return { success: true };
    }),

  getEffectivePermissions: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return getEffectivePermissions(input.userId, COMPANY_ID);
    }),

  myPermissions: protectedProcedure.query(async ({ ctx }) => {
    return getEffectivePermissions(ctx.user!.id, COMPANY_ID);
  }),

  // Password invite — in dev mode returns a mock link; in prod would send email
  sendInvite: protectedProcedure
    .input(z.object({ userId: z.number(), email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const profile = await getUserProfile(input.userId, COMPANY_ID);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      await updateUserProfile(profile.id, { inviteSentAt: new Date() });
      const isDev = process.env.NODE_ENV !== "production";
      const inviteLink = isDev
        ? `[DEV MODE] Invite link for ${input.email}: https://app.example.com/set-password?token=dev-mock-token-${input.userId}`
        : null; // In prod, send via email service
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "send_invite",
        entityType: "user",
        entityId: input.userId,
        after: { email: input.email },
      });
      return { success: true, devInviteLink: inviteLink };
    }),
});

// ─── Roles sub-router ─────────────────────────────────────────────────────────
const rolesRouter = router({
  list: protectedProcedure.query(async () => {
    return listHcmRoles(COMPANY_ID);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getHcmRole(input.id);
    }),

  listPredefined: protectedProcedure.query(() => {
    return PREDEFINED_ROLES;
  }),

  listModules: protectedProcedure.query(() => {
    return HCM_MODULES;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const result = await createHcmRoleExtended({
        companyId: COMPANY_ID,
        name: input.name,
        slug: input.slug,
        description: input.description,
        isPredefined: false,
        isActive: true,
      });
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "create_role",
        entityType: "hcmRole",
        entityId: result.id,
        entityLabel: input.name,
        after: input,
      });
      return { success: true, id: result.id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const before = await getHcmRole(input.id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      // Prevent editing locked predefined slugs
      const LOCKED_SLUGS = ["super_admin"];
      if (LOCKED_SLUGS.includes(before.slug)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Super Admin role cannot be modified" });
      }
      await updateHcmRole(input.id, { name: input.name, description: input.description, isActive: input.isActive });
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "update_role",
        entityType: "hcmRole",
        entityId: input.id,
        entityLabel: before.name,
        before,
        after: input,
      });
      return { success: true };
    }),

  clone: protectedProcedure
    .input(
      z.object({
        sourceRoleId: z.number(),
        newName: z.string().min(1).max(100),
        newSlug: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const result = await cloneHcmRole(input.sourceRoleId, input.newName, input.newSlug, COMPANY_ID);
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "clone_role",
        entityType: "hcmRole",
        entityId: result.id,
        entityLabel: input.newName,
        after: input,
      });
      return { success: true, id: result.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const role = await getHcmRole(input.id);
      if (!role) throw new TRPCError({ code: "NOT_FOUND" });
      if (role.slug === "super_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Super Admin role cannot be deleted" });
      }
      await deleteHcmRole(input.id);
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "delete_role",
        entityType: "hcmRole",
        entityId: input.id,
        entityLabel: role.name,
        before: role,
      });
      return { success: true };
    }),
});

// ─── Permissions sub-router ───────────────────────────────────────────────────
const permissionsRouter = router({
  getMatrix: protectedProcedure
    .input(z.object({ hcmRoleId: z.number() }))
    .query(async ({ input }) => {
      return getRolePermissionMatrix(input.hcmRoleId, COMPANY_ID);
    }),

  setPermission: protectedProcedure
    .input(
      z.object({
        hcmRoleId: z.number(),
        module: z.string(),
        canView: z.boolean().default(false),
        canCreate: z.boolean().default(false),
        canEdit: z.boolean().default(false),
        canDelete: z.boolean().default(false),
        canApprove: z.boolean().default(false),
        canExport: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const before = await getRolePermissionMatrix(input.hcmRoleId, COMPANY_ID);
      await setRolePermission({ ...input, companyId: COMPANY_ID });
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "set_role_permission",
        entityType: "rolePermission",
        entityId: input.hcmRoleId,
        entityLabel: `role:${input.hcmRoleId} module:${input.module}`,
        before: before.find((permission: any) => permission.module === input.module),
        after: input,
      });
      return { success: true };
    }),

  setBulkPermissions: protectedProcedure
    .input(
      z.object({
        hcmRoleId: z.number(),
        permissions: z.array(
          z.object({
            module: z.string(),
            canView: z.boolean().default(false),
            canCreate: z.boolean().default(false),
            canEdit: z.boolean().default(false),
            canDelete: z.boolean().default(false),
            canApprove: z.boolean().default(false),
            canExport: z.boolean().default(false),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      for (const perm of input.permissions) {
        await setRolePermission({ ...perm, hcmRoleId: input.hcmRoleId, companyId: COMPANY_ID });
      }
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "bulk_set_permissions",
        entityType: "rolePermission",
        entityId: input.hcmRoleId,
        after: { count: input.permissions.length },
      });
      return { success: true };
    }),
});

// ─── Overrides sub-router ─────────────────────────────────────────────────────
const overridesRouter = router({
  list: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return getUserPermissionOverrides(input.userId, COMPANY_ID);
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        module: z.string(),
        action: z.string(),
        granted: z.boolean(),
        reason: z.string().optional(),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      await upsertUserPermissionOverride({
        userId: input.userId,
        companyId: COMPANY_ID,
        module: input.module,
        action: input.action,
        granted: input.granted,
        reason: input.reason,
        grantedBy: ctx.user!.id,
        expiresAt: input.expiresAt,
      });
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: input.granted ? "grant_override" : "revoke_override",
        entityType: "userPermissionOverride",
        entityId: input.userId,
        entityLabel: `user:${input.userId} ${input.module}.${input.action}`,
        after: input,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number(), userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      await deleteUserPermissionOverride(input.id);
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "delete_override",
        entityType: "userPermissionOverride",
        entityId: input.userId,
      });
      return { success: true };
    }),
});

// ─── Data Scope sub-router ────────────────────────────────────────────────────
const dataScopeRouter = router({
  get: protectedProcedure
    .input(z.object({ userId: z.number(), hcmRoleId: z.number() }))
    .query(async ({ input }) => {
      return getUserAccessProfile(input.userId, COMPANY_ID, input.hcmRoleId);
    }),

  getUserScope: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return getUserDataScope(input.userId, COMPANY_ID);
    }),

  set: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        hcmRoleId: z.number(),
        dataScope: z.enum(["self", "reports", "department", "company", "custom"]),
        scopeConfig: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertAdminAccess(ctx);
      const before = await getUserAccessProfile(input.userId, COMPANY_ID, input.hcmRoleId);
      await upsertUserAccessProfile({
        userId: input.userId,
        companyId: COMPANY_ID,
        hcmRoleId: input.hcmRoleId,
        dataScope: input.dataScope,
        scopeConfig: input.scopeConfig,
      });
      await writeAccessAuditLog({
        companyId: COMPANY_ID,
        actorUserId: ctx.user!.id,
        action: "set_data_scope",
        entityType: "userAccessProfile",
        entityId: input.userId,
        entityLabel: `user:${input.userId} role:${input.hcmRoleId}`,
        before,
        after: input,
      });
      return { success: true };
    }),
});

// ─── Root access router ───────────────────────────────────────────────────────
export const accessRouter = router({
  users: usersRouter,
  roles: rolesRouter,
  permissions: permissionsRouter,
  overrides: overridesRouter,
  dataScope: dataScopeRouter,
});
