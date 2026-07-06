import { z } from "zod";
import {
  getAuditLogs,
  getDepartments,
  getEmployees,
  getHeadcountStats,
  getPendingApprovalsCount,
  getWorkflowInstances,
} from "../mongoDb";
import { protectedProcedure, router } from "../_core/trpc";

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

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

  chartData: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const [employees, departments] = await Promise.all([
        getEmployees(input.companyId),
        getDepartments(input.companyId),
      ]);

      const activeEmployees = employees.filter((employee: any) => employee.status === "active");
      const departmentMap = new Map(departments.map((department: any) => [department.id, department.name]));

      const byDepartmentCounts = new Map<string, number>();
      for (const employee of activeEmployees as any[]) {
        const name = employee.departmentId ? String(departmentMap.get(employee.departmentId) ?? "Unassigned") : "Unassigned";
        byDepartmentCounts.set(name, (byDepartmentCounts.get(name) ?? 0) + 1);
      }

      const byDepartment = Array.from(byDepartmentCounts.entries()).map(([dept, count]) => ({ dept, count }));

      const byGenderCounts = new Map<string, number>();
      for (const employee of activeEmployees as any[]) {
        const name = employee.gender
          ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1).replace(/_/g, " ")
          : "Unknown";
        byGenderCounts.set(name, (byGenderCounts.get(name) ?? 0) + 1);
      }
      const byGender = Array.from(byGenderCounts.entries()).map(([name, value]) => ({ name, value }));

      const byEmploymentTypeCounts = new Map<string, number>();
      for (const employee of activeEmployees as any[]) {
        const name = employee.employmentType
          ? employee.employmentType.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase())
          : "Unknown";
        byEmploymentTypeCounts.set(name, (byEmploymentTypeCounts.get(name) ?? 0) + 1);
      }
      const byEmploymentType = Array.from(byEmploymentTypeCounts.entries()).map(([name, value]) => ({ name, value }));

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyCounts = new Map<string, { month: string; count: number; sortKey: number }>();
      for (const employee of employees as any[]) {
        if (!employee.joinDate) continue;
        const joinDate = new Date(employee.joinDate);
        if (joinDate < sixMonthsAgo) continue;
        const key = monthKey(joinDate);
        const month = joinDate.toLocaleString("en-US", { month: "short" });
        const current = monthlyCounts.get(key);
        if (current) {
          current.count += 1;
        } else {
          monthlyCounts.set(key, { month, count: 1, sortKey: joinDate.getFullYear() * 100 + joinDate.getMonth() });
        }
      }
      const newJoinersByMonth = Array.from(monthlyCounts.values())
        .sort((left, right) => left.sortKey - right.sortKey)
        .map(({ month, count }) => ({ month, count }));

      const recentJoiners = [...employees]
        .filter((employee: any) => employee.joinDate)
        .sort((left: any, right: any) => new Date(right.joinDate).getTime() - new Date(left.joinDate).getTime())
        .slice(0, 5)
        .map((employee: any) => ({
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          dept: employee.departmentId ? (departmentMap.get(employee.departmentId) ?? "—") : "—",
          joinDate: employee.joinDate ?? null,
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
