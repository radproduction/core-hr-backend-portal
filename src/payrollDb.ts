/**
 * payrollDb.ts — DB query helpers for Module 4: Payroll Management (MongoDB)
 *
 * The payroll run engine (generatePayslips) is the core computation function.
 */
import type {
  InsertDisbursementCycle,
  InsertEmployeeSalaryAssignment,
  InsertLoan,
  InsertPayrollAnomalyFlag,
  InsertPayrollRun,
  InsertPayslip,
  InsertPfSettings,
  InsertSalaryAdvance,
  InsertSalaryComponent,
  InsertSalaryStructure,
  InsertSalaryStructureComponent,
  InsertTaxSlab,
} from "../drizzle/schema";
import { getEmployees } from "./mongoDb";
import {
  insertDoc, updateDoc, findMany, findOneDoc, deleteOneDoc,
} from "./_core/mongoStore";

const STRUCTURES = "SalaryStructureRecord";
const COMPONENTS = "SalaryComponentRecord";
const STRUCTURE_COMPONENTS = "SalaryStructureComponentRecord";
const ASSIGNMENTS = "EmployeeSalaryAssignmentRecord";
const TAX_SLABS = "TaxSlabRecord";
const PF_SETTINGS = "PfSettingsRecord";
const LOANS = "LoanRecord";
const ADVANCES = "SalaryAdvanceRecord";
const CYCLES = "DisbursementCycleRecord";
const RUNS = "PayrollRunRecord";
const PAYSLIPS = "PayslipRecord"; // shared with mongoDb.ts payslip collection
const ANOMALIES = "PayrollAnomalyFlagRecord";
const EMPLOYEES = "EmployeeRecord";

// ─── Employee enrichment helpers ────────────────────────────────────────────
async function employeesByIds(ids: number[]): Promise<Map<number, any>> {
  const unique = Array.from(new Set(ids));
  if (!unique.length) return new Map();
  const emps = await findMany(EMPLOYEES, { id: { $in: unique } });
  return new Map(emps.map((e: any) => [e.id, e]));
}
const fullName = (e: any) => (e ? `${e.firstName} ${e.lastName}` : "");

// ─────────────────────────────────────────────
// SALARY STRUCTURES
// ─────────────────────────────────────────────
export async function listSalaryStructures(companyId: number) {
  return findMany(STRUCTURES, { companyId }, { name: 1 });
}

export async function getSalaryStructure(id: number) {
  return (await findOneDoc(STRUCTURES, { id })) ?? null;
}

export async function createSalaryStructure(data: InsertSalaryStructure) {
  return insertDoc(STRUCTURES, "salaryStructures", data as Record<string, unknown>);
}

export async function updateSalaryStructure(id: number, data: Partial<InsertSalaryStructure>) {
  await updateDoc(STRUCTURES, { id }, data);
}

export async function deleteSalaryStructure(id: number) {
  await deleteOneDoc(STRUCTURES, { id });
}

// ─────────────────────────────────────────────
// SALARY COMPONENTS
// ─────────────────────────────────────────────
export async function listSalaryComponents(companyId: number) {
  return findMany(COMPONENTS, { companyId }, { sortOrder: 1, name: 1 });
}

export async function getSalaryComponent(id: number) {
  return (await findOneDoc(COMPONENTS, { id })) ?? null;
}

export async function createSalaryComponent(data: InsertSalaryComponent) {
  return insertDoc(COMPONENTS, "salaryComponents", data as Record<string, unknown>);
}

export async function updateSalaryComponent(id: number, data: Partial<InsertSalaryComponent>) {
  await updateDoc(COMPONENTS, { id }, data);
}

export async function deleteSalaryComponent(id: number) {
  await deleteOneDoc(COMPONENTS, { id });
}

// ─────────────────────────────────────────────
// SALARY STRUCTURE COMPONENTS (many-to-many)
// ─────────────────────────────────────────────
export async function getStructureComponents(structureId: number) {
  const links = await findMany(STRUCTURE_COMPONENTS, { structureId });
  if (!links.length) return [];
  const compIds = links.map((l: any) => l.componentId);
  const comps = await findMany(COMPONENTS, { id: { $in: compIds } });
  const compMap = new Map(comps.map((c: any) => [c.id, c]));
  return links.map((l: any) => {
    const c: any = compMap.get(l.componentId) ?? {};
    return {
      id: l.id,
      structureId: l.structureId,
      componentId: l.componentId,
      overrideValue: l.overrideValue ?? null,
      isActive: l.isActive,
      componentName: c.name,
      componentCode: c.code,
      componentType: c.type,
      calculationType: c.calculationType,
      defaultValue: c.value,
      isTaxable: c.isTaxable,
      isPFApplicable: c.isPFApplicable,
    };
  });
}

export async function addComponentToStructure(data: InsertSalaryStructureComponent) {
  return insertDoc(STRUCTURE_COMPONENTS, "salaryStructureComponents", data as Record<string, unknown>);
}

export async function removeComponentFromStructure(id: number) {
  await deleteOneDoc(STRUCTURE_COMPONENTS, { id });
}

// ─────────────────────────────────────────────
// EMPLOYEE SALARY ASSIGNMENTS
// ─────────────────────────────────────────────
export async function getEmployeeSalaryAssignment(employeeId: number) {
  const rows = await findMany(ASSIGNMENTS, { employeeId }, { effectiveDate: -1 }, 1);
  return rows[0] ?? null;
}

export async function listSalaryAssignments(companyId: number) {
  const emps = await getEmployees(companyId);
  const empMap = new Map(emps.map((e: any) => [e.id, e]));
  const empIds = emps.map((e: any) => e.id);
  const rows = await findMany(ASSIGNMENTS, { employeeId: { $in: empIds } }, { effectiveDate: -1 });
  const structs = await findMany(STRUCTURES, { companyId });
  const structMap = new Map(structs.map((s: any) => [s.id, s]));
  return rows.map((a: any) => ({
    id: a.id,
    employeeId: a.employeeId,
    structureId: a.structureId,
    basicSalary: a.basicSalary,
    currency: a.currency,
    effectiveDate: a.effectiveDate,
    notes: a.notes,
    employeeName: fullName(empMap.get(a.employeeId)),
    structureName: (structMap.get(a.structureId) as any)?.name ?? null,
  }));
}

export async function assignSalaryStructure(data: InsertEmployeeSalaryAssignment) {
  return insertDoc(ASSIGNMENTS, "employeeSalaryAssignments", data as Record<string, unknown>);
}

export async function updateSalaryAssignment(id: number, data: Partial<InsertEmployeeSalaryAssignment>) {
  await updateDoc(ASSIGNMENTS, { id }, data);
}

// ─────────────────────────────────────────────
// TAX SLABS
// ─────────────────────────────────────────────
export async function listTaxSlabs(companyId: number, year?: number) {
  const q: Record<string, unknown> = { companyId };
  if (year) q.year = year;
  return findMany(TAX_SLABS, q, { year: 1, fromAmount: 1 });
}

export async function upsertTaxSlab(data: InsertTaxSlab) {
  if ((data as any).id) {
    const { id, ...rest } = data as any;
    await updateDoc(TAX_SLABS, { id }, rest);
    return { id };
  }
  return insertDoc(TAX_SLABS, "taxSlabs", data as Record<string, unknown>);
}

export async function deleteTaxSlab(id: number) {
  await deleteOneDoc(TAX_SLABS, { id });
}

/** Compute tax for a given annual gross using progressive slabs. */
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
  return (await findOneDoc(PF_SETTINGS, { companyId })) ?? null;
}

export async function upsertPfSettings(data: InsertPfSettings & { companyId: number }) {
  const existing = await getPfSettings(data.companyId);
  if (existing) {
    await updateDoc(PF_SETTINGS, { companyId: data.companyId }, data as Record<string, unknown>);
    return { id: existing.id };
  }
  return insertDoc(PF_SETTINGS, "pfSettings", data as Record<string, unknown>);
}

// ─────────────────────────────────────────────
// LOANS
// ─────────────────────────────────────────────
export async function listLoans(companyId: number, employeeId?: number) {
  const q: Record<string, unknown> = { companyId };
  if (employeeId) q.employeeId = employeeId;
  const rows = await findMany(LOANS, q, { createdAt: -1 });
  const empMap = await employeesByIds(rows.map((r: any) => r.employeeId));
  return rows.map((l: any) => ({ ...l, employeeName: fullName(empMap.get(l.employeeId)) }));
}

export async function getLoan(id: number) {
  return (await findOneDoc(LOANS, { id })) ?? null;
}

export async function createLoan(data: InsertLoan) {
  return insertDoc(LOANS, "loans", data as Record<string, unknown>);
}

export async function updateLoan(id: number, data: Partial<InsertLoan>) {
  await updateDoc(LOANS, { id }, data);
}

export async function getActiveLoanDeductionsForEmployee(employeeId: number): Promise<number> {
  const activeLoans = await findMany(LOANS, { employeeId, status: "active" });
  return activeLoans.reduce((sum: number, l: any) => sum + parseFloat(l.monthlyDeduction), 0);
}

// ─────────────────────────────────────────────
// SALARY ADVANCES
// ─────────────────────────────────────────────
export async function listAdvances(companyId: number, employeeId?: number) {
  const q: Record<string, unknown> = { companyId };
  if (employeeId) q.employeeId = employeeId;
  const rows = await findMany(ADVANCES, q, { requestedDate: -1 });
  const empMap = await employeesByIds(rows.map((r: any) => r.employeeId));
  return rows.map((a: any) => ({ ...a, employeeName: fullName(empMap.get(a.employeeId)) }));
}

export async function createAdvance(data: InsertSalaryAdvance) {
  return insertDoc(ADVANCES, "salaryAdvances", data as Record<string, unknown>);
}

export async function updateAdvance(id: number, data: Partial<InsertSalaryAdvance>) {
  await updateDoc(ADVANCES, { id }, data);
}

export async function getAdvanceDeductionsForMonth(employeeId: number, month: number, year: number): Promise<number> {
  const rows = await findMany(ADVANCES, { employeeId, deductionMonth: month, deductionYear: year, status: "approved" });
  return rows.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0);
}

// ─────────────────────────────────────────────
// DISBURSEMENT CYCLES
// ─────────────────────────────────────────────
export async function listDisbursementCycles(companyId: number) {
  return findMany(CYCLES, { companyId });
}

export async function createDisbursementCycle(data: InsertDisbursementCycle) {
  return insertDoc(CYCLES, "disbursementCycles", data as Record<string, unknown>);
}

export async function updateDisbursementCycle(id: number, data: Partial<InsertDisbursementCycle>) {
  await updateDoc(CYCLES, { id }, data);
}

// ─────────────────────────────────────────────
// PAYROLL RUNS
// ─────────────────────────────────────────────
export async function listPayrollRuns(companyId: number) {
  return findMany(RUNS, { companyId }, { year: -1, month: -1 });
}

export async function getPayrollRun(id: number) {
  return (await findOneDoc(RUNS, { id })) ?? null;
}

export async function createPayrollRun(data: InsertPayrollRun) {
  return insertDoc(RUNS, "payrollRuns", data as Record<string, unknown>);
}

export async function updatePayrollRunStatus(
  id: number,
  data: Partial<Pick<InsertPayrollRun, "status" | "approvedBy" | "approvedAt" | "lockedAt" | "totalGross" | "totalDeductions" | "totalNet" | "employeeCount">>
) {
  await updateDoc(RUNS, { id }, data as Record<string, unknown>);
}

// ─────────────────────────────────────────────
// PAYSLIPS
// ─────────────────────────────────────────────
export async function listPayslips(payrollRunId: number) {
  const rows = await findMany(PAYSLIPS, { payrollRunId });
  const empMap = await employeesByIds(rows.map((r: any) => r.employeeId));
  return rows
    .map((p: any) => {
      const e = empMap.get(p.employeeId);
      return { ...p, employeeName: fullName(e), employeeNumber: e?.employeeNumber ?? null };
    })
    .sort((a: any, b: any) => (a.employeeName || "").localeCompare(b.employeeName || ""));
}

export async function getPayslip(id: number) {
  const p = await findOneDoc(PAYSLIPS, { id });
  if (!p) return null;
  const e = (await findOneDoc(EMPLOYEES, { id: p.employeeId })) ?? null;
  return { ...p, employeeName: fullName(e), employeeNumber: e?.employeeNumber ?? null, workEmail: e?.workEmail ?? null };
}

export async function getEmployeePayslips(employeeId: number) {
  return findMany(PAYSLIPS, { employeeId }, { year: -1, month: -1 });
}

export async function insertPayslip(data: InsertPayslip) {
  return insertDoc(PAYSLIPS, "payslips", data as Record<string, unknown>);
}

export async function updatePayslip(id: number, data: Partial<InsertPayslip>) {
  await updateDoc(PAYSLIPS, { id }, data as Record<string, unknown>);
}

// ─────────────────────────────────────────────
// PAYROLL ANOMALY FLAGS
// ─────────────────────────────────────────────
export async function listAnomalyFlags(payrollRunId: number) {
  const rows = await findMany(ANOMALIES, { payrollRunId }, { createdAt: -1 });
  const empMap = await employeesByIds(rows.map((r: any) => r.employeeId));
  return rows.map((f: any) => ({ ...f, employeeName: fullName(empMap.get(f.employeeId)) }));
}

export async function createAnomalyFlag(data: InsertPayrollAnomalyFlag) {
  return insertDoc(ANOMALIES, "payrollAnomalyFlags", data as Record<string, unknown>);
}

export async function updateAnomalyFlag(id: number, data: Partial<InsertPayrollAnomalyFlag>) {
  await updateDoc(ANOMALIES, { id }, data as Record<string, unknown>);
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

export async function computePayslipForEmployee(
  employeeId: number,
  month: number,
  year: number,
  companyId: number
): Promise<PayslipComputeResult | null> {
  const assignment = await getEmployeeSalaryAssignment(employeeId);
  if (!assignment) return null;

  const basicSalary = parseFloat(assignment.basicSalary);
  const structureComps = await getStructureComponents(assignment.structureId);

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

  const pf = await getPfSettings(companyId);
  let pfEmployee = 0;
  let pfEmployer = 0;
  if (pf && pf.isActive) {
    const pfBase = pf.ceiling ? Math.min(basicSalary, parseFloat(pf.ceiling)) : basicSalary;
    pfEmployee = Math.round(pfBase * parseFloat(pf.employeeRate) * 100) / 100;
    pfEmployer = Math.round(pfBase * parseFloat(pf.employerRate) * 100) / 100;
    totalDeductions += pfEmployee;
  }

  const slabs = await listTaxSlabs(companyId, year);
  const annualGross = grossSalary * 12;
  const annualTax = computeTaxForAmount(slabs as any, annualGross);
  const taxAmount = Math.round((annualTax / 12) * 100) / 100;
  totalDeductions += taxAmount;

  const loanDeductions = await getActiveLoanDeductionsForEmployee(employeeId);
  totalDeductions += loanDeductions;

  const advanceDeductions = await getAdvanceDeductionsForMonth(employeeId, month, year);
  totalDeductions += advanceDeductions;

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
    } as InsertPayslip);

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
  const emps = await getEmployees(companyId);
  const empMap = new Map(emps.map((e: any) => [e.id, e]));
  const empIds = emps.map((e: any) => e.id);
  const rows = await findMany(PAYSLIPS, { employeeId: { $in: empIds }, month, year });
  return rows
    .map((p: any) => {
      const e: any = empMap.get(p.employeeId);
      return {
        id: p.id,
        employeeId: p.employeeId,
        employeeName: fullName(e),
        employeeNumber: e?.employeeNumber ?? null,
        basicSalary: p.basicSalary,
        grossSalary: p.grossSalary,
        totalDeductions: p.totalDeductions,
        taxAmount: p.taxAmount,
        pfEmployee: p.pfEmployee,
        pfEmployer: p.pfEmployer,
        loanDeductions: p.loanDeductions,
        netSalary: p.netSalary,
        currency: p.currency,
        status: p.status,
      };
    })
    .sort((a: any, b: any) => (a.employeeName || "").localeCompare(b.employeeName || ""));
}

export async function getPayrollCostByDept(companyId: number, month: number, year: number) {
  const emps = await getEmployees(companyId);
  const empMap = new Map(emps.map((e: any) => [e.id, e]));
  const empIds = emps.map((e: any) => e.id);
  const rows = await findMany(PAYSLIPS, { employeeId: { $in: empIds }, month, year });
  const byDept = new Map<number | null, { departmentId: number | null; totalNet: number; totalGross: number; headcount: number }>();
  for (const p of rows) {
    const deptId = (empMap.get(p.employeeId) as any)?.departmentId ?? null;
    const agg = byDept.get(deptId) ?? { departmentId: deptId, totalNet: 0, totalGross: 0, headcount: 0 };
    agg.totalNet += parseFloat(p.netSalary || "0");
    agg.totalGross += parseFloat(p.grossSalary || "0");
    agg.headcount += 1;
    byDept.set(deptId, agg);
  }
  return Array.from(byDept.values());
}

export async function getYtdPayrollSummary(companyId: number, year: number) {
  const emps = await getEmployees(companyId);
  const empIds = emps.map((e: any) => e.id);
  const rows = await findMany(PAYSLIPS, { employeeId: { $in: empIds }, year });
  const byMonth = new Map<number, { month: number; totalGross: number; totalNet: number; totalTax: number; employees: Set<number> }>();
  for (const p of rows) {
    const agg = byMonth.get(p.month) ?? { month: p.month, totalGross: 0, totalNet: 0, totalTax: 0, employees: new Set<number>() };
    agg.totalGross += parseFloat(p.grossSalary || "0");
    agg.totalNet += parseFloat(p.netSalary || "0");
    agg.totalTax += parseFloat(p.taxAmount || "0");
    agg.employees.add(p.employeeId);
    byMonth.set(p.month, agg);
  }
  return Array.from(byMonth.values())
    .map((m) => ({ month: m.month, totalGross: m.totalGross, totalNet: m.totalNet, totalTax: m.totalTax, headcount: m.employees.size }))
    .sort((a, b) => a.month - b.month);
}
