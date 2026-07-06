import { z } from "zod";
import { createAuditLog, getAuditLogs } from "../mongoDb";
import { protectedProcedure, router } from "../_core/trpc";

export const auditRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        module: z.string().optional(),
        actorEmployeeId: z.number().optional(),
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      const { companyId, ...filters } = input;
      return getAuditLogs(companyId, filters);
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        actorEmployeeId: z.number().optional(),
        actorUserId: z.number().optional(),
        actorName: z.string().optional(),
        action: z.string().min(1),
        module: z.string().min(1),
        entityType: z.string().min(1),
        entityId: z.number().optional(),
        entityLabel: z.string().optional(),
        before: z.record(z.string(), z.unknown()).optional(),
        after: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ipAddress = (ctx.req as { ip?: string })?.ip ?? undefined;
      const userAgent = (ctx.req as { headers?: { "user-agent"?: string } })?.headers?.["user-agent"] ?? undefined;
      await createAuditLog({ ...input, ipAddress, userAgent });
      return { success: true };
    }),
});
