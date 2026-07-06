/**
 * payrollDb.ts — DB query helpers for Module 4: Payroll Management
 *
 * All helpers return raw Drizzle rows. Business logic lives in the router.
 * The payroll run engine (generatePayslips) is the core computation function.
 */
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  disbursementCycles,
  employeeSalaryAssignments,
  employees,
  loans,
  payrollAnomalyFlags,
  payrollRuns,
  payslips,
  pfSettings,
  salaryAdvances,
  salaryComponents,
  salaryStructureComponents,
  salaryStructures,
  taxSlabs,
  type InsertDisbursementCycle,
  type InsertEmployeeSalaryAssignment,
  type InsertLoan,
  type InsertPayrollAnomalyFlag,
  type InsertPayrollRun,
  type InsertPayslip,
  type InsertPfSettings,
  type InsertSalaryAdvance,
  type InsertSalaryComponent,
  type InsertSalaryStructure,
  type InsertSalaryStructureComponent,
  type InsertTaxSlab,
} from "../drizzle/schema";

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

// ─────────────────────────────────────────────
// SALARY STRUCTURES
// ─────────────────────────────────────────────
export async function listSalaryStructures(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.select().from(salaryStructures).where(eq(salaryStructures.companyId, companyId)).orderBy(salaryStructures.name);
}

export async function getSalaryStructure(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.select().from(salaryStructures).where(eq(salaryStructures.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSalaryStructure(data: InsertSalaryStructure) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(salaryStructures).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateSalaryStructure(id: number, data: Partial<InsertSalaryStructure>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(salaryStructures).set(data).where(eq(salaryStructures.id, id));
}

export async function deleteSalaryStructure(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(salaryStructures).where(eq(salaryStructures.id, id));
}

// ─────────────────────────────────────────────
// SALARY COMPONENTS
// ─────────────────────────────────────────────
export async function listSalaryComponents(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.select().from(salaryComponents).where(eq(salaryComponents.companyId, companyId)).orderBy(salaryComponents.sortOrder, salaryComponents.name);
}

export async function getSalaryComponent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.select().from(salaryComponents).where(eq(salaryComponents.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSalaryComponent(data: InsertSalaryComponent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(salaryComponents).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateSalaryComponent(id: number, data: Partial<InsertSalaryComponent>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(salaryComponents).set(data).where(eq(salaryComponents.id, id));
}

export async function deleteSalaryComponent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(salaryComponents).where(eq(salaryComponents.id, id));
}

// ─────────────────────────────────────────────
// SALARY STRUCTURE COMPONENTS (many-to-many)
// ─────────────────────────────────────────────
export async function getStructureComponents(structureId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .select({
      id: salaryStructureComponents.id,
      structureId: salaryStructureComponents.structureId,
      componentId: salaryStructureComponents.componentId,
      overrideValue: salaryStructureComponents.overrideValue,
      isActive: salaryStructureComponents.isActive,
      componentName: salaryComponents.name,
      componentCode: salaryComponents.code,
      componentType: salaryComponents.type,
      calculationType: salaryComponents.calculationType,
      defaultValue: salaryComponents.value,
      isTaxable: salaryComponents.isTaxable,
      isPFApplicable: salaryComponents.isPFApplicable,
    })
    .from(salaryStructureComponents)
    .innerJoin(salaryComponents, eq(salaryStructureComponents.componentId, salaryComponents.id))
    .where(eq(salaryStructureComponents.structureId, structureId));
}

export async function addComponentToStructure(data: InsertSalaryStructureComponent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(salaryStructureComponents).values(data);
  return { id: Number(result[0].insertId) };
}

export async function removeComponentFromStructure(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(salaryStructureComponents).where(eq(salaryStructureComponents.id, id));
}

// ─────────────────────────────────────────────
// EMPLOYEE SALARY ASSIGNMENTS
// ─────────────────────────────────────────────
export async function getEmployeeSalaryAssignment(employeeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db
    .select()
    .from(employeeSalaryAssignments)
    .where(eq(employeeSalaryAssignments.employeeId, employeeId))
    .orderBy(desc(employeeSalaryAssignments.effectiveDate))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSalaryAssignments(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .select({
      id: employeeSalaryAssignments.id,
      employeeId: employeeSalaryAssignments.employeeId,
      structureId: employeeSalaryAssignments.structureId,
      basicSalary: employeeSalaryAssignments.basicSalary,
      currency: employeeSalaryAssignments.currency,
      effectiveDate: employeeSalaryAssignments.effectiveDate,
      notes: employeeSalaryAssignments.notes,
      employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
      structureName: salaryStructures.name,
    })
    .from(employeeSalaryAssignments)
    .innerJoin(employees, eq(employeeSalaryAssignments.employeeId, employees.id))
    .innerJoin(salaryStructures, eq(employeeSalaryAssignments.structureId, salaryStructures.id))
    .where(eq(employees.companyId, companyId))
    .orderBy(desc(employeeSalaryAssignments.effectiveDate));
}

export async function assignSalaryStructure(data: InsertEmployeeSalaryAssignment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(employeeSalaryAssignments).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateSalaryAssignment(id: number, data: Partial<InsertEmployeeSalaryAssignment>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(employeeSalaryAssignments).set(data).where(eq(employeeSalaryAssignments.id, id));
}

// ─────────────────────────────────────────────
// TAX SLABS
// ─────────────────────────────────────────────
export async function listTaxSlabs(companyId: number, year?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const conditions = [eq(taxSlabs.companyId, companyId)];
  if (year) conditions.push(eq(taxSlabs.year, year));
  return db.select().from(taxSlabs).where(and(...conditions)).orderBy(taxSlabs.year, taxSlabs.fromAmount);
}

export async function upsertTaxSlab(data: InsertTaxSlab) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if ((data as any).id) {
    const { id, ...rest } = data as any;
    await db.update(taxSlabs).set(rest).where(eq(taxSlabs.id, id));
    return { id };
  }
  const result = await db.insert(taxSlabs).values(data);
  return { id: Number(result[0].insertId) };
}

export async function deleteTaxSlab(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(taxSlabs).where(eq(taxSlabs.id, id));
}

/**
 * Compute tax for a given annual gross using progressive slabs.
 */
export function computeTaxForAmount(slabs: Array<{ fromAmount: string; toAmount: string | null; rate: string; fixedAmount: string }>, annualGross: number): number {
  let tax = 0;
  for (const slab of slabs) {
    const from = parseFloat(slab.fromAmount);
    const to = slab.toAmount ? parseFloat(slab.toAmount) : Infinity;
    const rate = parseFloat(slab.rate);
    const fixed = parseFloat(slab.fixedAmount);
    if (annualGross > from) {
      const taxableInSlab = Math.min(annualGross, to) - from;
      tax += fixed + taxableInSlab * (rate / 100);
    }
  }
  return Math.round(tax * 100) / 100;
}

// ─────────────────────────────────────────────
// PF SETTINGS
// ─────────────────────────────────────────────
export async function getPfSettings(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.select().from(pfSettings).where(eq(pfSettings.companyId, companyId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertPfSettings(data: InsertPfSettings & { companyId: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getPfSettings(data.companyId);
  if (existing) {
    await db.update(pfSettings).set(data).where(eq(pfSettings.companyId, data.companyId));
    return { id: existing.id };
  }
  const result = await db.insert(pfSettings).values(data);
  return { id: Number(result[0].insertId) };
}

// ─────────────────────────────────────────────
// LOANS
// ─────────────────────────────────────────────
export async function listLoans(companyId: number, employeeId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const conditions = [eq(loans.companyId, companyId)];
  if (employeeId) conditions.push(eq(loans.employeeId, employeeId));
  return db
    .select({
      id: loans.id,
      companyId: loans.companyId,
      employeeId: loans.employeeId,
      loanType: loans.loanType,
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      totalInstallments: loans.totalInstallments,
      remainingInstallments: loans.remainingInstallments,
      monthlyDeduction: loans.monthlyDeduction,
      disbursedDate: loans.disbursedDate,
      status: loans.status,
      approvedBy: loans.approvedBy,
      notes: loans.notes,
      createdAt: loans.createdAt,
      employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
    })
    .from(loans)
    .innerJoin(employees, eq(loans.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(loans.createdAt));
}

export async function getLoan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.select().from(loans).where(eq(loans.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createLoan(data: InsertLoan) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(loans).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateLoan(id: number, data: Partial<InsertLoan>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(loans).set(data).where(eq(loans.id, id));
}

export async function getActiveLoanDeductionsForEmployee(employeeId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const activeLoans = await db
    .select({ monthlyDeduction: loans.monthlyDeduction })
    .from(loans)
    .where(and(eq(loans.employeeId, employeeId), eq(loans.status, "active")));
  return activeLoans.reduce((sum, l) => sum + parseFloat(l.monthlyDeduction), 0);
}

// ─────────────────────────────────────────────
// SALARY ADVANCES
// ─────────────────────────────────────────────
export async function listAdvances(companyId: number, employeeId?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const conditions = [eq(salaryAdvances.companyId, companyId)];
  if (employeeId) conditions.push(eq(salaryAdvances.employeeId, employeeId));
  return db
    .select({
      id: salaryAdvances.id,
      companyId: salaryAdvances.companyId,
      employeeId: salaryAdvances.employeeId,
      amount: salaryAdvances.amount,
      requestedDate: salaryAdvances.requestedDate,
      approvedDate: salaryAdvances.approvedDate,
      deductionMonth: salaryAdvances.deductionMonth,
      deductionYear: salaryAdvances.deductionYear,
      status: salaryAdvances.status,
      approvedBy: salaryAdvances.approvedBy,
      notes: salaryAdvances.notes,
      employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
    })
    .from(salaryAdvances)
    .innerJoin(employees, eq(salaryAdvances.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(salaryAdvances.requestedDate));
}

export async function createAdvance(data: InsertSalaryAdvance) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(salaryAdvances).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateAdvance(id: number, data: Partial<InsertSalaryAdvance>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(salaryAdvances).set(data).where(eq(salaryAdvances.id, id));
}

export async function getAdvanceDeductionsForMonth(employeeId: number, month: number, year: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db
    .select({ amount: salaryAdvances.amount })
    .from(salaryAdvances)
    .where(
      and(
        eq(salaryAdvances.employeeId, employeeId),
        eq(salaryAdvances.deductionMonth, month),
        eq(salaryAdvances.deductionYear, year),
        eq(salaryAdvances.status, "approved")
      )
    );
  return rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);
}

// ─────────────────────────────────────────────
// DISBURSEMENT CYCLES
// ─────────────────────────────────────────────
export async function listDisbursementCycles(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.select().from(disbursementCycles).where(eq(disbursementCycles.companyId, companyId));
}

export async function createDisbursementCycle(data: InsertDisbursementCycle) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(disbursementCycles).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateDisbursementCycle(id: number, data: Partial<InsertDisbursementCycle>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(disbursementCycles).set(data).where(eq(disbursementCycles.id, id));
}

// ─────────────────────────────────────────────
// PAYROLL RUNS
// ─────────────────────────────────────────────
export async function listPayrollRuns(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.companyId, companyId))
    .orderBy(desc(payrollRuns.year), desc(payrollRuns.month));
}

export async function getPayrollRun(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPayrollRun(data: InsertPayrollRun) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(payrollRuns).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updatePayrollRunStatus(
  id: number,
  data: Partial<Pick<InsertPayrollRun, "status" | "approvedBy" | "approvedAt" | "lockedAt" | "totalGross" | "totalDeductions" | "totalNet" | "employeeCount">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(payrollRuns).set(data as any).where(eq(payrollRuns.id, id));
}

// ─────────────────────────────────────────────
// PAYSLIPS
// ─────────────────────────────────────────────
export async function listPayslips(payrollRunId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .select({
      id: payslips.id,
      payrollRunId: payslips.payrollRunId,
      employeeId: payslips.employeeId,
      month: payslips.month,
      year: payslips.year,
      basicSalary: payslips.basicSalary,
      grossSalary: payslips.grossSalary,
      totalEarnings: payslips.totalEarnings,
      totalDeductions: payslips.totalDeductions,
      taxAmount: payslips.taxAmount,
      pfEmployee: payslips.pfEmployee,
      pfEmployer: payslips.pfEmployer,
      loanDeductions: payslips.loanDeductions,
      advanceDeductions: payslips.advanceDeductions,
      lateDeductions: payslips.lateDeductions,
      absentDeductions: payslips.absentDeductions,
      netSalary: payslips.netSalary,
      currency: payslips.currency,
      attendanceDays: payslips.attendanceDays,
      absentDays: payslips.absentDays,
      components: payslips.components,
      status: payslips.status,
      pdfKey: payslips.pdfKey,
      createdAt: payslips.createdAt,
      employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
      employeeNumber: employees.employeeNumber,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payrollRunId, payrollRunId))
    .orderBy(employees.firstName);
}

export async function getPayslip(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db
    .select({
      id: payslips.id,
      payrollRunId: payslips.payrollRunId,
      employeeId: payslips.employeeId,
      month: payslips.month,
      year: payslips.year,
      basicSalary: payslips.basicSalary,
      grossSalary: payslips.grossSalary,
      totalEarnings: payslips.totalEarnings,
      totalDeductions: payslips.totalDeductions,
      taxAmount: payslips.taxAmount,
      pfEmployee: payslips.pfEmployee,
      pfEmployer: payslips.pfEmployer,
      loanDeductions: payslips.loanDeductions,
      advanceDeductions: payslips.advanceDeductions,
      lateDeductions: payslips.lateDeductions,
      absentDeductions: payslips.absentDeductions,
      netSalary: payslips.netSalary,
      currency: payslips.currency,
      attendanceDays: payslips.attendanceDays,
      absentDays: payslips.absentDays,
      components: payslips.components,
      status: payslips.status,
      pdfKey: payslips.pdfKey,
      createdAt: payslips.createdAt,
      employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
      employeeNumber: employees.employeeNumber,
      workEmail: employees.workEmail,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getEmployeePayslips(employeeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .select()
    .from(payslips)
    .where(eq(payslips.employeeId, employeeId))
    .orderBy(desc(payslips.year), desc(payslips.month));
}

export async function insertPayslip(data: InsertPayslip) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(payslips).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updatePayslip(id: number, data: Partial<InsertPayslip>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(payslips).set(data as any).where(eq(payslips.id, id));
}

// ─────────────────────────────────────────────
// PAYROLL ANOMALY FLAGS
// ─────────────────────────────────────────────
export async function listAnomalyFlags(payrollRunId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .select({
      id: payrollAnomalyFlags.id,
      payrollRunId: payrollAnomalyFlags.payrollRunId,
      employeeId: payrollAnomalyFlags.employeeId,
      type: payrollAnomalyFlags.type,
      severity: payrollAnomalyFlags.severity,
      description: payrollAnomalyFlags.description,
      previousValue: payrollAnomalyFlags.previousValue,
      currentValue: payrollAnomalyFlags.currentValue,
      percentChange: payrollAnomalyFlags.percentChange,
      status: payrollAnomalyFlags.status,
      reviewedBy: payrollAnomalyFlags.reviewedBy,
      reviewedAt: payrollAnomalyFlags.reviewedAt,
      createdAt: payrollAnomalyFlags.createdAt,
      employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
    })
    .from(payrollAnomalyFlags)
    .innerJoin(employees, eq(payrollAnomalyFlags.employeeId, employees.id))
    .where(eq(payrollAnomalyFlags.payrollRunId, payrollRunId))
    .orderBy(payrollAnomalyFlags.severity, desc(payrollAnomalyFlags.createdAt));
}

export async function createAnomalyFlag(data: InsertPayrollAnomalyFlag) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(payrollAnomalyFlags).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateAnomalyFlag(id: number, data: Partial<InsertPayrollAnomalyFlag>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(payrollAnomalyFlags).set(data as any).where(eq(payrollAnomalyFlags.id, id));
}

// ─────────────────────────────────────────────
// PAYROLL RUN ENGINE
// ─────────────────────────────────────────────

interface PayslipComputeResult {
  employeeId: number;
  basicSalary: number;
  grossSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  taxAmount: number;
  pfEmployee: number;
  pfEmployer: number;
  loanDeductions: number;
  advanceDeductions: number;
  lateDeductions: number;
  absentDeductions: number;
  netSalary: number;
  components: Array<{ code: string; name: string; type: string; amount: number }>;
}

/**
 * Core payroll computation for a single employee.
 * Returns a computed payslip object (not yet persisted).
 */
export async function computePayslipForEmployee(
  employeeId: number,
  month: number,
  year: number,
  companyId: number
): Promise<PayslipComputeResult | null> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // 1. Get current salary assignment
  const assignment = await getEmployeeSalaryAssignment(employeeId);
  if (!assignment) return null;

  const basicSalary = parseFloat(assignment.basicSalary);

  // 2. Get structure components
  const structureComps = await getStructureComponents(assignment.structureId);

  // 3. Compute earnings and deductions from components
  const components: Array<{ code: string; name: string; type: string; amount: number }> = [];
  let totalEarnings = basicSalary;
  let totalDeductions = 0;

  for (const comp of structureComps) {
    if (!comp.isActive) continue;
    const rawValue = comp.overrideValue ? parseFloat(comp.overrideValue) : parseFloat(comp.defaultValue);
    let amount = 0;

    if (comp.calculationType === "fixed") {
      amount = rawValue;
    } else if (comp.calculationType === "percentage_of_basic") {
      amount = (basicSalary * rawValue) / 100;
    } else if (comp.calculationType === "percentage_of_gross") {
      // Approximate: use basic for now; gross is computed after earnings
      amount = (basicSalary * rawValue) / 100;
    }

    amount = Math.round(amount * 100) / 100;

    if (comp.componentType === "earning") {
      totalEarnings += amount;
    } else if (comp.componentType === "deduction") {
      totalDeductions += amount;
    }

    components.push({ code: comp.componentCode, name: comp.componentName, type: comp.componentType, amount });
  }

  const grossSalary = totalEarnings;

  // 4. PF computation
  const pf = await getPfSettings(companyId);
  let pfEmployee = 0;
  let pfEmployer = 0;
  if (pf && pf.isActive) {
    const pfBase = pf.ceiling ? Math.min(basicSalary, parseFloat(pf.ceiling)) : basicSalary;
    pfEmployee = Math.round(pfBase * parseFloat(pf.employeeRate) * 100) / 100;
    pfEmployer = Math.round(pfBase * parseFloat(pf.employerRate) * 100) / 100;
    totalDeductions += pfEmployee;
  }

  // 5. Tax computation (annual gross → monthly tax)
  const slabs = await listTaxSlabs(companyId, year);
  const annualGross = grossSalary * 12;
  const annualTax = computeTaxForAmount(slabs, annualGross);
  const taxAmount = Math.round((annualTax / 12) * 100) / 100;
  totalDeductions += taxAmount;

  // 6. Loan deductions
  const loanDeductions = await getActiveLoanDeductionsForEmployee(employeeId);
  totalDeductions += loanDeductions;

  // 7. Advance deductions
  const advanceDeductions = await getAdvanceDeductionsForMonth(employeeId, month, year);
  totalDeductions += advanceDeductions;

  // 8. Attendance-linked deductions (late/absent) — placeholder (0 if no attendance data)
  const lateDeductions = 0;
  const absentDeductions = 0;

  const netSalary = Math.max(0, Math.round((grossSalary - totalDeductions) * 100) / 100);

  return {
    employeeId,
    basicSalary,
    grossSalary,
    totalEarnings,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    taxAmount,
    pfEmployee,
    pfEmployer,
    loanDeductions,
    advanceDeductions,
    lateDeductions,
    absentDeductions,
    netSalary,
    components,
  };
}

/**
 * Generate payslips for all employees in a payroll run.
 * Returns the count of payslips created and totals.
 */
export async function generatePayslips(
  payrollRunId: number,
  companyId: number,
  month: number,
  year: number,
  currency: string,
  employeeIds: number[]
): Promise<{ count: number; totalGross: number; totalDeductions: number; totalNet: number }> {
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;
  let count = 0;

  for (const empId of employeeIds) {
    const result = await computePayslipForEmployee(empId, month, year, companyId);
    if (!result) continue;

    await insertPayslip({
      payrollRunId,
      employeeId: empId,
      month,
      year,
      basicSalary: result.basicSalary.toString(),
      grossSalary: result.grossSalary.toString(),
      totalEarnings: result.totalEarnings.toString(),
      totalDeductions: result.totalDeductions.toString(),
      taxAmount: result.taxAmount.toString(),
      pfEmployee: result.pfEmployee.toString(),
      pfEmployer: result.pfEmployer.toString(),
      loanDeductions: result.loanDeductions.toString(),
      advanceDeductions: result.advanceDeductions.toString(),
      lateDeductions: result.lateDeductions.toString(),
      absentDeductions: result.absentDeductions.toString(),
      netSalary: result.netSalary.toString(),
      currency,
      components: result.components,
      status: "draft",
    });

    totalGross += result.grossSalary;
    totalDeductions += result.totalDeductions;
    totalNet += result.netSalary;
    count++;
  }

  return {
    count,
    totalGross: Math.round(totalGross * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
  };
}

// ─────────────────────────────────────────────
// REPORTS HELPERS
// ─────────────────────────────────────────────
export async function getPayrollSummaryReport(companyId: number, month: number, year: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .select({
      id: payslips.id,
      employeeId: payslips.employeeId,
      employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
      employeeNumber: employees.employeeNumber,
      basicSalary: payslips.basicSalary,
      grossSalary: payslips.grossSalary,
      totalDeductions: payslips.totalDeductions,
      taxAmount: payslips.taxAmount,
      pfEmployee: payslips.pfEmployee,
      pfEmployer: payslips.pfEmployer,
      loanDeductions: payslips.loanDeductions,
      netSalary: payslips.netSalary,
      currency: payslips.currency,
      status: payslips.status,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(and(eq(employees.companyId, companyId), eq(payslips.month, month), eq(payslips.year, year)))
    .orderBy(employees.firstName);
}

export async function getPayrollCostByDept(companyId: number, month: number, year: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .select({
      departmentId: employees.departmentId,
      totalNet: sql<number>`SUM(CAST(${payslips.netSalary} AS DECIMAL(14,2)))`,
      totalGross: sql<number>`SUM(CAST(${payslips.grossSalary} AS DECIMAL(14,2)))`,
      headcount: sql<number>`COUNT(${payslips.id})`,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(and(eq(employees.companyId, companyId), eq(payslips.month, month), eq(payslips.year, year)))
    .groupBy(employees.departmentId);
}

export async function getYtdPayrollSummary(companyId: number, year: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .select({
      month: payslips.month,
      totalGross: sql<number>`SUM(CAST(${payslips.grossSalary} AS DECIMAL(14,2)))`,
      totalNet: sql<number>`SUM(CAST(${payslips.netSalary} AS DECIMAL(14,2)))`,
      totalTax: sql<number>`SUM(CAST(${payslips.taxAmount} AS DECIMAL(14,2)))`,
      headcount: sql<number>`COUNT(DISTINCT ${payslips.employeeId})`,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(and(eq(employees.companyId, companyId), eq(payslips.year, year)))
    .groupBy(payslips.month)
    .orderBy(payslips.month);
}
