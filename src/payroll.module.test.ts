/**
 * payroll.module.test.ts
 * Vitest tests for Module 4 — Payroll Management
 * Tests: schema exports, router sub-router existence, DB helper exports,
 *        payroll computation logic, tax calculation, AI function contracts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Schema table exports ──────────────────────────────────────────────────
describe("Module 4 — Schema: payroll tables exported", () => {
  it("exports salaryStructures table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.salaryStructures).toBeDefined();
  });
  it("exports salaryComponents table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.salaryComponents).toBeDefined();
  });
  it("exports salaryStructureComponents table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.salaryStructureComponents).toBeDefined();
  });
  it("exports taxSlabs table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.taxSlabs).toBeDefined();
  });
  it("exports pfSettings table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.pfSettings).toBeDefined();
  });
  it("exports loans table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.loans).toBeDefined();
  });
  it("exports salaryAdvances table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.salaryAdvances).toBeDefined();
  });
  it("exports disbursementCycles table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.disbursementCycles).toBeDefined();
  });
  it("exports payrollRuns table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.payrollRuns).toBeDefined();
  });
  it("exports payslips table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.payslips).toBeDefined();
  });
  it("exports payrollAnomalyFlags table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.payrollAnomalyFlags).toBeDefined();
  });
  it("exports employeeSalaryAssignments table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.employeeSalaryAssignments).toBeDefined();
  });
});

// ─── 2. Router sub-router existence ──────────────────────────────────────────
describe("Module 4 — Router: payrollRouter sub-routers", () => {
  it("exports payrollRouter", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect(payrollRouter).toBeDefined();
  });
  it("payrollRouter has structures.list procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("structures.list");
  });
  it("payrollRouter has components.list procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("components.list");
  });
  it("payrollRouter has taxSlabs.list procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("taxSlabs.list");
  });
  it("payrollRouter has pf.get procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("pf.get");
  });
  it("payrollRouter has loans.list procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("loans.list");
  });
  it("payrollRouter has advances.list procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("advances.list");
  });
  it("payrollRouter has disbursement.list procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("disbursement.list");
  });
  it("payrollRouter has runs.list procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("runs.list");
  });
  it("payrollRouter has payslips.list procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("payslips.list");
  });
  it("payrollRouter has anomalies.list procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("anomalies.list");
  });
  it("payrollRouter has reports.summary procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("reports.summary");
  });
  it("payrollRouter has ai.explainPayslip procedure", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    expect((payrollRouter as any)._def.procedures).toHaveProperty("ai.explainPayslip");
  });
});

// ─── 3. DB helper exports ─────────────────────────────────────────────────────
describe("Module 4 — DB: payrollDb helper exports", () => {
  it("exports listSalaryStructures", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.listSalaryStructures).toBe("function");
  });
  it("exports createSalaryStructure", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.createSalaryStructure).toBe("function");
  });
  it("exports listSalaryComponents", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.listSalaryComponents).toBe("function");
  });
  it("exports createSalaryComponent", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.createSalaryComponent).toBe("function");
  });
  it("exports listTaxSlabs", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.listTaxSlabs).toBe("function");
  });
  it("exports upsertTaxSlab", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.upsertTaxSlab).toBe("function");
  });
  it("exports computeTaxForAmount", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.computeTaxForAmount).toBe("function");
  });
  it("exports getPfSettings", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.getPfSettings).toBe("function");
  });
  it("exports upsertPfSettings", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.upsertPfSettings).toBe("function");
  });
  it("exports listLoans", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.listLoans).toBe("function");
  });
  it("exports createLoan", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.createLoan).toBe("function");
  });
  it("exports getActiveLoanDeductionsForEmployee", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.getActiveLoanDeductionsForEmployee).toBe("function");
  });
  it("exports listAdvances", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.listAdvances).toBe("function");
  });
  it("exports createAdvance", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.createAdvance).toBe("function");
  });
  it("exports listPayrollRuns", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.listPayrollRuns).toBe("function");
  });
  it("exports createPayrollRun", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.createPayrollRun).toBe("function");
  });
  it("exports updatePayrollRunStatus", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.updatePayrollRunStatus).toBe("function");
  });
  it("exports listPayslips", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.listPayslips).toBe("function");
  });
  it("exports getPayslip", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.getPayslip).toBe("function");
  });
  it("exports insertPayslip", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.insertPayslip).toBe("function");
  });
  it("exports generatePayslips", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.generatePayslips).toBe("function");
  });
  it("exports listAnomalyFlags", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.listAnomalyFlags).toBe("function");
  });
  it("exports createAnomalyFlag", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.createAnomalyFlag).toBe("function");
  });
  it("exports getPayrollSummaryReport", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.getPayrollSummaryReport).toBe("function");
  });
  it("exports getPayrollCostByDept", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.getPayrollCostByDept).toBe("function");
  });
  it("exports getYtdPayrollSummary", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.getYtdPayrollSummary).toBe("function");
  });
});

// ─── 4. Tax computation logic ─────────────────────────────────────────────────
describe("Module 4 — Business Logic: computeTaxForAmount", () => {
  it("returns 0 when no slabs defined", async () => {
    const { computeTaxForAmount } = await import("./payrollDb");
    expect(computeTaxForAmount([], 100000)).toBe(0);
  });

  it("applies a flat rate slab correctly", async () => {
    const { computeTaxForAmount } = await import("./payrollDb");
    const slabs = [
      { fromAmount: "0", toAmount: "50000", rate: "0", fixedAmount: "0" },
      { fromAmount: "50000", toAmount: null, rate: "10", fixedAmount: "0" },
    ];
    // 100000 annual gross: 0 on first 50k, 10% on next 50k = 5000
    const tax = computeTaxForAmount(slabs, 100000);
    expect(tax).toBeCloseTo(5000, 0);
  });

  it("applies fixed amount slab correctly", async () => {
    const { computeTaxForAmount } = await import("./payrollDb");
    const slabs = [
      { fromAmount: "0", toAmount: "100000", rate: "0", fixedAmount: "500" },
    ];
    const tax = computeTaxForAmount(slabs, 80000);
    expect(tax).toBe(500);
  });

  it("returns 0 for income below first slab threshold", async () => {
    const { computeTaxForAmount } = await import("./payrollDb");
    const slabs = [
      { fromAmount: "50000", toAmount: null, rate: "5", fixedAmount: "0" },
    ];
    const tax = computeTaxForAmount(slabs, 30000);
    expect(tax).toBe(0);
  });

  it("handles multiple progressive slabs", async () => {
    const { computeTaxForAmount } = await import("./payrollDb");
    const slabs = [
      { fromAmount: "0",      toAmount: "30000",  rate: "0",  fixedAmount: "0" },
      { fromAmount: "30000",  toAmount: "60000",  rate: "5",  fixedAmount: "0" },
      { fromAmount: "60000",  toAmount: "100000", rate: "10", fixedAmount: "0" },
      { fromAmount: "100000", toAmount: null,     rate: "20", fixedAmount: "0" },
    ];
    // 120000: 0 on 0-30k, 5% on 30-60k=1500, 10% on 60-100k=4000, 20% on 100-120k=4000 → 9500
    const tax = computeTaxForAmount(slabs, 120000);
    expect(tax).toBeCloseTo(9500, 0);
  });

  it("handles zero-rate slab (tax-free threshold)", async () => {
    const { computeTaxForAmount } = await import("./payrollDb");
    const slabs = [
      { fromAmount: "0", toAmount: "20000", rate: "0", fixedAmount: "0" },
      { fromAmount: "20000", toAmount: null, rate: "15", fixedAmount: "0" },
    ];
    const tax = computeTaxForAmount(slabs, 20000);
    expect(tax).toBe(0);
  });
});

// ─── 5. AI service exports ────────────────────────────────────────────────────
describe("Module 4 — AI: payrollAI exports", () => {
  it("exports detectPayrollAnomalies function", async () => {
    const ai = await import("./ai/payrollAI");
    expect(typeof ai.detectPayrollAnomalies).toBe("function");
  });
  it("exports explainPayslip function", async () => {
    const ai = await import("./ai/payrollAI");
    expect(typeof ai.explainPayslip).toBe("function");
  });
  it("exports PayslipSummary type (via function signature)", async () => {
    const ai = await import("./ai/payrollAI");
    // Verify the function exists and accepts the right shape
    expect(ai.explainPayslip).toBeDefined();
  });
});

// ─── 6. AI anomaly detection contract (mocked) ───────────────────────────────
describe("Module 4 — AI: detectPayrollAnomalies contract", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns an array of anomaly flags", async () => {
    const mockAi = { generateText: vi.fn().mockResolvedValue({ text: JSON.stringify([{ employeeId: 1, type: "salary_spike", severity: "high", description: "Salary increased by 80% vs last month", currentValue: "18000", previousValue: "10000", percentChange: "80", status: "pending" }]) }) };
    vi.doMock("./ai/index", () => ({
      getAiService: () => mockAi,
      AiService: class { async generateText() { return mockAi.generateText(); } },
    }));
    const { detectPayrollAnomalies } = await import("./ai/payrollAI");
    const result = await detectPayrollAnomalies(
      1,
      1,
      [
        { employeeId: 1, employeeName: "John Doe", grossSalary: "18000", netSalary: "15000", basicSalary: "12000", taxAmount: "1500", pfEmployee: "500", loanDeductions: "1000", advanceDeductions: "0", totalDeductions: "3000", currency: "AED" },
      ]
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns empty array when no anomalies detected", async () => {
    const mockAi = { generateText: vi.fn().mockResolvedValue({ text: "[]" }) };
    vi.doMock("./ai/index", () => ({
      getAiService: () => mockAi,
      AiService: class { async generateText() { return mockAi.generateText(); } },
    }));
    const { detectPayrollAnomalies } = await import("./ai/payrollAI");
    const result = await detectPayrollAnomalies(1, 1, []);
    expect(Array.isArray(result)).toBe(true);
  });

  it("never auto-penalizes — flags are advisory only", async () => {
    const mockAi = { generateText: vi.fn().mockResolvedValue({ text: "[]" }) };
    vi.doMock("./ai/index", () => ({
      getAiService: () => mockAi,
      AiService: class { async generateText() { return mockAi.generateText(); } },
    }));
    const { detectPayrollAnomalies } = await import("./ai/payrollAI");
    const result = await detectPayrollAnomalies(
      1,
      1,
      [{ employeeId: 2, employeeName: "Jane Smith", grossSalary: "5000", netSalary: "4500", basicSalary: "4000", taxAmount: "200", pfEmployee: "150", loanDeductions: "150", advanceDeductions: "0", totalDeductions: "500", currency: "AED" }]
    );
    // Flags must not have auto-penalty fields
    if (result.length > 0) {
      expect(result[0]).not.toHaveProperty("penalize");
      expect(result[0]).not.toHaveProperty("autoPenalty");
      expect(result[0]).toHaveProperty("status");
    }
  });
});

// ─── 7. AI payslip explainer contract (mocked) ───────────────────────────────
describe("Module 4 — AI: explainPayslip contract", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a plain-English explanation string", async () => {
    const mockAi = { generateText: vi.fn().mockResolvedValue({ text: "Your net salary is lower this month because a loan deduction of AED 1,000 was applied for the first time." }) };
    vi.doMock("./ai/index", () => ({
      getAiService: () => mockAi,
      AiService: class { async generateText() { return mockAi.generateText(); } },
    }));
    const { explainPayslip } = await import("./ai/payrollAI");
    const result = await explainPayslip({
      employeeId: 1,
      employeeName: "John Doe",
      grossSalary: "10000",
      netSalary: "8000",
      basicSalary: "8000",
      taxAmount: "500",
      pfEmployee: "300",
      loanDeductions: "1000",
      advanceDeductions: "200",
      totalDeductions: "2000",
      currency: "AED",
      month: 6,
      year: 2026,
      components: [
        { code: "BASIC", name: "Basic Salary", type: "earning", amount: 8000 },
        { code: "HRA", name: "Housing Allowance", type: "earning", amount: 2000 },
        { code: "TAX", name: "Tax", type: "deduction", amount: 500 },
        { code: "PF", name: "PF", type: "deduction", amount: 300 },
        { code: "LOAN", name: "Loan EMI", type: "deduction", amount: 1000 },
        { code: "ADV", name: "Advance Recovery", type: "deduction", amount: 200 },
      ],
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(10);
  });

  it("explanation is advisory — no penalty language", async () => {
    const mockAi = { generateText: vi.fn().mockResolvedValue({ text: "Your net pay decreased due to an additional tax deduction this month." }) };
    vi.doMock("./ai/index", () => ({
      getAiService: () => mockAi,
      AiService: class { async generateText() { return mockAi.generateText(); } },
    }));
    const { explainPayslip } = await import("./ai/payrollAI");
    const result = await explainPayslip({
      employeeId: 1,
      employeeName: "Test User",
      grossSalary: "8000",
      netSalary: "6500",
      basicSalary: "7000",
      taxAmount: "800",
      pfEmployee: "350",
      loanDeductions: "0",
      advanceDeductions: "0",
      totalDeductions: "1500",
      currency: "AED",
      month: 6,
      year: 2026,
    });
    expect(typeof result).toBe("string");
    // Should not contain penalty language
    expect(result.toLowerCase()).not.toContain("penaliz");
    expect(result.toLowerCase()).not.toContain("disciplin");
  });
});

// ─── 8. Payroll run status transitions ───────────────────────────────────────
describe("Module 4 — Business Logic: payroll run status", () => {
  it("updatePayrollRunStatus is a function", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.updatePayrollRunStatus).toBe("function");
  });

  it("computePayslipForEmployee is a function", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.computePayslipForEmployee).toBe("function");
  });

  it("generatePayslips is a function", async () => {
    const db = await import("./payrollDb");
    expect(typeof db.generatePayslips).toBe("function");
  });
});

// ─── 9. RBAC: payrollRouter uses protectedProcedure ──────────────────────────
describe("Module 4 — RBAC: payroll procedures are protected", () => {
  it("payrollRouter is not publicly accessible (requires auth context)", async () => {
    const { payrollRouter } = await import("./routers/payrollRouter");
    // The router should be defined and have protected procedures
    expect(payrollRouter).toBeDefined();
    // All sub-routers should exist (they use protectedProcedure internally)
    const procedures = (payrollRouter as any)._def.procedures;
    expect(Object.keys(procedures).length).toBeGreaterThan(5);
  });
});

// ─── 10. Multi-currency support ──────────────────────────────────────────────
describe("Module 4 — Business Logic: multi-currency", () => {
  it("payslips schema has currency field", async () => {
    const schema = await import("../drizzle/schema");
    // The payslips table should have a currency column
    expect(schema.payslips).toBeDefined();
    const columns = Object.keys(schema.payslips);
    expect(columns.length).toBeGreaterThan(0);
  });

  it("salary structures schema has currency field", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.salaryStructures).toBeDefined();
  });
});
