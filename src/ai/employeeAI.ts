/**
 * Employee Module AI Integrations
 * All outputs are suggestions — a human reviews and can edit before saving.
 * Uses the shared AiService singleton from server/ai/index.ts
 */
import type { ExtractionSchema } from "./types";
import { getAiService } from "./index";
import { getEmployees, getDepartments, getDesignations, getLocations, getEmploymentHistory } from "../db";

// ─── 1. RESUME / ID DOCUMENT PARSER ──────────────────────────────────────────

export interface ParsedEmployeeProfile {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  dateOfBirth?: string;        // ISO date string
  nationalId?: string;
  nationality?: string;
  maritalStatus?: "single" | "married" | "divorced" | "widowed";
  personalEmail?: string;
  personalPhone?: string;
  address?: string;
  // Professional fields from resume
  currentTitle?: string;
  currentCompany?: string;
  yearsOfExperience?: number;
  skills?: string[];
  education?: Array<{ institution: string; degree: string; year?: number }>;
  workHistory?: Array<{ company: string; title: string; from?: string; to?: string }>;
  // Confidence score 0-1
  confidence: number;
  // Which fields were extracted
  extractedFields: string[];
  // Raw text snippet used for extraction
  sourceType: "resume" | "national_id" | "passport" | "other";
}

export async function parseDocumentToEmployeeProfile(
  documentText: string,
  documentType: "resume" | "national_id" | "passport" | "other" = "resume"
): Promise<ParsedEmployeeProfile> {
  const ai = getAiService();

  const schema: ExtractionSchema = {
    fields: {
      firstName: { type: "string", description: "Given name" },
      lastName: { type: "string", description: "Family/surname" },
      displayName: { type: "string", description: "Full display name" },
      gender: { type: "string", description: "Gender: male, female, other, or prefer_not_to_say" },
      dateOfBirth: { type: "string", description: "Date of birth in YYYY-MM-DD format" },
      nationalId: { type: "string", description: "National ID or Emirates ID number" },
      nationality: { type: "string", description: "Nationality/country of citizenship" },
      maritalStatus: { type: "string", description: "Marital status: single, married, divorced, or widowed" },
      personalEmail: { type: "string", description: "Personal email address" },
      personalPhone: { type: "string", description: "Personal phone number" },
      address: { type: "string", description: "Residential address" },
      currentTitle: { type: "string", description: "Current or most recent job title" },
      currentCompany: { type: "string", description: "Current or most recent employer" },
      yearsOfExperience: { type: "number", description: "Total years of professional experience" },
      skills: { type: "array", description: "Comma-separated list of professional skills" },
      educationSummary: { type: "string", description: "Education history as a JSON string array of {institution, degree, year}" },
      workHistorySummary: { type: "string", description: "Work history as a JSON string array of {company, title, from, to}" },
    },
  };

  const systemPrompt = documentType === "resume"
    ? `You are an HR document parser. Extract structured employee profile data from the provided resume/CV text. 
       Only extract fields that are clearly present in the document. Do not invent or guess values.
       For dates, use YYYY-MM-DD format. For phone numbers, preserve the original format.`
    : `You are an HR document parser. Extract structured identity information from the provided ${documentType} document text.
       Only extract fields that are clearly present. Do not invent or guess values.
       For dates, use YYYY-MM-DD format.`;

  try {
    const result = await ai.extractStructuredData(documentText, schema, {
      systemPrompt,
      temperature: 0.1,
    });
    const extracted = result.data as Partial<ParsedEmployeeProfile>;

    // Calculate which fields were actually extracted
    const extractedFields = Object.keys(schema.fields).filter(k => {
      const v = (extracted as Record<string, unknown>)[k];
      return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
    });

    // Confidence based on how many key fields were found
    const keyFields = ["firstName", "lastName", "personalEmail", "nationalId", "dateOfBirth"];
    const keyFieldsFound = keyFields.filter(f => extractedFields.includes(f)).length;
    const confidence = Math.min(0.95, keyFieldsFound / keyFields.length + extractedFields.length * 0.02);

    return {
      ...extracted,
      confidence,
      extractedFields,
      sourceType: documentType,
    };
  } catch {
    return {
      confidence: 0,
      extractedFields: [],
      sourceType: documentType,
    };
  }
}

// ─── 2. NATURAL LANGUAGE WORKFORCE QUERY ─────────────────────────────────────

export interface WorkforceQueryResult {
  answer: string;
  chartType?: "bar" | "line" | "pie" | "area" | null;
  chartData?: Array<Record<string, string | number>>;
  chartConfig?: {
    xKey: string;
    yKeys: string[];
    title: string;
    description?: string;
  };
  dataTable?: Array<Record<string, string | number>>;
  confidence: "high" | "medium" | "low";
  queryInterpretation: string;
  dataSource: string;
  isAiGenerated: true;
}

export async function queryWorkforceNL(
  question: string,
  companyId: number
): Promise<WorkforceQueryResult> {
  const ai = getAiService();

  // Gather workforce data context
  const [employees, departments, designations, locations] = await Promise.all([
    getEmployees(companyId),
    getDepartments(companyId),
    getDesignations(companyId),
    getLocations(companyId),
  ]);

  // Build a concise data summary for the LLM context
  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));
  const desigMap = Object.fromEntries(designations.map(d => [d.id, d.name]));
  const locMap = Object.fromEntries(locations.map(l => [l.id, l.name]));

  const empSummary = employees.map(e => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    department: e.departmentId ? deptMap[e.departmentId] : null,
    designation: e.designationId ? desigMap[e.designationId] : null,
    location: e.locationId ? locMap[e.locationId] : null,
    status: e.status,
    employmentType: e.employmentType,
    gender: e.gender,
    joinDate: e.joinDate?.toISOString().split("T")[0],
    nationality: e.nationality,
  }));

  const context = `
You are an HR analytics assistant with access to the following workforce data for a company.

COMPANY SUMMARY:
- Total employees: ${employees.length}
- Active: ${employees.filter(e => e.status === "active").length}
- On leave: ${employees.filter(e => e.status === "on_leave").length}
- Departments: ${departments.map(d => d.name).join(", ")}
- Locations: ${locations.map(l => l.name).join(", ")}

EMPLOYEE DATA (JSON):
${JSON.stringify(empSummary.slice(0, 200), null, 2)}

Answer the user's question about this workforce data. 
Provide:
1. A clear text answer
2. If relevant, chart data for visualization (bar/line/pie/area)
3. If relevant, a data table
4. Your confidence level (high/medium/low)
5. How you interpreted the question

Always label your output as AI-generated. Only use data from the provided dataset.
`;

  const schema: ExtractionSchema = {
    fields: {
      answer: { type: "string", description: "Clear text answer to the question" },
      chartType: { type: "string", description: "Best chart type: bar, line, pie, area, or null" },
      chartDataJson: { type: "string", description: "JSON array of chart data points, each with string/number fields" },
      chartXKey: { type: "string", description: "The key to use for the chart x-axis" },
      chartYKeysJson: { type: "string", description: "JSON array of y-axis key names" },
      chartTitle: { type: "string", description: "Chart title" },
      chartDescription: { type: "string", description: "Chart description" },
      dataTableJson: { type: "string", description: "JSON array of tabular data rows if relevant" },
      confidence: { type: "string", description: "Confidence level: high, medium, or low" },
      queryInterpretation: { type: "string", description: "How you interpreted the question" },
      dataSource: { type: "string", description: "What data was used to answer" },
    },
  };

  try {
    const extracted = await ai.extractStructuredData(
      `Question: ${question}`,
      schema,
      { systemPrompt: context, temperature: 0.3 }
    );
    const d = extracted.data as Record<string, string | undefined>;
    // Parse JSON sub-fields
    let chartData: Array<Record<string, string | number>> | undefined;
    let dataTable: Array<Record<string, string | number>> | undefined;
    let chartYKeys: string[] | undefined;
    try { chartData = d.chartDataJson ? JSON.parse(d.chartDataJson) as Array<Record<string, string | number>> : undefined; } catch { /* ignore */ }
    try { dataTable = d.dataTableJson ? JSON.parse(d.dataTableJson) as Array<Record<string, string | number>> : undefined; } catch { /* ignore */ }
    try { chartYKeys = d.chartYKeysJson ? JSON.parse(d.chartYKeysJson) as string[] : undefined; } catch { /* ignore */ }
    const result: Omit<WorkforceQueryResult, "isAiGenerated"> = {
      answer: d.answer ?? "No answer generated.",
      chartType: (d.chartType as WorkforceQueryResult["chartType"]) ?? null,
      chartData,
      chartConfig: d.chartXKey ? { xKey: d.chartXKey, yKeys: chartYKeys ?? [], title: d.chartTitle ?? "", description: d.chartDescription } : undefined,
      dataTable,
      confidence: (d.confidence as "high" | "medium" | "low") ?? "low",
      queryInterpretation: d.queryInterpretation ?? question,
      dataSource: d.dataSource ?? "workforce data",
    };

    return { ...result, isAiGenerated: true as const };
  } catch {
    return {
      answer: `I was unable to process your question: "${question}". Please try rephrasing it.`,
      confidence: "low",
      queryInterpretation: question,
      dataSource: "workforce data",
      isAiGenerated: true,
    };
  }
}

// ─── 3. ATTRITION RISK INDICATOR ─────────────────────────────────────────────

export type AttritionRiskLevel = "low" | "medium" | "high" | "critical";

export interface AttritionRiskResult {
  employeeId: number;
  riskLevel: AttritionRiskLevel;
  riskScore: number;           // 0-100
  factors: AttritionRiskFactor[];
  recommendation: string;
  confidence: "high" | "medium" | "low";
  isAiGenerated: true;
  computedAt: string;
}

export interface AttritionRiskFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  description: string;
  weight: number;              // 0-1 contribution to score
}

export async function computeAttritionRisk(
  employeeId: number,
  companyId: number
): Promise<AttritionRiskResult> {
  const ai = getAiService();

  // Gather employee-specific data
  const [employees, history] = await Promise.all([
    getEmployees(companyId),
    getEmploymentHistory(employeeId, companyId),
  ]);

  const employee = employees.find(e => e.id === employeeId);
  if (!employee) {
    return {
      employeeId,
      riskLevel: "low",
      riskScore: 0,
      factors: [],
      recommendation: "Employee not found",
      confidence: "low",
      isAiGenerated: true,
      computedAt: new Date().toISOString(),
    };
  }

  // Calculate tenure
  const today = new Date();
  const tenureMonths = employee.joinDate
    ? Math.floor((today.getTime() - employee.joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    : 0;

  // Count history events
  const promotions = history.filter(h => h.eventType === "promoted").length;
  const transfers = history.filter(h => h.eventType === "transferred").length;
  const warnings = history.filter(h => h.eventType === "status_change").length;

  const employeeContext = {
    name: `${employee.firstName} ${employee.lastName}`,
    status: employee.status,
    employmentType: employee.employmentType,
    tenureMonths,
    tenureYears: (tenureMonths / 12).toFixed(1),
    promotionsCount: promotions,
    transfersCount: transfers,
    warningsCount: warnings,
    historyEvents: history.map(h => ({ type: h.eventType, date: h.effectiveDate, description: h.description })),
    gender: employee.gender,
    nationality: employee.nationality,
    confirmationDate: employee.confirmationDate,
    isOnProbation: employee.employmentType === "probation",
    isContract: employee.employmentType === "contract",
  };

  const systemPrompt = `You are an HR analytics expert specializing in employee retention and attrition risk assessment.
Analyze the provided employee data and compute an attrition risk score.

Risk scoring guidelines:
- Tenure < 6 months: moderate risk (new joiners often leave early)
- Tenure 6-18 months: higher risk (common attrition window)
- Tenure > 5 years: lower risk (loyalty indicator)
- Contract/probation employment type: higher risk (inherently temporary)
- Warnings: significant risk increase
- No promotions after 3+ years: moderate risk increase
- Multiple transfers: could indicate dissatisfaction
- On leave status: investigate further

Output a risk score 0-100 where:
- 0-25: Low risk
- 26-50: Medium risk  
- 51-75: High risk
- 76-100: Critical risk

Be objective and data-driven. Only use the provided data.`;

  const schema: ExtractionSchema = {
    fields: {
      riskScore: { type: "number", description: "Risk score 0-100" },
      riskLevel: { type: "string", description: "Risk level: low, medium, high, or critical" },
      factorsJson: { type: "string", description: "JSON array of risk factors, each with: factor (string), impact (positive/negative/neutral), description (string), weight (0-1 number)" },
      recommendation: { type: "string", description: "Actionable HR recommendation for this employee" },
      confidence: { type: "string", description: "Confidence level: high, medium, or low" },
    },
  };

  try {
    const extracted = await ai.extractStructuredData(
      JSON.stringify(employeeContext),
      schema,
      { systemPrompt, temperature: 0.2 }
    );
    const d = extracted.data as Record<string, unknown>;
    let factors: AttritionRiskFactor[] = [];
    try { factors = d.factorsJson ? JSON.parse(d.factorsJson as string) as AttritionRiskFactor[] : []; } catch { /* ignore */ }
    const result: Omit<AttritionRiskResult, "employeeId" | "isAiGenerated" | "computedAt"> = {
      riskScore: typeof d.riskScore === "number" ? d.riskScore : 0,
      riskLevel: (d.riskLevel as AttritionRiskLevel) ?? "low",
      factors,
      recommendation: (d.recommendation as string) ?? "No recommendation available.",
      confidence: (d.confidence as "high" | "medium" | "low") ?? "low",
    };

    return {
      employeeId,
      ...result,
      isAiGenerated: true,
      computedAt: new Date().toISOString(),
    };
  } catch {
    // Fallback: rule-based scoring when AI is unavailable
    let score = 20; // base
    const factors: AttritionRiskFactor[] = [];

    if (tenureMonths < 6) {
      score += 25;
      factors.push({ factor: "Short tenure", impact: "negative", description: "Less than 6 months tenure — high early-attrition risk", weight: 0.3 });
    } else if (tenureMonths < 18) {
      score += 15;
      factors.push({ factor: "Early tenure", impact: "negative", description: "6-18 months tenure — common attrition window", weight: 0.2 });
    } else if (tenureMonths > 60) {
      score -= 10;
      factors.push({ factor: "Long tenure", impact: "positive", description: "5+ years tenure — strong loyalty indicator", weight: 0.2 });
    }

    if (employee.employmentType === "contract" || employee.employmentType === "probation") {
      score += 20;
      factors.push({ factor: "Temporary employment", impact: "negative", description: "Contract/probation roles have inherently higher turnover", weight: 0.25 });
    }

    if (warnings > 0) {
      score += warnings * 10;
      factors.push({ factor: "Performance warnings", impact: "negative", description: `${warnings} warning(s) on record`, weight: 0.2 });
    }

    if (promotions === 0 && tenureMonths > 36) {
      score += 10;
      factors.push({ factor: "No promotions", impact: "negative", description: "No promotions in 3+ years may indicate stagnation", weight: 0.15 });
    }

    score = Math.min(100, Math.max(0, score));
    const riskLevel: AttritionRiskLevel = score < 26 ? "low" : score < 51 ? "medium" : score < 76 ? "high" : "critical";

    return {
      employeeId,
      riskScore: score,
      riskLevel,
      factors,
      recommendation: riskLevel === "low"
        ? "Continue regular check-ins and maintain engagement."
        : riskLevel === "medium"
        ? "Schedule a career development conversation and review compensation."
        : "Immediate retention intervention recommended — schedule 1:1 with HR and manager.",
      confidence: "medium",
      isAiGenerated: true,
      computedAt: new Date().toISOString(),
    };
  }
}

// ─── Batch attrition risk for all active employees ────────────────────────────
export async function computeBatchAttritionRisk(companyId: number): Promise<AttritionRiskResult[]> {
  const employees = await getEmployees(companyId, { status: "active" });
  // Process in parallel batches of 5 to avoid overwhelming the AI service
  const results: AttritionRiskResult[] = [];
  const batchSize = 5;
  for (let i = 0; i < employees.length; i += batchSize) {
    const batch = employees.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(e => computeAttritionRisk(e.id, companyId))
    );
    results.push(...batchResults);
  }
  return results.sort((a, b) => b.riskScore - a.riskScore);
}
