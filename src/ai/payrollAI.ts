/**
 * payrollAI.ts — AI integrations for Module 4: Payroll Management
 *
 * Two capabilities:
 *  1. detectPayrollAnomalies — flags salary spikes, duplicates, deduction errors BEFORE approval
 *  2. explainPayslip         — plain-English ESS explainer ("why is my net lower this month?")
 *
 * All outputs are ADVISORY. The system NEVER auto-approves, auto-rejects, or auto-penalizes.
 * A human approves the payroll run after reviewing any flagged anomalies.
 */
import { getAiService } from "./index";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type PayslipSummary = {
  employeeId: number;
  employeeName?: string;
  basicSalary: string;
  grossSalary: string;
  totalDeductions: string;
  taxAmount: string;
  pfEmployee: string;
  loanDeductions: string;
  advanceDeductions: string;
  netSalary: string;
  currency: string;
};

export type AnomalyFlagInput = {
  employeeId: number;
  type: "salary_spike" | "salary_drop" | "duplicate_payment" | "deduction_error" | "missing_component" | "new_employee_high_salary" | "zero_net";
  severity: "low" | "medium" | "high";
  description: string;
  previousValue?: string;
  currentValue?: string;
  percentChange?: string;
  status: "pending";
};

// ─── ANOMALY DETECTION ────────────────────────────────────────────────────────

/**
 * Detect payroll anomalies for a given run.
 * Returns a list of anomaly flags for human review — never auto-penalizes.
 *
 * Rule-based checks run first (fast, deterministic), then AI enriches descriptions.
 */
export async function detectPayrollAnomalies(
  payrollRunId: number,
  companyId: number,
  payslips: PayslipSummary[]
): Promise<AnomalyFlagInput[]> {
  const flags: AnomalyFlagInput[] = [];

  // ── Rule-based checks ──────────────────────────────────────────────────────

  for (const slip of payslips) {
    const net = parseFloat(slip.netSalary);
    const gross = parseFloat(slip.grossSalary);
    const basic = parseFloat(slip.basicSalary);

    // Zero net salary
    if (net <= 0) {
      flags.push({
        employeeId: slip.employeeId,
        type: "zero_net",
        severity: "high",
        description: `Employee ${slip.employeeName ?? slip.employeeId} has zero or negative net salary (${slip.currency} ${net.toFixed(2)}). Review deductions.`,
        currentValue: slip.netSalary,
        status: "pending",
      });
    }

    // Deductions exceed 80% of gross (likely error)
    const deductions = parseFloat(slip.totalDeductions);
    if (gross > 0 && deductions / gross > 0.8) {
      const pct = ((deductions / gross) * 100).toFixed(1);
      flags.push({
        employeeId: slip.employeeId,
        type: "deduction_error",
        severity: "high",
        description: `Total deductions (${pct}% of gross) exceed 80% threshold for ${slip.employeeName ?? slip.employeeId}. Possible misconfigured component.`,
        currentValue: slip.totalDeductions,
        percentChange: pct,
        status: "pending",
      });
    }

    // Gross is more than 5x basic (possible component misconfiguration)
    if (basic > 0 && gross / basic > 5) {
      flags.push({
        employeeId: slip.employeeId,
        type: "salary_spike",
        severity: "medium",
        description: `Gross salary (${slip.currency} ${gross.toFixed(2)}) is ${(gross / basic).toFixed(1)}x the basic salary for ${slip.employeeName ?? slip.employeeId}. Verify allowance components.`,
        previousValue: slip.basicSalary,
        currentValue: slip.grossSalary,
        percentChange: (((gross - basic) / basic) * 100).toFixed(2),
        status: "pending",
      });
    }
  }

  // ── Duplicate payment check ────────────────────────────────────────────────
  const seen = new Map<number, number>();
  for (const slip of payslips) {
    const count = (seen.get(slip.employeeId) ?? 0) + 1;
    seen.set(slip.employeeId, count);
    if (count === 2) {
      flags.push({
        employeeId: slip.employeeId,
        type: "duplicate_payment",
        severity: "high",
        description: `Employee ${slip.employeeName ?? slip.employeeId} appears more than once in this payroll run. Possible duplicate payment.`,
        status: "pending",
      });
    }
  }

  // ── AI enrichment (if any flags exist) ────────────────────────────────────
  if (flags.length > 0) {
    try {
      const ai = getAiService();
      const summary = flags.map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.type}: ${f.description}`).join("\n");

      const prompt = `You are a payroll audit assistant. The following anomalies were detected in a payroll run. For each one, provide a concise, plain-English explanation of the likely cause and what the payroll manager should check. Keep each explanation to 1-2 sentences. Do not add new anomalies — only enrich the existing ones.

Anomalies:
${summary}

Respond with a JSON array of objects: [{"index": 1, "enrichedDescription": "..."}, ...]`;

      const response = await ai.generateText(prompt);
      const text = response.text?.trim() ?? "";

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const enriched = JSON.parse(jsonMatch[0]) as Array<{ index: number; enrichedDescription: string }>;
        for (const e of enriched) {
          const idx = e.index - 1;
          if (idx >= 0 && idx < flags.length && e.enrichedDescription) {
            flags[idx].description = e.enrichedDescription;
          }
        }
      }
    } catch {
      // AI enrichment is best-effort — rule-based flags are always returned
    }
  }

  return flags;
}

// ─── PAYSLIP EXPLAINER ────────────────────────────────────────────────────────

/**
 * Generate a plain-English explanation of a payslip for ESS.
 * Helps employees understand why their net pay changed this month.
 * Returns a human-readable paragraph — never penalizes or makes decisions.
 */
export async function explainPayslip(payslip: PayslipSummary & {
  month: number;
  year: number;
  attendanceDays?: number;
  absentDays?: number;
  components?: Array<{ code: string; name: string; type: string; amount: number }>;
}): Promise<string> {
  const ai = getAiService();

  const monthName = new Date(payslip.year, payslip.month - 1, 1).toLocaleString("en", { month: "long" });

  const componentLines = (payslip.components ?? [])
    .map((c) => `  - ${c.name} (${c.type}): ${payslip.currency} ${c.amount.toFixed(2)}`)
    .join("\n");

  const prompt = `You are a friendly HR assistant helping an employee understand their payslip for ${monthName} ${payslip.year}.

Payslip details:
- Basic Salary: ${payslip.currency} ${parseFloat(payslip.basicSalary).toFixed(2)}
- Gross Salary: ${payslip.currency} ${parseFloat(payslip.grossSalary).toFixed(2)}
- Total Deductions: ${payslip.currency} ${parseFloat(payslip.totalDeductions).toFixed(2)}
  - Tax: ${payslip.currency} ${parseFloat(payslip.taxAmount).toFixed(2)}
  - PF (Employee): ${payslip.currency} ${parseFloat(payslip.pfEmployee).toFixed(2)}
  - Loan Deductions: ${payslip.currency} ${parseFloat(payslip.loanDeductions).toFixed(2)}
  - Advance Deductions: ${payslip.currency} ${parseFloat(payslip.advanceDeductions).toFixed(2)}
- Net Salary: ${payslip.currency} ${parseFloat(payslip.netSalary).toFixed(2)}
- Attendance: ${payslip.attendanceDays ?? "N/A"} days present, ${payslip.absentDays ?? 0} days absent
${componentLines ? `\nSalary components:\n${componentLines}` : ""}

Write a friendly, clear 2-3 paragraph explanation that:
1. Summarises the key figures (gross, deductions, net)
2. Explains what each major deduction is for in plain language
3. If there are any notable items (advances, loans, absences), briefly explains their impact
4. Ends with an encouraging note

Do not use jargon. Write as if speaking directly to the employee.`;

  try {
    const response = await ai.generateText(prompt);
    return response.text?.trim() ?? "Your payslip has been processed. Please contact HR if you have any questions about the figures.";
  } catch {
    return `Your net salary for ${monthName} ${payslip.year} is ${payslip.currency} ${parseFloat(payslip.netSalary).toFixed(2)}. This is calculated as your gross salary of ${payslip.currency} ${parseFloat(payslip.grossSalary).toFixed(2)} minus total deductions of ${payslip.currency} ${parseFloat(payslip.totalDeductions).toFixed(2)}. Please contact HR if you have any questions.`;
  }
}
