import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { orgRouter } from "./routers/org";
import { employeesRouter } from "./routers/employeesRouter";
import { rolesRouter } from "./routers/roles";
import { workflowRouter } from "./routers/workflow";
import { notificationsRouter } from "./routers/notificationsRouter";
import { auditRouter } from "./routers/auditRouter";
import { dashboardRouter } from "./routers/dashboardRouter";
import { aiRouter } from "./routers/aiRouter";
import { attendanceRouter } from "./routers/attendanceRouter";
import { leaveRouter } from "./routers/leaveRouter";
import { payrollRouter } from "./routers/payrollRouter";
import { recruitmentRouter } from "./routers/recruitmentRouter";
import { accessRouter } from "./routers/accessRouter";
import { performanceRouter } from "./routers/performanceRouter";
import { aiAssistantRouter } from "./routers/aiAssistantRouter";
import { selfServiceRouter } from "./routers/selfServiceRouter";
import { expenseRouter } from "./routers/expenseRouter";
import { getUserRoles } from "./accessDb";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    /**
     * Returns the current user enriched with their HCM role slug.
     * The hcmRoleSlug drives sidebar visibility and feature gating on the frontend.
     * Falls back to "super_admin" for Manus admin users and "employee" for everyone else
     * when no explicit HCM role assignment exists.
     */
    me: publicProcedure.query(async (opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      // Enrich with the primary active HCM role slug
      try {
        const roles = await getUserRoles(user.id, 1);
        const primaryRole = roles.find(r => r.isActive);
        return {
          ...user,
          hcmRoleSlug: primaryRole?.roleSlug ?? (user.role === "admin" ? "super_admin" : "employee"),
        };
      } catch {
        // DB unavailable — fall back gracefully
        return {
          ...user,
          hcmRoleSlug: user.role === "admin" ? "super_admin" : "employee",
        };
      }
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ─── HCM Feature Routers ────────────────────────────────────────────────────
  org: orgRouter,
  employees: employeesRouter,
  roles: rolesRouter,
  workflow: workflowRouter,
  notifications: notificationsRouter,
  audit: auditRouter,
  dashboard: dashboardRouter,
  ai: aiRouter,
  attendance: attendanceRouter,
  leave: leaveRouter,
  payroll: payrollRouter,
  recruitment: recruitmentRouter,
  access: accessRouter,
  performance: performanceRouter,
  assistant: aiAssistantRouter,
  selfService: selfServiceRouter,
  expense: expenseRouter,
});

export type AppRouter = typeof appRouter;
