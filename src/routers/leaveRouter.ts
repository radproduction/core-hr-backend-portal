/**
 * leaveRouter.ts — Module 3: Leave Management tRPC router
 *
 * Sub-routers: types, policies, balances, requests, approvals, accrual,
 *              carryForward, compensatory, reports, ai
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  calculateBusinessDays,
  calculateProratedDays,
  createAccrualLog,
  createCarryForwardLog,
  createCompensatoryLeave,
  createLeaveApproval,
  createLeavePolicy,
  createLeaveRequest,
  createLeaveType,
  deleteLeavePolicy,
  deleteLeaveType,
  getCompensatoryLeave,
  getLeaveBalance,
  getLeaveRequest,
  getLeaveType,
  getLeavePoliciesForType,
  getPendingApprovalsForApprover,
  listAccrualLogs,
  listCarryForwardLogs,
  listCompensatoryLeaves,
  listLeaveApprovals,
  listLeaveBalances,
  listLeavePolicies,
  listLeaveRequests,
  listLeaveTypes,
  updateCompensatoryLeave,
  updateLeaveApproval,
  updateLeavePolicy,
  updateLeaveRequest,
  updateLeaveType,
  upsertLeaveBalance,
} from "../leaveDb";
import { generateLeaveDraft, analyzeTeamCoverage } from "../ai/leaveAI";

// ─── LEAVE TYPES SUB-ROUTER ───────────────────────────────────────────────────

const leaveTypesRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listLeaveTypes(input.companyId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const lt = await getLeaveType(input.id);
      if (!lt) throw new TRPCError({ code: "NOT_FOUND", message: "Leave type not found" });
      return lt;
    }),

  create: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      name: z.string().min(1),
      code: z.string().min(1).max(20),
      description: z.string().optional(),
      isPaid: z.boolean().default(true),
      isCarryForward: z.boolean().default(false),
      maxCarryDays: z.number().default(0),
      accrualType: z.enum(["none", "monthly", "yearly", "per_period"]).default("none"),
      accrualRate: z.string().default("0.00"),
      maxBalance: z.string().default("0.00"),
      applicableGender: z.enum(["all", "male", "female"]).default("all"),
      requiresApproval: z.boolean().default(true),
      requiresDocument: z.boolean().default(false),
      minDaysNotice: z.number().default(0),
      maxConsecutiveDays: z.number().default(0),
      colorCode: z.string().default("#6366f1"),
    }))
    .mutation(({ input }) => createLeaveType(input)),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        name: z.string().optional(),
        code: z.string().optional(),
        description: z.string().optional(),
        isPaid: z.boolean().optional(),
        isCarryForward: z.boolean().optional(),
        maxCarryDays: z.number().optional(),
        accrualType: z.enum(["none", "monthly", "yearly", "per_period"]).optional(),
        accrualRate: z.string().optional(),
        maxBalance: z.string().optional(),
        applicableGender: z.enum(["all", "male", "female"]).optional(),
        requiresApproval: z.boolean().optional(),
        requiresDocument: z.boolean().optional(),
        minDaysNotice: z.number().optional(),
        maxConsecutiveDays: z.number().optional(),
        colorCode: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    }))
    .mutation(({ input }) => updateLeaveType(input.id, input.data)),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteLeaveType(input.id)),
});

// ─── LEAVE POLICIES SUB-ROUTER ────────────────────────────────────────────────

const leavePoliciesRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listLeavePolicies(input.companyId)),

  listForType: protectedProcedure
    .input(z.object({ companyId: z.number(), leaveTypeId: z.number() }))
    .query(({ input }) => getLeavePoliciesForType(input.companyId, input.leaveTypeId)),

  create: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      name: z.string().min(1),
      leaveTypeId: z.number(),
      applicableTo: z.enum(["all", "department", "gender", "designation"]).default("all"),
      departmentId: z.number().optional(),
      designationId: z.number().optional(),
      gender: z.enum(["all", "male", "female"]).default("all"),
      entitlementDays: z.string(),
      prorateOnJoining: z.boolean().default(true),
      prorateOnExit: z.boolean().default(true),
      effectiveFrom: z.date(),
      effectiveTo: z.date().optional(),
    }))
    .mutation(({ input }) => createLeavePolicy(input)),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        name: z.string().optional(),
        entitlementDays: z.string().optional(),
        prorateOnJoining: z.boolean().optional(),
        prorateOnExit: z.boolean().optional(),
        isActive: z.boolean().optional(),
        effectiveTo: z.date().optional(),
      }),
    }))
    .mutation(({ input }) => updateLeavePolicy(input.id, input.data)),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteLeavePolicy(input.id)),
});

// ─── LEAVE BALANCES SUB-ROUTER ────────────────────────────────────────────────

const leaveBalancesRouter = router({
  get: protectedProcedure
    .input(z.object({ employeeId: z.number(), leaveTypeId: z.number(), year: z.number() }))
    .query(({ input }) => getLeaveBalance(input.employeeId, input.leaveTypeId, input.year)),

  list: protectedProcedure
    .input(z.object({ companyId: z.number(), year: z.number(), employeeId: z.number().optional() }))
    .query(({ input }) => listLeaveBalances(input.companyId, input.year, input.employeeId)),

  upsert: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number(),
      leaveTypeId: z.number(),
      year: z.number(),
      entitled: z.string().default("0.00"),
      used: z.string().default("0.00"),
      pending: z.string().default("0.00"),
      carryForward: z.string().default("0.00"),
      compensatory: z.string().default("0.00"),
      balance: z.string().default("0.00"),
    }))
    .mutation(({ input }) => upsertLeaveBalance(input)),

  proratedEntitlement: protectedProcedure
    .input(z.object({ annualEntitlement: z.number(), joinDate: z.date(), year: z.number() }))
    .query(({ input }) => ({
      days: calculateProratedDays(input.annualEntitlement, input.joinDate, input.year),
    })),
});

// ─── LEAVE REQUESTS SUB-ROUTER ────────────────────────────────────────────────

const leaveRequestsRouter = router({
  submit: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number(),
      leaveTypeId: z.number(),
      startDate: z.date(),
      endDate: z.date(),
      isHalfDay: z.boolean().default(false),
      halfDayPeriod: z.enum(["morning", "afternoon"]).optional(),
      reason: z.string().min(1),
      aiDraftUsed: z.boolean().default(false),
      attachmentKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const days = input.isHalfDay
        ? 0.5
        : calculateBusinessDays(input.startDate, input.endDate);
      const id = await createLeaveRequest({ ...input, days: String(days) });
      // Create pending approval record
      await createLeaveApproval({
        leaveRequestId: id,
        approverId: input.employeeId, // will be replaced by manager lookup in real flow
        step: 1,
        status: "pending",
      });
      return { id, days };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const req = await getLeaveRequest(input.id);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Leave request not found" });
      return req;
    }),

  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number().optional(),
      status: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      leaveTypeId: z.number().optional(),
      limit: z.number().default(200),
    }))
    .query(({ input }) => listLeaveRequests(input.companyId, input)),

  cancel: protectedProcedure
    .input(z.object({ id: z.number(), cancelReason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const req = await getLeaveRequest(input.id);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["pending", "approved"].includes(req.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot cancel this request" });
      }
      await updateLeaveRequest(input.id, {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: input.cancelReason,
      });
      return { success: true };
    }),
});

// ─── LEAVE APPROVALS SUB-ROUTER ───────────────────────────────────────────────

const leaveApprovalsRouter = router({
  pending: protectedProcedure
    .input(z.object({ approverId: z.number() }))
    .query(({ input }) => getPendingApprovalsForApprover(input.approverId)),

  listForRequest: protectedProcedure
    .input(z.object({ leaveRequestId: z.number() }))
    .query(({ input }) => listLeaveApprovals(input.leaveRequestId)),

  approve: protectedProcedure
    .input(z.object({
      approvalId: z.number(),
      leaveRequestId: z.number(),
      comments: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await updateLeaveApproval(input.approvalId, {
        status: "approved",
        comments: input.comments,
        decidedAt: new Date(),
      });
      await updateLeaveRequest(input.leaveRequestId, {
        status: "approved",
        approvedAt: new Date(),
      });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({
      approvalId: z.number(),
      leaveRequestId: z.number(),
      comments: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      await updateLeaveApproval(input.approvalId, {
        status: "rejected",
        comments: input.comments,
        decidedAt: new Date(),
      });
      await updateLeaveRequest(input.leaveRequestId, {
        status: "rejected",
        rejectedReason: input.comments,
      });
      return { success: true };
    }),
});

// ─── ACCRUAL SUB-ROUTER ───────────────────────────────────────────────────────

const accrualRouter = router({
  runMonthly: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .mutation(async ({ input }) => {
      // Stub: in production, iterate all employees with accrual-type leave types
      return { processed: 0, message: "Accrual run queued" };
    }),

  logs: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number().optional(),
      year: z.number().optional(),
    }))
    .query(({ input }) => listAccrualLogs(input.companyId, input.employeeId, input.year)),

  logEntry: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number(),
      leaveTypeId: z.number(),
      year: z.number(),
      month: z.number(),
      accrualDays: z.string(),
      balanceBefore: z.string(),
      balanceAfter: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(({ input }) => createAccrualLog(input)),
});

// ─── CARRY-FORWARD SUB-ROUTER ─────────────────────────────────────────────────

const carryForwardRouter = router({
  runYearEnd: protectedProcedure
    .input(z.object({ companyId: z.number(), fromYear: z.number() }))
    .mutation(async ({ input }) => {
      // Stub: in production, iterate all employees with carry-forward leave types
      return { processed: 0, message: "Year-end carry-forward queued" };
    }),

  logs: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number().optional(),
      fromYear: z.number().optional(),
    }))
    .query(({ input }) => listCarryForwardLogs(input.companyId, input.employeeId, input.fromYear)),

  logEntry: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number(),
      leaveTypeId: z.number(),
      fromYear: z.number(),
      toYear: z.number(),
      balanceAtYearEnd: z.string(),
      carriedDays: z.string(),
      expiredDays: z.string(),
    }))
    .mutation(({ input }) => createCarryForwardLog(input)),
});

// ─── COMPENSATORY SUB-ROUTER ──────────────────────────────────────────────────

const compensatoryRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number().optional(),
      status: z.string().optional(),
    }))
    .query(({ input }) => listCompensatoryLeaves(input.companyId, input.employeeId, input.status)),

  earn: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number(),
      earnedDate: z.date(),
      reason: z.string().min(1),
      earnedDays: z.string(),
      expiryDate: z.date().optional(),
      approvedBy: z.number().optional(),
    }))
    .mutation(({ input }) => createCompensatoryLeave(input)),

  use: protectedProcedure
    .input(z.object({
      id: z.number(),
      usedDays: z.string(),
      linkedLeaveRequestId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const comp = await getCompensatoryLeave(input.id);
      if (!comp) throw new TRPCError({ code: "NOT_FOUND" });
      const newUsed = parseFloat(comp.usedDays ?? "0") + parseFloat(input.usedDays);
      const earned = parseFloat(comp.earnedDays ?? "0");
      await updateCompensatoryLeave(input.id, {
        usedDays: String(newUsed),
        status: newUsed >= earned ? "used" : "active",
        linkedLeaveRequestId: input.linkedLeaveRequestId,
      });
      return { success: true };
    }),

  expire: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => updateCompensatoryLeave(input.id, { status: "expired" })),
});

// ─── REPORTS SUB-ROUTER ───────────────────────────────────────────────────────

const leaveReportsRouter = router({
  balanceSummary: protectedProcedure
    .input(z.object({ companyId: z.number(), year: z.number(), employeeId: z.number().optional() }))
    .query(({ input }) => listLeaveBalances(input.companyId, input.year, input.employeeId)),

  requests: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      status: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      leaveTypeId: z.number().optional(),
      employeeId: z.number().optional(),
    }))
    .query(({ input }) => listLeaveRequests(input.companyId, input)),

  carryForward: protectedProcedure
    .input(z.object({ companyId: z.number(), employeeId: z.number().optional(), fromYear: z.number().optional() }))
    .query(({ input }) => listCarryForwardLogs(input.companyId, input.employeeId, input.fromYear)),

  accrualHistory: protectedProcedure
    .input(z.object({ companyId: z.number(), employeeId: z.number().optional(), year: z.number().optional() }))
    .query(({ input }) => listAccrualLogs(input.companyId, input.employeeId, input.year)),

  compensatory: protectedProcedure
    .input(z.object({ companyId: z.number(), employeeId: z.number().optional(), status: z.string().optional() }))
    .query(({ input }) => listCompensatoryLeaves(input.companyId, input.employeeId, input.status)),

  upcoming: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      days: z.number().default(30),
    }))
    .query(({ input }) => {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + input.days);
      return listLeaveRequests(input.companyId, {
        status: "approved",
        startDate: now,
        endDate: future,
      });
    }),

  pending: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listLeaveRequests(input.companyId, { status: "pending" })),
});

// ─── AI SUB-ROUTER ────────────────────────────────────────────────────────────

const leaveAiRouter = router({
  draftRequest: protectedProcedure
    .input(z.object({
      leaveTypeName: z.string(),
      startDate: z.date(),
      endDate: z.date(),
      days: z.number(),
      context: z.string().optional(), // employee's rough notes
    }))
    .mutation(async ({ input }) => {
      const draft = await generateLeaveDraft(input);
      return { draft, aiGenerated: true };
    }),

  coverageImpact: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      leaveRequestId: z.number(),
      employeeId: z.number(),
      startDate: z.date(),
      endDate: z.date(),
      teamSize: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Fetch overlapping approved/pending leaves for the same period
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
});

// ─── MAIN LEAVE ROUTER ────────────────────────────────────────────────────────

export const leaveRouter = router({
  types: leaveTypesRouter,
  policies: leavePoliciesRouter,
  balances: leaveBalancesRouter,
  requests: leaveRequestsRouter,
  approvals: leaveApprovalsRouter,
  accrual: accrualRouter,
  carryForward: carryForwardRouter,
  compensatory: compensatoryRouter,
  reports: leaveReportsRouter,
  ai: leaveAiRouter,
});
