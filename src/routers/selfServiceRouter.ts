import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { analyzeTeamCoverage } from "../ai/leaveAI";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createCompanyNewsItem,
  createPolicyDoc,
  getAttendanceReportData,
  getCompanyNewsFeed,
  getEmployees,
  getPayslipById,
  getPayslips,
  getPolicyDocs,
  getWorkflowInstances,
  listLeaveBalances,
  listLeaveRequests,
  listLeaveTypes,
  updateLeaveRequest,
} from "../mongoDb";

const COMPANY_ID = 1;

async function getDirectReports(companyId: number, managerId: number) {
  const employees = await getEmployees(companyId);
  return employees.filter((employee: any) => employee.reportsToId === managerId && employee.status === "active");
}

const essRouter = router({
  myAttendanceSummary: protectedProcedure
    .input(z.object({
      employeeId: z.number(),
      year: z.number().optional(),
      month: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const now = new Date();
      const year = input.year ?? now.getFullYear();
      const month = input.month ?? (now.getMonth() + 1);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      const records = await getAttendanceReportData(COMPANY_ID, start, end, { employeeId: input.employeeId });
      const present = records.filter((record: any) => record.status === "present").length;
      const absent = records.filter((record: any) => record.status === "absent").length;
      const late = records.filter((record: any) => (record.lateMinutes ?? 0) > 0).length;
      const earlyLeave = records.filter((record: any) => (record.earlyLeaveMinutes ?? 0) > 0).length;
      const totalMinutes = records.reduce((sum: number, record: any) => sum + (record.workMinutes ?? 0), 0);
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
      const avgHours = records.length > 0 ? Math.round((totalMinutes / records.length / 60) * 10) / 10 : 0;
      return { present, absent, late, earlyLeave, totalHours, avgHours, records };
    }),

  myLeaveBalances: protectedProcedure
    .input(z.object({ employeeId: z.number(), year: z.number().optional() }))
    .query(async ({ input }) => {
      const year = input.year ?? new Date().getFullYear();
      const [balances, leaveTypes] = await Promise.all([
        listLeaveBalances(COMPANY_ID, year, input.employeeId),
        listLeaveTypes(COMPANY_ID),
      ]);
      const typeMap = new Map<number, any>(leaveTypes.map((type: any) => [type.id, type]));
      return balances.map((balance: any) => ({
        ...balance,
        leaveTypeName: typeMap.get(balance.leaveTypeId)?.name ?? "Unknown",
        leaveTypeColor: typeMap.get(balance.leaveTypeId)?.colorCode ?? "#6B7280",
        leaveTypeIcon: null,
      }));
    }),

  myLeaveRequests: protectedProcedure
    .input(z.object({
      employeeId: z.number(),
      status: z.enum(["pending", "approved", "rejected", "cancelled", "withdrawn"]).optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const [requests, leaveTypes] = await Promise.all([
        listLeaveRequests(COMPANY_ID, {
          employeeId: input.employeeId,
          status: input.status,
          limit: input.limit,
        }),
        listLeaveTypes(COMPANY_ID),
      ]);
      const typeMap = new Map<number, any>(leaveTypes.map((type: any) => [type.id, type]));
      return requests.map((request: any) => ({
        ...request,
        leaveTypeName: typeMap.get(request.leaveTypeId)?.name ?? "Leave",
        leaveTypeColor: typeMap.get(request.leaveTypeId)?.colorCode ?? "#6B7280",
      }));
    }),

  myPayslips: protectedProcedure
    .input(z.object({ employeeId: z.number(), limit: z.number().default(12) }))
    .query(({ input }) => getPayslips(input.employeeId, input.limit)),

  explainPayslip: protectedProcedure
    .input(z.object({
      payslipId: z.number(),
      employeeId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const payslip = await getPayslipById(input.payslipId, input.employeeId);
      if (!payslip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payslip not found" });
      }

      const totalDeductions = Number(payslip.totalDeductions ?? 0);
      const grossSalary = Number(payslip.grossSalary ?? 0);
      const netSalary = Number(payslip.netSalary ?? 0);
      const prompt = `You are an HR payroll assistant explaining a payslip to an employee in plain language.
Payslip details:
- Pay period: ${payslip.month}/${payslip.year}
- Basic salary: ${payslip.basicSalary ?? 0}
- Gross salary: ${grossSalary}
- Total earnings: ${payslip.totalEarnings ?? 0}
- Tax amount: ${payslip.taxAmount ?? 0}
- PF (employee): ${payslip.pfEmployee ?? 0}
- Loan deductions: ${payslip.loanDeductions ?? 0}
- Late deductions: ${payslip.lateDeductions ?? 0}
- Absent deductions: ${payslip.absentDeductions ?? 0}
- Total deductions: ${totalDeductions}
- Net salary: ${netSalary}
- Currency: ${payslip.currency ?? "AED"}
- Status: ${payslip.status}

Write a friendly, clear 3-4 sentence explanation of this payslip for the employee:
1. What they earned
2. What was deducted and why
3. What they take home
Keep it conversational, positive, and under 120 words. Do not include greetings.`;

      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: "You are a helpful HR payroll assistant. Explain payslips clearly and positively." },
            { role: "user", content: prompt },
          ],
          maxTokens: 200,
        });
        const explanation = (result.choices[0]?.message?.content as string) ?? "";
        return { explanation: explanation.trim(), payslip };
      } catch {
        return {
          explanation: `Your net salary for ${payslip.month}/${payslip.year} is ${netSalary} ${payslip.currency ?? "AED"}. Gross salary was ${grossSalary} with total deductions of ${totalDeductions}.`,
          payslip,
        };
      }
    }),

  myRequests: protectedProcedure
    .input(z.object({ requestedBy: z.number(), limit: z.number().default(10) }))
    .query(({ input }) => getWorkflowInstances(COMPANY_ID, { requestedBy: input.requestedBy }).then(items => items.slice(0, input.limit))),

  newsFeed: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      limit: z.number().default(10),
      category: z.enum(["announcement", "policy", "event", "achievement", "general"]).optional(),
    }))
    .query(({ input }) => getCompanyNewsFeed(input.companyId, { category: input.category, limit: input.limit })),

  policyDocs: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      category: z.enum(["leave", "attendance", "code_of_conduct", "benefits", "payroll", "safety", "general"]).optional(),
    }))
    .query(({ input }) => getPolicyDocs(input.companyId, input.category)),

  createNews: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      title: z.string().min(1).max(300),
      summary: z.string().optional(),
      body: z.string().optional(),
      category: z.enum(["announcement", "policy", "event", "achievement", "general"]).default("general"),
      isPinned: z.boolean().default(false),
      targetAudience: z.enum(["all", "department", "role"]).default("all"),
      targetDepartmentId: z.number().optional(),
      imageUrl: z.string().optional(),
      authorId: z.number().optional(),
    }))
    .mutation(async ({ input }) => ({ id: await createCompanyNewsItem({ ...input, publishedAt: new Date() }) })),

  createPolicy: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      title: z.string().min(1).max(300),
      description: z.string().optional(),
      category: z.enum(["leave", "attendance", "code_of_conduct", "benefits", "payroll", "safety", "general"]).default("general"),
      fileUrl: z.string().optional(),
      fileKey: z.string().optional(),
      version: z.string().default("1.0"),
      isMandatory: z.boolean().default(false),
      uploadedBy: z.number().optional(),
      effectiveDate: z.date().optional(),
    }))
    .mutation(async ({ input }) => ({ id: await createPolicyDoc(input) })),
});

const mssRouter = router({
  teamAttendance: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      managerId: z.number(),
      date: z.date().optional(),
    }))
    .query(async ({ input }) => {
      const reports = await getDirectReports(input.companyId, input.managerId);
      if (reports.length === 0) {
        return { present: 0, absent: 0, onLeave: 0, late: 0, total: 0, records: [] };
      }

      const targetDate = input.date ?? new Date();
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
      const attendance = await getAttendanceReportData(input.companyId, dayStart, dayEnd);
      const reportIds = new Set(reports.map((employee: any) => employee.id));
      const attendanceMap = new Map<number, any>();
      for (const record of attendance.filter((item: any) => reportIds.has(item.employeeId))) {
        attendanceMap.set(record.employeeId, record);
      }

      const records = reports.map((employee: any) => {
        const record = attendanceMap.get(employee.id) ?? null;
        return {
          employee,
          record,
          status: record?.status ?? "absent",
          isLate: (record?.lateMinutes ?? 0) > 0,
          clockIn: record?.clockIn ?? null,
          clockOut: record?.clockOut ?? null,
        };
      });

      return {
        present: records.filter(item => item.status === "present").length,
        absent: records.filter(item => item.status === "absent").length,
        onLeave: records.filter(item => item.status === "on_leave").length,
        late: records.filter(item => item.isLate).length,
        total: reports.length,
        records,
      };
    }),

  pendingApprovals: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      managerId: z.number(),
    }))
    .query(async ({ input }) => {
      const reports = await getDirectReports(input.companyId, input.managerId);
      if (reports.length === 0) return [];

      const reportIds = new Set(reports.map((employee: any) => employee.id));
      const [pendingRequests, leaveTypes] = await Promise.all([
        listLeaveRequests(input.companyId, { status: "pending", limit: 1000 }),
        listLeaveTypes(input.companyId),
      ]);
      const filtered = pendingRequests.filter((request: any) => reportIds.has(request.employeeId));
      const typeMap = new Map<number, any>(leaveTypes.map((type: any) => [type.id, type]));
      const employeeMap = new Map<number, any>(reports.map((employee: any) => [employee.id, employee]));
      return filtered.map((request: any) => ({
        ...request,
        leaveTypeName: typeMap.get(request.leaveTypeId)?.name ?? "Leave",
        leaveTypeColor: typeMap.get(request.leaveTypeId)?.colorCode ?? "#6B7280",
        employeeName: employeeMap.get(request.employeeId)
          ? `${employeeMap.get(request.employeeId).firstName} ${employeeMap.get(request.employeeId).lastName}`
          : "Unknown",
      }));
    }),

  approveLeave: protectedProcedure
    .input(z.object({
      leaveRequestId: z.number(),
      approverId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await updateLeaveRequest(input.leaveRequestId, {
        status: "approved",
        approvedBy: input.approverId,
        approvedAt: new Date(),
      });
      return { success: true };
    }),

  rejectLeave: protectedProcedure
    .input(z.object({
      leaveRequestId: z.number(),
      approverId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await updateLeaveRequest(input.leaveRequestId, {
        status: "rejected",
        approvedBy: input.approverId,
        rejectedReason: input.comment,
      });
      return { success: true };
    }),

  coverageSummary: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      leaveRequestId: z.number(),
      employeeId: z.number(),
      startDate: z.date(),
      endDate: z.date(),
      teamSize: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const overlappingLeaves = await listLeaveRequests(input.companyId, {
        status: "approved",
        limit: 1000,
      });
      const summary = await analyzeTeamCoverage({
        ...input,
        overlappingLeaves: overlappingLeaves.filter((request: any) =>
          request.startDate <= input.endDate && request.endDate >= input.startDate
        ),
      });
      return { summary, aiGenerated: true };
    }),

  teamLeaveCalendar: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      managerId: z.number(),
      year: z.number(),
      month: z.number(),
    }))
    .query(async ({ input }) => {
      const reports = await getDirectReports(input.companyId, input.managerId);
      if (reports.length === 0) return [];

      const reportIds = new Set(reports.map((employee: any) => employee.id));
      const [requests, leaveTypes] = await Promise.all([
        listLeaveRequests(input.companyId, { limit: 1000 }),
        listLeaveTypes(input.companyId),
      ]);
      const start = new Date(input.year, input.month - 1, 1);
      const end = new Date(input.year, input.month, 0, 23, 59, 59, 999);
      const typeMap = new Map<number, any>(leaveTypes.map((type: any) => [type.id, type]));
      const employeeMap = new Map<number, any>(reports.map((employee: any) => [employee.id, employee]));
      return requests
        .filter((request: any) =>
          reportIds.has(request.employeeId) &&
          (request.status === "approved" || request.status === "pending") &&
          request.startDate <= end &&
          request.endDate >= start
        )
        .map((request: any) => ({
          ...request,
          leaveTypeName: typeMap.get(request.leaveTypeId)?.name ?? "Leave",
          leaveTypeColor: typeMap.get(request.leaveTypeId)?.colorCode ?? "#6B7280",
          employeeName: employeeMap.get(request.employeeId)
            ? `${employeeMap.get(request.employeeId).firstName} ${employeeMap.get(request.employeeId).lastName}`
            : "Unknown",
        }));
    }),

  teamReports: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      managerId: z.number(),
      year: z.number().optional(),
      month: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const reports = await getDirectReports(input.companyId, input.managerId);
      if (reports.length === 0) {
        return { headcount: 0, avgAttendance: 0, totalLeaves: 0, pendingApprovals: 0, topAbsentees: [] };
      }

      const now = new Date();
      const year = input.year ?? now.getFullYear();
      const month = input.month ?? (now.getMonth() + 1);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      const reportIds = new Set(reports.map((employee: any) => employee.id));
      const [attendance, leaveRequests] = await Promise.all([
        getAttendanceReportData(input.companyId, start, end),
        listLeaveRequests(input.companyId, { limit: 1000 }),
      ]);
      const teamAttendance = attendance.filter((record: any) => reportIds.has(record.employeeId));
      const teamLeaveRequests = leaveRequests.filter((request: any) => reportIds.has(request.employeeId));
      const presentCount = teamAttendance.filter((record: any) => record.status === "present").length;
      const avgAttendance = Math.round((presentCount / Math.max(1, teamAttendance.length)) * 100);

      const absenceCount = new Map<number, number>();
      for (const record of teamAttendance.filter((item: any) => item.status === "absent")) {
        absenceCount.set(record.employeeId, (absenceCount.get(record.employeeId) ?? 0) + 1);
      }

      const employeeMap = new Map<number, any>(reports.map((employee: any) => [employee.id, employee]));
      const topAbsentees = Array.from(absenceCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([employeeId, absentDays]) => ({
          employeeId,
          employeeName: employeeMap.get(employeeId)
            ? `${employeeMap.get(employeeId).firstName} ${employeeMap.get(employeeId).lastName}`
            : "Unknown",
          absentDays,
        }));

      return {
        headcount: reports.length,
        avgAttendance,
        totalLeaves: teamLeaveRequests.filter((request: any) => request.status === "approved").length,
        pendingApprovals: teamLeaveRequests.filter((request: any) => request.status === "pending").length,
        topAbsentees,
      };
    }),
});

export const selfServiceRouter = router({
  ess: essRouter,
  mss: mssRouter,
});
