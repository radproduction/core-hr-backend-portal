import { z } from "zod";
import { createHcmRole, getHcmRoles, getRolePermissions, upsertRolePermission } from "../db";
import { HCM_MODULES, PREDEFINED_ROLES } from "../rbac";
import { protectedProcedure, router } from "../_core/trpc";

export const rolesRouter = router({
  listPredefined: protectedProcedure.query(() => {
    return PREDEFINED_ROLES;
  }),

  listModules: protectedProcedure.query(() => {
    return HCM_MODULES;
  }),

  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return getHcmRoles(input.companyId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9_]+$/),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createHcmRole({ ...input, isPredefined: false });
      return { success: true };
    }),

  getPermissions: protectedProcedure
    .input(z.object({ hcmRoleId: z.number(), companyId: z.number() }))
    .query(async ({ input }) => {
      return getRolePermissions(input.hcmRoleId, input.companyId);
    }),

  setPermission: protectedProcedure
    .input(
      z.object({
        hcmRoleId: z.number(),
        companyId: z.number(),
        module: z.string(),
        canView: z.boolean().default(false),
        canCreate: z.boolean().default(false),
        canEdit: z.boolean().default(false),
        canDelete: z.boolean().default(false),
        canApprove: z.boolean().default(false),
        canExport: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      await upsertRolePermission(input);
      return { success: true };
    }),
});
