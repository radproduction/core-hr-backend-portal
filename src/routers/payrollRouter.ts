/**
 * payrollRouter.ts — Module 4: Payroll Management tRPC router
 *
 * Sub-routers: structures, components, assignments, taxSlabs, pf,
 *              loans, advances, disbursement, runs, payslips, anomalies,
 *              reports, ai
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { permissionProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  addComponentToStructure,
  assignSalaryStructure,
  computePayslipForEmployee,
  createAdvance,
  createAnomalyFlag,
  createDisbursementCycle,
  createLoan,
  createPayrollRun,
  createSalaryComponent,
  createSalaryStructure,
  deleteSalaryComponent,
  deleteSalaryStructure,
  deleteTaxSlab,
  generatePayslips,
  getActiveLoanDeductionsForEmployee,
  getAdvanceDeductionsForMonth,
  getEmployeePayslips,
  getLoan,
  getPayrollRun,
  getPayrollCostByDept,
  getPayrollSummaryReport,
  getPayslip,
  getPfSettings,
  getSalaryComponent,
  getSalaryStructure,
  getStructureComponents,
  getYtdPayrollSummary,
  insertPayslip,
  listAdvances,
  listAnomalyFlags,
  listDisbursementCycles,
  listLoans,
  listPayrollRuns,
  listPayslips,
  listSalaryAssignments,
  listSalaryComponents,
  listSalaryStructures,
  listTaxSlabs,
  removeComponentFromStructure,
  updateAdvance,
  updateAnomalyFlag,
  updateDisbursementCycle,
  updateLoan,
  updatePayrollRunStatus,
  updatePayslip,
  updateSalaryAssignment,
  updateSalaryComponent,
  updateSalaryStructure,
  upsertPfSettings,
  upsertTaxSlab,
} from "../payrollDb";
import { detectPayrollAnomalies, explainPayslip } from "../ai/payrollAI";

// ─── SALARY STRUCTURES ────────────────────────────────────────────────────────
const structuresRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listSalaryStructures(input.companyId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const s = await getSalaryStructure(input.id);
      if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "Salary structure not found" });
      return s;
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        name: z.string().min(1),
        currency: z.string().default("AED"),
        description: z.string().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(({ input }) => createSalaryStructure(input)),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        currency: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateSalaryStructure(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteSalaryStructure(input.id)),

  getComponents: protectedProcedure
    .input(z.object({ structureId: z.number() }))
    .query(({ input }) => getStructureComponents(input.structureId)),

  addComponent: protectedProcedure
    .input(
      z.object({
        structureId: z.number(),
        componentId: z.number(),
        overrideValue: z.string().optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(({ input }) => addComponentToStructure(input)),

  removeComponent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => removeComponentFromStructure(input.id)),
});

// ─── SALARY COMPONENTS ────────────────────────────────────────────────────────
const componentsRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listSalaryComponents(input.companyId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const c = await getSalaryComponent(input.id);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Component not found" });
      return c;
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        name: z.string().min(1),
        code: z.string().min(1).max(30),
        type: z.enum(["earning", "deduction", "tax", "pf"]),
        calculationType: z.enum(["fixed", "percentage_of_basic", "percentage_of_gross", "formula"]).default("fixed"),
        value: z.string().default("0"),
        isTaxable: z.boolean().default(false),
        isPFApplicable: z.boolean().default(false),
        isActive: z.boolean().default(true),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(({ input }) => createSalaryComponent(input)),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        code: z.string().optional(),
        type: z.enum(["earning", "deduction", "tax", "pf"]).optional(),
        calculationType: z.enum(["fixed", "percentage_of_basic", "percentage_of_gross", "formula"]).optional(),
        value: z.string().optional(),
        isTaxable: z.boolean().optional(),
        isPFApplicable: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateSalaryComponent(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteSalaryComponent(input.id)),
});

// ─── SALARY ASSIGNMENTS ───────────────────────────────────────────────────────
const assignmentsRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listSalaryAssignments(input.companyId)),

  assign: protectedProcedure
    .input(
      z.object({
        employeeId: z.number(),
        structureId: z.number(),
        basicSalary: z.string(),
        currency: z.string().default("AED"),
        effectiveDate: z.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ input }) => assignSalaryStructure(input)),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        structureId: z.number().optional(),
        basicSalary: z.string().optional(),
        currency: z.string().optional(),
        effectiveDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateSalaryAssignment(id, data);
    }),
});

// ─── TAX SLABS ────────────────────────────────────────────────────────────────
const taxSlabsRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number(), year: z.number().optional() }))
    .query(({ input }) => listTaxSlabs(input.companyId, input.year)),

  upsert: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        companyId: z.number(),
        country: z.string().default("AE"),
        year: z.number(),
        fromAmount: z.string(),
        toAmount: z.string().optional(),
        rate: z.string().default("0"),
        fixedAmount: z.string().default("0"),
        description: z.string().optional(),
      })
    )
    .mutation(({ input }) => upsertTaxSlab(input as any)),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteTaxSlab(input.id)),
});

// ─── PF SETTINGS ─────────────────────────────────────────────────────────────
const pfRouter = router({
  get: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => getPfSettings(input.companyId)),

  upsert: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        isActive: z.boolean().default(true),
        employeeRate: z.string().default("0.12"),
        employerRate: z.string().default("0.12"),
        ceiling: z.string().optional(),
      })
    )
    .mutation(({ input }) => upsertPfSettings(input)),
});

// ─── LOANS ────────────────────────────────────────────────────────────────────
const loansRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number(), employeeId: z.number().optional() }))
    .query(({ input }) => listLoans(input.companyId, input.employeeId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const l = await getLoan(input.id);
      if (!l) throw new TRPCError({ code: "NOT_FOUND", message: "Loan not found" });
      return l;
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        employeeId: z.number(),
        loanType: z.string().default("Personal Loan"),
        principalAmount: z.string(),
        interestRate: z.string().default("0"),
        totalInstallments: z.number(),
        remainingInstallments: z.number(),
        monthlyDeduction: z.string(),
        disbursedDate: z.date(),
        status: z.enum(["active", "pending", "completed", "cancelled"]).default("pending"),
        approvedBy: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ input }) => createLoan(input)),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["active", "pending", "completed", "cancelled"]).optional(),
        remainingInstallments: z.number().optional(),
        monthlyDeduction: z.string().optional(),
        approvedBy: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateLoan(id, data);
    }),
});

// ─── SALARY ADVANCES ─────────────────────────────────────────────────────────
const advancesRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number(), employeeId: z.number().optional() }))
    .query(({ input }) => listAdvances(input.companyId, input.employeeId)),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        employeeId: z.number(),
        amount: z.string(),
        deductionMonth: z.number().optional(),
        deductionYear: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ input }) => createAdvance({ ...input, status: "pending" })),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pending", "approved", "rejected", "deducted"]).optional(),
        approvedBy: z.number().optional(),
        deductionMonth: z.number().optional(),
        deductionYear: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateAdvance(id, data);
    }),
});

// ─── DISBURSEMENT CYCLES ──────────────────────────────────────────────────────
const disbursementRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listDisbursementCycles(input.companyId)),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        name: z.string().min(1),
        dayOfMonth: z.number().min(1).max(31).default(25),
        bankName: z.string().optional(),
        accountFormat: z.string().default("IBAN"),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(({ input }) => createDisbursementCycle(input)),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        dayOfMonth: z.number().optional(),
        bankName: z.string().optional(),
        accountFormat: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateDisbursementCycle(id, data);
    }),
});

// ─── PAYROLL RUNS ─────────────────────────────────────────────────────────────
const runsRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listPayrollRuns(input.companyId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const r = await getPayrollRun(input.id);
      if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      return r;
    }),

  initiate: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        month: z.number().min(1).max(12),
        year: z.number().min(2000),
        currency: z.string().default("AED"),
        scope: z.enum(["all", "department", "location", "individual"]).default("all"),
        scopeIds: z.array(z.number()).optional(),
        employeeIds: z.array(z.number()),
        notes: z.string().optional(),
        runBy: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      // Create the run record
      const { id: runId } = await createPayrollRun({
        companyId: input.companyId,
        month: input.month,
        year: input.year,
        currency: input.currency,
        scope: input.scope,
        scopeIds: input.scopeIds ?? null,
        status: "processing",
        runBy: input.runBy,
        notes: input.notes,
        totalGross: "0",
        totalDeductions: "0",
        totalNet: "0",
        employeeCount: 0,
      });

      // Generate payslips
      const totals = await generatePayslips(runId, input.companyId, input.month, input.year, input.currency, input.employeeIds);

      // Update run with totals
      await updatePayrollRunStatus(runId, {
        status: "pending_approval",
        totalGross: totals.totalGross.toString(),
        totalDeductions: totals.totalDeductions.toString(),
        totalNet: totals.totalNet.toString(),
        employeeCount: totals.count,
      });

      // Run AI anomaly detection
      const payslipList = await listPayslips(runId);
      const anomalies = await detectPayrollAnomalies(runId, input.companyId, payslipList as any);
      for (const anomaly of anomalies) {
        await createAnomalyFlag({ ...anomaly, payrollRunId: runId });
      }

      return { runId, ...totals, anomalyCount: anomalies.length };
    }),

  approve: permissionProcedure("payroll", "approve")
    .input(z.object({ id: z.number(), approvedBy: z.number() }))
    .mutation(async ({ input }) => {
      await updatePayrollRunStatus(input.id, {
        status: "approved",
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
      });
      return { success: true };
    }),

  lock: permissionProcedure("payroll", "approve")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updatePayrollRunStatus(input.id, {
        status: "locked",
        lockedAt: new Date(),
      });
      return { success: true };
    }),

  disburse: permissionProcedure("payroll", "approve")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updatePayrollRunStatus(input.id, { status: "disbursed" });
      return { success: true };
    }),
});

// ─── PAYSLIPS ─────────────────────────────────────────────────────────────────
const payslipsRouter = router({
  list: protectedProcedure
    .input(z.object({ payrollRunId: z.number() }))
    .query(({ input }) => listPayslips(input.payrollRunId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const p = await getPayslip(input.id);
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Payslip not found" });
      return p;
    }),

  myPayslips: protectedProcedure
    .input(z.object({ employeeId: z.number() }))
    .query(({ input }) => getEmployeePayslips(input.employeeId)),

  updateStatus: permissionProcedure("payroll", "approve")
    .input(z.object({ id: z.number(), status: z.enum(["draft", "approved", "disbursed"]) }))
    .mutation(({ input }) => updatePayslip(input.id, { status: input.status })),
});

// ─── ANOMALY FLAGS ────────────────────────────────────────────────────────────
const anomaliesRouter = router({
  list: protectedProcedure
    .input(z.object({ payrollRunId: z.number() }))
    .query(({ input }) => listAnomalyFlags(input.payrollRunId)),

  review: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["acknowledged", "dismissed"]),
        reviewedBy: z.number(),
      })
    )
    .mutation(({ input }) =>
      updateAnomalyFlag(input.id, {
        status: input.status,
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date(),
      })
    ),
});

// ─── REPORTS ──────────────────────────────────────────────────────────────────
const reportsRouter = router({
  summary: protectedProcedure
    .input(z.object({ companyId: z.number(), month: z.number(), year: z.number() }))
    .query(({ input }) => getPayrollSummaryReport(input.companyId, input.month, input.year)),

  byDepartment: protectedProcedure
    .input(z.object({ companyId: z.number(), month: z.number(), year: z.number() }))
    .query(({ input }) => getPayrollCostByDept(input.companyId, input.month, input.year)),

  ytd: protectedProcedure
    .input(z.object({ companyId: z.number(), year: z.number() }))
    .query(({ input }) => getYtdPayrollSummary(input.companyId, input.year)),
});

// ─── AI ───────────────────────────────────────────────────────────────────────
const payrollAiRouter = router({
  explainPayslip: protectedProcedure
    .input(z.object({ payslipId: z.number() }))
    .mutation(async ({ input }) => {
      const payslip = await getPayslip(input.payslipId);
      if (!payslip) throw new TRPCError({ code: "NOT_FOUND", message: "Payslip not found" });
      const explanation = await explainPayslip(payslip as any);
      return { explanation };
    }),
});

// ─── MAIN PAYROLL ROUTER ──────────────────────────────────────────────────────
export const payrollRouter = router({
  structures: structuresRouter,
  components: componentsRouter,
  assignments: assignmentsRouter,
  taxSlabs: taxSlabsRouter,
  pf: pfRouter,
  loans: loansRouter,
  advances: advancesRouter,
  disbursement: disbursementRouter,
  runs: runsRouter,
  payslips: payslipsRouter,
  anomalies: anomaliesRouter,
  reports: reportsRouter,
  ai: payrollAiRouter,
});
