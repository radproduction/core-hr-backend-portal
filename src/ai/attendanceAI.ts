/**
 * AI integrations for Time & Attendance module.
 *
 * All outputs are SUGGESTIONS surfaced for human review.
 * The system NEVER auto-penalizes or auto-acts on AI flags.
 */
import { getAiService } from "./index";
import { listAttendanceRecords } from "../attendanceDb";
import { createAnomalyFlag, listAbsenteeismPredictions } from "../attendanceDb";

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type AnomalyType =
  | "creeping_lateness"
  | "geo_fence_violation"
  | "buddy_punching_risk"
  | "irregular_pattern"
  | "excessive_overtime"
  | "frequent_early_leave"
  | "suspicious_location";

export type AnomalyFlag = {
  employeeId: number;
  type: AnomalyType;
  severity: "low" | "medium" | "high";
  reason: string;
  evidence: string;
  suggestedAction: string;
  confidence: number; // 0–1
};

export type AbsenteeismPrediction = {
  employeeId: number;
  riskLevel: "low" | "medium" | "high";
  riskScore: number; // 0–100
  predictedAbsenceDays: number;
  factors: string[];
  recommendation: string;
  confidence: number;
};

// ─── ANOMALY DETECTION ────────────────────────────────────────────────────────

/**
 * Analyse attendance records for a company over a date window and return
 * AI-generated anomaly flags for human review.
 *
 * Never auto-penalizes — all flags require human review before any action.
 */
export async function detectAttendanceAnomalies(
  companyId: number,
  startDate: Date,
  endDate: Date,
): Promise<AnomalyFlag[]> {
  const ai = getAiService();

  // Fetch raw records
  const records = await listAttendanceRecords(companyId, {
    startDate,
    endDate,
    limit: 5000,
  });

  if (records.length === 0) return [];

  // Build a compact statistical summary per employee
  const byEmployee = new Map<number, {
    total: number;
    late: number;
    lateMinutesTotal: number;
    geoOutside: number;
    earlyLeave: number;
    absent: number;
    overtimeTotal: number;
    dates: string[];
    lateMinutes: number[];
  }>();

  for (const r of records) {
    if (!byEmployee.has(r.employeeId)) {
      byEmployee.set(r.employeeId, {
        total: 0, late: 0, lateMinutesTotal: 0, geoOutside: 0,
        earlyLeave: 0, absent: 0, overtimeTotal: 0, dates: [], lateMinutes: [],
      });
    }
    const e = byEmployee.get(r.employeeId)!;
    e.total++;
    if (r.status === "late") { e.late++; e.lateMinutesTotal += r.lateMinutes ?? 0; e.lateMinutes.push(r.lateMinutes ?? 0); }
    if (r.geoFenceStatus === "outside") e.geoOutside++;
    if (r.status === "early_leave") e.earlyLeave++;
    if (r.status === "absent") e.absent++;
    if ((r.overtimeMinutes ?? 0) > 0) e.overtimeTotal += r.overtimeMinutes ?? 0;
    e.dates.push(r.date.toISOString().slice(0, 10));
  }

  // Build prompt payload — only send summary stats, not raw PII
  const summaries = Array.from(byEmployee.entries()).map(([empId, s]) => ({
    employeeId: empId,
    totalDays: s.total,
    lateDays: s.late,
    lateRatio: s.total > 0 ? +(s.late / s.total).toFixed(2) : 0,
    avgLateMinutes: s.late > 0 ? +(s.lateMinutesTotal / s.late).toFixed(1) : 0,
    lateTrend: s.lateMinutes.length >= 3
      ? (s.lateMinutes[s.lateMinutes.length - 1] > s.lateMinutes[0] ? "increasing" : "stable")
      : "insufficient_data",
    geoFenceViolations: s.geoOutside,
    geoViolationRatio: s.total > 0 ? +(s.geoOutside / s.total).toFixed(2) : 0,
    earlyLeaveDays: s.earlyLeave,
    absentDays: s.absent,
    totalOvertimeMinutes: s.overtimeTotal,
  }));

  const prompt = `You are an HR analytics AI. Analyse the following employee attendance summaries for the period ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}.

Identify employees with anomalous patterns. Focus on:
1. Creeping lateness (late ratio > 30% AND lateTrend = increasing)
2. Geo-fence violations (geoViolationRatio > 20%)
3. Buddy-punching risk (geo violations combined with irregular patterns)
4. Excessive overtime (totalOvertimeMinutes > 3000 in period)
5. Frequent early leave (earlyLeaveDays > 20% of total)

For each anomaly found, provide:
- employeeId (number)
- type: one of "creeping_lateness" | "geo_fence_violation" | "buddy_punching_risk" | "irregular_pattern" | "excessive_overtime" | "frequent_early_leave" | "suspicious_location"
- severity: "low" | "medium" | "high"
- reason: concise human-readable explanation (max 100 chars)
- evidence: specific stats that triggered this flag (max 150 chars)
- suggestedAction: what HR should investigate (max 100 chars)
- confidence: 0.0 to 1.0

IMPORTANT: Only flag genuine anomalies. Do not flag employees with normal patterns.
Return ONLY a JSON array of anomaly objects. If no anomalies, return [].

Data:
${JSON.stringify(summaries.slice(0, 100))}`;

  try {
    const result = await ai.extractStructuredData(prompt, {
      fields: {
        anomalies: { type: "array", description: "Array of anomaly flag objects" },
      },
    });

    // The mock provider returns a structured result; real providers return JSON
    let anomalies: AnomalyFlag[] = [];
    if (result.data?.anomalies && Array.isArray(result.data.anomalies)) {
      anomalies = result.data.anomalies as AnomalyFlag[];
    } else {
      // Try parsing raw text as JSON array
      try {
        const raw = JSON.parse(result.sourceText ?? "[]");
        anomalies = Array.isArray(raw) ? raw : [];
      } catch {
        anomalies = [];
      }
    }

    // Validate and sanitize each flag
    return anomalies
      .filter(f => f && typeof f.employeeId === "number")
      .map(f => ({
        employeeId: f.employeeId,
        type: (f.type as AnomalyType) ?? "irregular_pattern",
        severity: (f.severity as "low" | "medium" | "high") ?? "low",
        reason: String(f.reason ?? "").slice(0, 200),
        evidence: String(f.evidence ?? "").slice(0, 300),
        suggestedAction: String(f.suggestedAction ?? "Review with employee").slice(0, 200),
        confidence: Math.min(1, Math.max(0, Number(f.confidence ?? 0.5))),
      }));
  } catch {
    // Fallback: rule-based detection when AI is unavailable
    return runRuleBasedAnomalyDetection(summaries);
  }
}

/** Rule-based fallback when AI service is unavailable */
function runRuleBasedAnomalyDetection(
  summaries: ReturnType<typeof buildSummaries>,
): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  for (const s of summaries) {
    if (s.lateRatio > 0.3 && s.lateTrend === "increasing") {
      flags.push({
        employeeId: s.employeeId,
        type: "creeping_lateness",
        severity: s.lateRatio > 0.5 ? "high" : "medium",
        reason: `Late ${Math.round(s.lateRatio * 100)}% of days with increasing trend`,
        evidence: `Late ratio: ${s.lateRatio}, avg late: ${s.avgLateMinutes}min, trend: ${s.lateTrend}`,
        suggestedAction: "Review with employee and check for underlying issues",
        confidence: 0.85,
      });
    }
    if (s.geoViolationRatio > 0.2) {
      flags.push({
        employeeId: s.employeeId,
        type: "geo_fence_violation",
        severity: s.geoViolationRatio > 0.5 ? "high" : "medium",
        reason: `${Math.round(s.geoViolationRatio * 100)}% of check-ins outside geo-fence`,
        evidence: `${s.geoFenceViolations} violations out of ${s.totalDays} days`,
        suggestedAction: "Verify employee location and check if geo-fence is correctly configured",
        confidence: 0.9,
      });
    }
    if (s.totalOvertimeMinutes > 3000) {
      flags.push({
        employeeId: s.employeeId,
        type: "excessive_overtime",
        severity: s.totalOvertimeMinutes > 6000 ? "high" : "medium",
        reason: `${Math.round(s.totalOvertimeMinutes / 60)}h overtime in period`,
        evidence: `Total overtime: ${s.totalOvertimeMinutes} minutes`,
        suggestedAction: "Review workload and ensure overtime is approved",
        confidence: 0.95,
      });
    }
  }
  return flags;
}

type SummaryItem = {
  employeeId: number;
  totalDays: number;
  lateDays: number;
  lateRatio: number;
  avgLateMinutes: number;
  lateTrend: string;
  geoFenceViolations: number;
  geoViolationRatio: number;
  earlyLeaveDays: number;
  absentDays: number;
  totalOvertimeMinutes: number;
};

function buildSummaries(x: SummaryItem[]): SummaryItem[] { return x; }

// ─── PREDICTED ABSENTEEISM ────────────────────────────────────────────────────

/**
 * Predict absenteeism risk for employees in the next 30 days.
 * Uses historical patterns: absence rate, leave frequency, tenure, day-of-week patterns.
 *
 * All outputs are suggestions for HR planning — never auto-penalizes.
 */
export async function predictAbsenteeism(
  companyId: number,
  lookbackDays = 90,
): Promise<AbsenteeismPrediction[]> {
  const ai = getAiService();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);

  const records = await listAttendanceRecords(companyId, {
    startDate,
    endDate,
    limit: 10000,
  });

  if (records.length === 0) return [];

  // Build per-employee stats
  const byEmployee = new Map<number, {
    total: number; absent: number; late: number; earlyLeave: number;
    mondayAbsent: number; fridayAbsent: number; totalDays: number;
  }>();

  for (const r of records) {
    if (!byEmployee.has(r.employeeId)) {
      byEmployee.set(r.employeeId, { total: 0, absent: 0, late: 0, earlyLeave: 0, mondayAbsent: 0, fridayAbsent: 0, totalDays: 0 });
    }
    const e = byEmployee.get(r.employeeId)!;
    e.total++;
    if (r.status === "absent") {
      e.absent++;
      const day = r.date.getDay();
      if (day === 1) e.mondayAbsent++;
      if (day === 5) e.fridayAbsent++;
    }
    if (r.status === "late") e.late++;
    if (r.status === "early_leave") e.earlyLeave++;
  }

  const summaries = Array.from(byEmployee.entries()).map(([empId, s]) => ({
    employeeId: empId,
    absenceRate: s.total > 0 ? +(s.absent / s.total).toFixed(3) : 0,
    lateRate: s.total > 0 ? +(s.late / s.total).toFixed(3) : 0,
    earlyLeaveRate: s.total > 0 ? +(s.earlyLeave / s.total).toFixed(3) : 0,
    mondayFridayPattern: s.absent > 0 ? +((s.mondayAbsent + s.fridayAbsent) / s.absent).toFixed(2) : 0,
    totalAbsences: s.absent,
    lookbackDays,
  }));

  const prompt = `You are an HR workforce planning AI. Predict absenteeism risk for the next 30 days based on historical patterns.

For each employee, assess risk level and provide planning recommendations.
Use these thresholds as guidance:
- High risk: absenceRate > 0.15 OR (absenceRate > 0.10 AND mondayFridayPattern > 0.6)
- Medium risk: absenceRate 0.08–0.15
- Low risk: absenceRate < 0.08

For each employee return:
- employeeId (number)
- riskLevel: "low" | "medium" | "high"
- riskScore: 0–100
- predictedAbsenceDays: integer (expected absences in next 30 days)
- factors: array of strings (max 3 factors driving the prediction)
- recommendation: HR planning suggestion (max 150 chars)
- confidence: 0.0 to 1.0

Return ONLY a JSON array. Only include employees with medium or high risk.

Data:
${JSON.stringify(summaries.slice(0, 100))}`;

  try {
    const result = await ai.extractStructuredData(prompt, {
      fields: {
        predictions: { type: "array", description: "Array of absenteeism prediction objects" },
      },
    });

    let predictions: AbsenteeismPrediction[] = [];
    if (result.data?.predictions && Array.isArray(result.data.predictions)) {
      predictions = result.data.predictions as AbsenteeismPrediction[];
    } else {
      try {
        const raw = JSON.parse(result.sourceText ?? "[]");
        predictions = Array.isArray(raw) ? raw : [];
      } catch {
        predictions = [];
      }
    }

    return predictions
      .filter(p => p && typeof p.employeeId === "number")
      .map(p => ({
        employeeId: p.employeeId,
        riskLevel: (p.riskLevel as "low" | "medium" | "high") ?? "low",
        riskScore: Math.min(100, Math.max(0, Number(p.riskScore ?? 0))),
        predictedAbsenceDays: Math.max(0, Math.round(Number(p.predictedAbsenceDays ?? 0))),
        factors: Array.isArray(p.factors) ? p.factors.slice(0, 5) : [],
        recommendation: String(p.recommendation ?? "Monitor attendance patterns").slice(0, 300),
        confidence: Math.min(1, Math.max(0, Number(p.confidence ?? 0.5))),
      }));
  } catch {
    // Rule-based fallback
    return summaries
      .filter(s => s.absenceRate > 0.08)
      .map(s => ({
        employeeId: s.employeeId,
        riskLevel: s.absenceRate > 0.15 ? "high" : "medium" as "low" | "medium" | "high",
        riskScore: Math.round(s.absenceRate * 400),
        predictedAbsenceDays: Math.round(s.absenceRate * 30),
        factors: [
          `Historical absence rate: ${Math.round(s.absenceRate * 100)}%`,
          s.mondayFridayPattern > 0.5 ? "Monday/Friday pattern detected" : "Random absence pattern",
          s.lateRate > 0.2 ? "High late arrival rate" : "Punctuality concerns",
        ],
        recommendation: "Schedule a check-in meeting and review workload",
        confidence: 0.7,
      }));
  }
}

// ─── tRPC-READY WRAPPERS ──────────────────────────────────────────────────────

export async function runAndPersistAnomalyDetection(
  companyId: number,
  startDate: Date,
  endDate: Date,
): Promise<{ flagsCreated: number; flags: AnomalyFlag[] }> {
  const flags = await detectAttendanceAnomalies(companyId, startDate, endDate);

  let created = 0;
  for (const flag of flags) {
    try {
      await createAnomalyFlag({
        companyId,
        employeeId: flag.employeeId,
        type: flag.type as "creeping_lateness" | "geo_fence_violation" | "buddy_punching" | "unusual_pattern" | "excessive_overtime" | "irregular_hours",
        severity: flag.severity,
        description: `${flag.reason} — ${flag.evidence}`,
        aiReasoning: flag.suggestedAction,
        status: "pending_review",
        date: new Date(),
      });
      created++;
    } catch {
      // Skip duplicate flags
    }
  }

  return { flagsCreated: created, flags };
}

export async function runAndPersistAbsenteeismPredictions(
  companyId: number,
  lookbackDays = 90,
): Promise<{ predictionsCreated: number; predictions: AbsenteeismPrediction[] }> {
  const predictions = await predictAbsenteeism(companyId, lookbackDays);

  // For now just return — in production these would be upserted to the DB
  // with a generated_at timestamp so the UI can show "last updated X ago"
  return { predictionsCreated: predictions.length, predictions };
}
