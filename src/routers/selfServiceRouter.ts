/**
 * selfServiceRouter.ts — Employee Self-Service (ESS) & Manager Self-Service (MSS)
 *
 * ESS procedures (all employees):
 *   ess.myAttendanceSummary  — current month attendance stats
 *   ess.myLeaveBalances      — leave balances for current year
 *   ess.myLeaveRequests      — my leave request history + status
 *   ess.myPayslips           — list of payslips
 *   ess.explainPayslip       — AI narrative explanation of a payslip
 *   ess.myRequests           — all pending/recent workflow requests
 *   ess.newsFeed             — company news feed (pinned first)
 *   ess.policyDocs           — HR policy documents library
 *   ess.createNews           — HR Admin: create a news item
 *   ess.createPolicy         — HR Admin: upload a policy document
 *
 * MSS procedures (managers / dept heads / HR roles):
 *   mss.teamAttendance       — team attendance for today / this week
 *   mss.pendingApprovals     — pending leave requests for my direct reports
 *   mss.approveLeave         — one-touch approve
 *   mss.rejectLeave          — one-touch reject
 *   mss.coverageSummary      — AI coverage analysis for a leave request
 *   mss.teamLeaveCalendar    — team leave calendar (month view data)
 *   mss.teamReports          — team attendance + leave summary stats
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  companyNews,
  hrPolicyDocs,
  employees,
  leaveRequests,
  leaveBalances,
  leaveTypes,
  attendanceRecords,
  payslips,
  workflowInstances,
} from "../../drizzle/schema";
import { and, desc, eq, gte, lte, or, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { analyzeTeamCoverage } from "../ai/leaveAI";
import { listLeaveRequests } from "../leaveDb";

const COMPANY_ID = 1;

// ─── ESS ROUTER ──────────────────────────────────────────────────────────────
const essRouter = router({
  /** Current month attendance summary for the calling employee */
  myAttendanceSummary: protectedProcedure
    .input(z.object({
      employeeId: z.number(),
      year: z.number().optional(),
      month: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { present: 0, absent: 0, late: 0, earlyLeave: 0, totalHours: 0, avgHours: 0, records: [] };
      const now = new Date();
      const year = input.year ?? now.getFullYear();
      const month = input.month ?? (now.getMonth() + 1);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      const records = await db.select().from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.employeeId, input.employeeId),
          gte(attendanceRecords.date, start),
          lte(attendanceRecords.date, end),
        ))
        .orderBy(desc(attendanceRecords.date))
        .limit(60);
      const present = records.filter(r => r.status === "present").length;
      const absent = records.filter(r => r.status === "absent").length;
      const late = records.filter(r => r.lateMinutes && r.lateMinutes > 0).length;
      const earlyLeave = records.filter(r => r.earlyLeaveMinutes && r.earlyLeaveMinutes > 0).length;
      const totalMinutes = records.reduce((sum, r) => sum + (r.workMinutes ?? 0), 0);
      const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
      const avgHours = records.length > 0 ? Math.round(totalMinutes / records.length / 60 * 10) / 10 : 0;
      return { present, absent, late, earlyLeave, totalHours, avgHours, records };
    }),

  /** Leave balances for the calling employee (current year) */
  myLeaveBalances: protectedProcedure
    .input(z.object({ employeeId: z.number(), year: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const year = input.year ?? new Date().getFullYear();
      const balanceRows = await db.select().from(leaveBalances)
        .where(and(
          eq(leaveBalances.employeeId, input.employeeId),
          eq(leaveBalances.year, year),
        ));
      if (balanceRows.length === 0) return [];
      const typeIds = Array.from(new Set(balanceRows.map(b => b.leaveTypeId)));
      const types = await db.select().from(leaveTypes)
        .where(and(eq(leaveTypes.companyId, COMPANY_ID), inArray(leaveTypes.id, typeIds)));
      const typeMap = Object.fromEntries(types.map(t => [t.id, t]));
      return balanceRows.map(b => ({
        ...b,
        leaveTypeName: typeMap[b.leaveTypeId]?.name ?? "Unknown",
        leaveTypeColor: typeMap[b.leaveTypeId]?.colorCode ?? "#6B7280",
        leaveTypeIcon: null,
      }));
    }),

  /** My leave requests (recent 20) */
  myLeaveRequests: protectedProcedure
    .input(z.object({
      employeeId: z.number(),
      status: z.enum(["pending", "approved", "rejected", "cancelled", "withdrawn"]).optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(leaveRequests.employeeId, input.employeeId)];
      if (input.status) conditions.push(eq(leaveRequests.status, input.status));
      const rows = await db.select().from(leaveRequests)
        .where(and(...conditions))
        .orderBy(desc(leaveRequests.createdAt))
        .limit(input.limit);
      if (rows.length === 0) return [];
      const typeIds = Array.from(new Set(rows.map(r => r.leaveTypeId)));
      const types = await db.select().from(leaveTypes)
        .where(inArray(leaveTypes.id, typeIds));
      const typeMap = Object.fromEntries(types.map(t => [t.id, t]));
      return rows.map(r => ({
        ...r,
        leaveTypeName: typeMap[r.leaveTypeId]?.name ?? "Leave",
        leaveTypeColor: typeMap[r.leaveTypeId]?.colorCode ?? "#6B7280",
      }));
    }),

  /** My payslips (recent 12) */
  myPayslips: protectedProcedure
    .input(z.object({ employeeId: z.number(), limit: z.number().default(12) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(payslips)
        .where(eq(payslips.employeeId, input.employeeId))
        .orderBy(desc(payslips.year), desc(payslips.month))
        .limit(input.limit);
    }),

  /** AI explanation of a payslip — returns a plain-language narrative */
  explainPayslip: protectedProcedure
    .input(z.object({
      payslipId: z.number(),
      employeeId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db.select().from(payslips)
        .where(and(eq(payslips.id, input.payslipId), eq(payslips.employeeId, input.employeeId)))
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Payslip not found" });
      const p = rows[0];
      const totalDeductions = Number(p.totalDeductions ?? 0);
      const grossSalary = Number(p.grossSalary ?? 0);
      const netSalary = Number(p.netSalary ?? 0);
      const prompt = `You are an HR payroll assistant explaining a payslip to an employee in plain language.
Payslip details:
- Pay period: ${p.month}/${p.year}
- Basic salary: ${p.basicSalary ?? 0}
- Gross salary: ${grossSalary}
- Total earnings: ${p.totalEarnings ?? 0}
- Tax amount: ${p.taxAmount ?? 0}
- PF (employee): ${p.pfEmployee ?? 0}
- Loan deductions: ${p.loanDeductions ?? 0}
- Late deductions: ${p.lateDeductions ?? 0}
- Absent deductions: ${p.absentDeductions ?? 0}
- Total deductions: ${totalDeductions}
- Net salary: ${netSalary}
- Currency: ${p.currency ?? "AED"}
- Status: ${p.status}

Write a friendly, clear 3–4 sentence explanation of this payslip for the employee:
1. What they earned (gross breakdown)
2. What was deducted and why
3. What they take home (net salary)
Keep it conversational, positive, and under 120 words. Do not include greetings.`;
      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: "You are a helpful HR payroll assistant. Explain payslips clearly and positively." },
            { role: "user", content: prompt },
          ],
          maxTokens: 200,
        });
        const text = (result.choices[0]?.message?.content as string) ?? "";
        return { explanation: text.trim(), payslip: p };
      } catch {
        return {
          explanation: `Your net salary for ${p.month}/${p.year} is ${netSalary} ${p.currency ?? "AED"}. Gross salary was ${grossSalary} with total deductions of ${totalDeductions}.`,
          payslip: p,
        };
      }
    }),

  /** My recent workflow requests (leave, transfers, etc.) */
  myRequests: protectedProcedure
    .input(z.object({ requestedBy: z.number(), limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(workflowInstances)
        .where(eq(workflowInstances.requestedBy, input.requestedBy))
        .orderBy(desc(workflowInstances.createdAt))
        .limit(input.limit);
    }),

  /** Company news feed (pinned first, then by publishedAt desc) */
  newsFeed: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      limit: z.number().default(10),
      category: z.enum(["announcement", "policy", "event", "achievement", "general"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: ReturnType<typeof eq>[] = [
        eq(companyNews.companyId, input.companyId),
        eq(companyNews.isActive, true),
      ];
      if (input.category) {
        conditions.push(eq(companyNews.category, input.category));
      }
      return db.select().from(companyNews)
        .where(and(...conditions))
        .orderBy(desc(companyNews.isPinned), desc(companyNews.publishedAt))
        .limit(input.limit);
    }),

  /** HR policy documents library */
  policyDocs: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      category: z.enum(["leave", "attendance", "code_of_conduct", "benefits", "payroll", "safety", "general"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: ReturnType<typeof eq>[] = [
        eq(hrPolicyDocs.companyId, input.companyId),
        eq(hrPolicyDocs.isActive, true),
      ];
      if (input.category) {
        conditions.push(eq(hrPolicyDocs.category, input.category));
      }
      return db.select().from(hrPolicyDocs)
        .where(and(...conditions))
        .orderBy(desc(hrPolicyDocs.isMandatory), desc(hrPolicyDocs.createdAt));
    }),

  /** HR Admin: create a company news item */
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const result = await db.insert(companyNews).values({
        ...input,
        publishedAt: new Date(),
      });
      return { id: (result as { insertId?: number }).insertId ?? 0 };
    }),

  /** HR Admin: create a policy document entry */
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
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const result = await db.insert(hrPolicyDocs).values(input);
      return { id: (result as { insertId?: number }).insertId ?? 0 };
    }),
});

// ─── MSS ROUTER ──────────────────────────────────────────────────────────────
const mssRouter = router({
  /** Team attendance for today */
  teamAttendance: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      managerId: z.number(),
      date: z.date().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { present: 0, absent: 0, onLeave: 0, late: 0, total: 0, records: [] };
      const directReports = await db.select().from(employees)
        .where(and(
          eq(employees.companyId, input.companyId),
          eq(employees.reportsToId, input.managerId),
          eq(employees.status, "active"),
        ));
      if (directReports.length === 0) return { present: 0, absent: 0, onLeave: 0, late: 0, total: 0, records: [] };
      const reportIds = directReports.map(e => e.id);
      const targetDate = input.date ?? new Date();
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
      const records = await db.select().from(attendanceRecords)
        .where(and(
          inArray(attendanceRecords.employeeId, reportIds),
          gte(attendanceRecords.date, dayStart),
          lte(attendanceRecords.date, dayEnd),
        ));
      const recordMap = Object.fromEntries(records.map(r => [r.employeeId, r]));
      const enriched = directReports.map(emp => ({
        employee: emp,
        record: recordMap[emp.id] ?? null,
        status: recordMap[emp.id]?.status ?? "absent",
        isLate: (recordMap[emp.id]?.lateMinutes ?? 0) > 0,
        clockIn: recordMap[emp.id]?.clockIn ?? null,
        clockOut: recordMap[emp.id]?.clockOut ?? null,
      }));
      return {
        present: enriched.filter(e => e.status === "present").length,
        absent: enriched.filter(e => e.status === "absent").length,
        onLeave: enriched.filter(e => e.status === "on_leave").length,
        late: enriched.filter(e => e.isLate).length,
        total: directReports.length,
        records: enriched,
      };
    }),

  /** Pending leave requests from direct reports */
  pendingApprovals: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      managerId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const directReports = await db.select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        departmentId: employees.departmentId,
        designationId: employees.designationId,
      })
        .from(employees)
        .where(and(
          eq(employees.companyId, input.companyId),
          eq(employees.reportsToId, input.managerId),
          eq(employees.status, "active"),
        ));
      if (directReports.length === 0) return [];
      const reportIds = directReports.map(e => e.id);
      const pending = await db.select().from(leaveRequests)
        .where(and(
          inArray(leaveRequests.employeeId, reportIds),
          eq(leaveRequests.status, "pending"),
        ))
        .orderBy(desc(leaveRequests.createdAt));
      if (pending.length === 0) return [];
      const typeIds = Array.from(new Set(pending.map(r => r.leaveTypeId)));
      const types = await db.select().from(leaveTypes).where(inArray(leaveTypes.id, typeIds));
      const typeMap = Object.fromEntries(types.map(t => [t.id, t]));
      const empMap = Object.fromEntries(directReports.map(e => [e.id, e]));
      return pending.map(r => ({
        ...r,
        leaveTypeName: typeMap[r.leaveTypeId]?.name ?? "Leave",
        leaveTypeColor: typeMap[r.leaveTypeId]?.colorCode ?? "#6B7280",
        employeeName: empMap[r.employeeId]
          ? `${empMap[r.employeeId].firstName} ${empMap[r.employeeId].lastName}`
          : "Unknown",
      }));
    }),

  /** One-touch approve a leave request */
  approveLeave: protectedProcedure
    .input(z.object({
      leaveRequestId: z.number(),
      approverId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(leaveRequests)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(leaveRequests.id, input.leaveRequestId));
      return { success: true };
    }),

  /** One-touch reject a leave request */
  rejectLeave: protectedProcedure
    .input(z.object({
      leaveRequestId: z.number(),
      approverId: z.number(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(leaveRequests)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(leaveRequests.id, input.leaveRequestId));
      return { success: true };
    }),

  /** AI coverage summary for a pending leave request */
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
      const overlapping = await listLeaveRequests(input.companyId, {
        startDate: input.startDate,
        endDate: input.endDate,
        status: "approved",
      });
      const summary = await analyzeTeamCoverage({
        ...input,
        overlappingLeaves: overlapping,
      });
      return { summary, aiGenerated: true };
    }),

  /** Team leave calendar data (month view) */
  teamLeaveCalendar: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      managerId: z.number(),
      year: z.number(),
      month: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const directReports = await db.select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
        .from(employees)
        .where(and(
          eq(employees.companyId, input.companyId),
          eq(employees.reportsToId, input.managerId),
          eq(employees.status, "active"),
        ));
      if (directReports.length === 0) return [];
      const reportIds = directReports.map(e => e.id);
      const start = new Date(input.year, input.month - 1, 1);
      const end = new Date(input.year, input.month, 0, 23, 59, 59);
      const requests = await db.select().from(leaveRequests)
        .where(and(
          inArray(leaveRequests.employeeId, reportIds),
          or(eq(leaveRequests.status, "approved"), eq(leaveRequests.status, "pending")),
          lte(leaveRequests.startDate, end),
          gte(leaveRequests.endDate, start),
        ));
      const typeIds = Array.from(new Set(requests.map(r => r.leaveTypeId)));
      const types = typeIds.length > 0
        ? await db.select().from(leaveTypes).where(inArray(leaveTypes.id, typeIds))
        : [];
      const typeMap = Object.fromEntries(types.map(t => [t.id, t]));
      const empMap = Object.fromEntries(directReports.map(e => [e.id, e]));
      return requests.map(r => ({
        ...r,
        leaveTypeName: typeMap[r.leaveTypeId]?.name ?? "Leave",
        leaveTypeColor: typeMap[r.leaveTypeId]?.colorCode ?? "#6B7280",
        employeeName: empMap[r.employeeId]
          ? `${empMap[r.employeeId].firstName} ${empMap[r.employeeId].lastName}`
          : "Unknown",
      }));
    }),

  /** Team attendance + leave summary stats for the current month */
  teamReports: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      managerId: z.number(),
      year: z.number().optional(),
      month: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { headcount: 0, avgAttendance: 0, totalLeaves: 0, pendingApprovals: 0, topAbsentees: [] };
      const now = new Date();
      const year = input.year ?? now.getFullYear();
      const month = input.month ?? (now.getMonth() + 1);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      const directReports = await db.select().from(employees)
        .where(and(
          eq(employees.companyId, input.companyId),
          eq(employees.reportsToId, input.managerId),
          eq(employees.status, "active"),
        ));
      if (directReports.length === 0) return { headcount: 0, avgAttendance: 0, totalLeaves: 0, pendingApprovals: 0, topAbsentees: [] };
      const reportIds = directReports.map(e => e.id);
      const [attRecords, leaveReqs] = await Promise.all([
        db.select().from(attendanceRecords)
          .where(and(
            inArray(attendanceRecords.employeeId, reportIds),
            gte(attendanceRecords.date, start),
            lte(attendanceRecords.date, end),
          )),
        db.select().from(leaveRequests)
          .where(and(
            inArray(leaveRequests.employeeId, reportIds),
            or(eq(leaveRequests.status, "approved"), eq(leaveRequests.status, "pending")),
          )),
      ]);
      const presentCount = attRecords.filter(r => r.status === "present").length;
      const avgAttendance = Math.round((presentCount / Math.max(1, attRecords.length)) * 100);
      const pendingApprovals = leaveReqs.filter(r => r.status === "pending").length;
      const absentByEmp: Record<number, number> = {};
      attRecords.filter(r => r.status === "absent").forEach(r => {
        absentByEmp[r.employeeId] = (absentByEmp[r.employeeId] ?? 0) + 1;
      });
      const empMap = Object.fromEntries(directReports.map(e => [e.id, e]));
      const topAbsentees = Object.entries(absentByEmp)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([empId, count]) => ({
          employeeId: Number(empId),
          employeeName: empMap[Number(empId)]
            ? `${empMap[Number(empId)].firstName} ${empMap[Number(empId)].lastName}`
            : "Unknown",
          absentDays: count,
        }));
      return {
        headcount: directReports.length,
        avgAttendance,
        totalLeaves: leaveReqs.filter(r => r.status === "approved").length,
        pendingApprovals,
        topAbsentees,
      };
    }),
});

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export const selfServiceRouter = router({
  ess: essRouter,
  mss: mssRouter,
});
