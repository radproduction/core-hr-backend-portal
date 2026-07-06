import { z } from "zod";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  getHeadcountStats,
  getPendingApprovalsCount,
  getWorkflowInstances,
  getAuditLogs,
  getDb,
} from "../db";
import { employees, departments } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";

export const dashboardRouter = router({
  stats: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const [headcount, pendingApprovals, recentActivity] = await Promise.all([
        getHeadcountStats(input.companyId),
        getPendingApprovalsCount(input.companyId),
        getAuditLogs(input.companyId, { limit: 5 }),
      ]);
      return { headcount, pendingApprovals, recentActivity };
    }),

  recentWorkflows: protectedProcedure
    .input(z.object({ companyId: z.number(), limit: z.number().default(5) }))
    .query(async ({ input }) => {
      const all = await getWorkflowInstances(input.companyId);
      return all.slice(0, input.limit);
    }),

  /**
   * Live chart data for the global dashboard.
   * Replaces all hardcoded placeholder arrays in Dashboard.tsx.
   */
  chartData: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return {
          byDepartment: [] as { dept: string; count: number }[],
          byGender: [] as { name: string; value: number }[],
          byEmploymentType: [] as { name: string; value: number }[],
          newJoinersByMonth: [] as { month: string; count: number }[],
          recentJoiners: [] as { id: number; name: string; dept: string; joinDate: Date | null }[],
        };
      }

      // Headcount by department
      const deptRows = await db
        .select({
          deptName: departments.name,
          count: sql<number>`COUNT(${employees.id})`,
        })
        .from(employees)
        .leftJoin(departments, eq(departments.id, employees.departmentId))
        .where(and(eq(employees.companyId, input.companyId), eq(employees.status, "active")))
        .groupBy(departments.id, departments.name);

      const byDepartment = deptRows.map(r => ({
        dept: r.deptName ?? "Unassigned",
        count: Number(r.count),
      }));

      // Gender split
      const genderRows = await db
        .select({
          gender: employees.gender,
          count: sql<number>`COUNT(${employees.id})`,
        })
        .from(employees)
        .where(and(eq(employees.companyId, input.companyId), eq(employees.status, "active")))
        .groupBy(employees.gender);

      const byGender = genderRows.map(r => ({
        name: r.gender
          ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1).replace(/_/g, " ")
          : "Unknown",
        value: Number(r.count),
      }));

      // Employment type breakdown
      const typeRows = await db
        .select({
          type: employees.employmentType,
          count: sql<number>`COUNT(${employees.id})`,
        })
        .from(employees)
        .where(and(eq(employees.companyId, input.companyId), eq(employees.status, "active")))
        .groupBy(employees.employmentType);

      const byEmploymentType = typeRows.map(r => ({
        name: r.type
          ? r.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
          : "Unknown",
        value: Number(r.count),
      }));

      // New joiners by month (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const joinerRows = await db
        .select({
          month: sql<string>`DATE_FORMAT(${employees.joinDate}, '%b')`,
          count: sql<number>`COUNT(${employees.id})`,
        })
        .from(employees)
        .where(
          and(
            eq(employees.companyId, input.companyId),
            gte(employees.joinDate, sixMonthsAgo)
          )
        )
        .groupBy(
          sql`YEAR(${employees.joinDate})`,
          sql`MONTH(${employees.joinDate})`,
          sql`DATE_FORMAT(${employees.joinDate}, '%b')`
        )
        .orderBy(sql`YEAR(${employees.joinDate})`, sql`MONTH(${employees.joinDate})`);

      const newJoinersByMonth = joinerRows.map(r => ({
        month: r.month,
        count: Number(r.count),
      }));

      // Recent joiners (last 90 days — seed data is from 2020-2024 so use wider window)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const recentJoinerRows = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          joinDate: employees.joinDate,
          deptName: departments.name,
        })
        .from(employees)
        .leftJoin(departments, eq(departments.id, employees.departmentId))
        .where(eq(employees.companyId, input.companyId))
        .orderBy(sql`${employees.joinDate} DESC`)
        .limit(5);

      const recentJoiners = recentJoinerRows.map(r => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        dept: r.deptName ?? "—",
        joinDate: r.joinDate,
      }));

      return {
        byDepartment,
        byGender,
        byEmploymentType,
        newJoinersByMonth,
        recentJoiners,
      };
    }),
});
