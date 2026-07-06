/**
 * leaveAI.ts — AI integrations for Module 3: Leave Management
 *
 * Two capabilities:
 *  1. generateLeaveDraft   — helps employees phrase leave requests professionally
 *  2. analyzeTeamCoverage  — at approval time, summarises team coverage impact
 *
 * All outputs are SUGGESTIONS surfaced for human review.
 * The system NEVER auto-approves, auto-rejects, or auto-penalizes.
 */
import { getAiService } from "./index";
import type { LeaveRequest } from "../../drizzle/schema";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type LeaveDraftInput = {
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  days: number;
  context?: string; // employee's rough notes / reason keywords
};

export type CoverageImpactInput = {
  companyId: number;
  leaveRequestId: number;
  employeeId: number;
  startDate: Date;
  endDate: Date;
  teamSize?: number;
  overlappingLeaves: LeaveRequest[];
};

export type CoverageSummary = {
  overlapCount: number;
  coveragePercent: number; // percentage of team still available
  riskLevel: "low" | "medium" | "high";
  conflicts: string[];
  recommendation: string;
  aiNarrative: string; // human-readable paragraph
};

// ─── LEAVE DRAFT ASSISTANT ────────────────────────────────────────────────────

/**
 * Generate a professional leave request draft based on employee's rough notes.
 * Returns a polished, concise reason paragraph the employee can edit before submitting.
 */
export async function generateLeaveDraft(input: LeaveDraftInput): Promise<string> {
  const ai = getAiService();

  const startStr = input.startDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const endStr = input.endDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const daysStr = input.days === 0.5 ? "half a day" : `${input.days} day${input.days !== 1 ? "s" : ""}`;

  const prompt = `You are an HR assistant helping an employee write a professional leave request.

Leave type: ${input.leaveTypeName}
Duration: ${daysStr} (${startStr} to ${endStr})
Employee's rough notes: ${input.context ?? "No additional context provided"}

Write a concise, professional leave request reason (2–4 sentences). 
- Be polite and formal
- Mention the dates naturally
- Do not invent medical or personal details not provided
- Do not include greetings or sign-offs — just the reason paragraph
- Keep it under 80 words`;

  try {
    const response = await ai.generateText(
      prompt,
      { systemPrompt: "You are a professional HR writing assistant. Output only the leave reason paragraph, nothing else." }
    );
    return response.text.trim();
  } catch (err) {
    console.error("[leaveAI] generateLeaveDraft error:", err);
    // Graceful fallback
    return `I am requesting ${input.leaveTypeName.toLowerCase()} from ${startStr} to ${endStr} (${daysStr}). ${input.context ?? ""}`.trim();
  }
}

// ─── TEAM COVERAGE IMPACT ANALYSER ───────────────────────────────────────────

/**
 * At the moment a manager opens an approval, analyse how many team members
 * are already on leave during the requested period and produce a coverage summary.
 *
 * Output is advisory only — the manager makes the final decision.
 */
export async function analyzeTeamCoverage(input: CoverageImpactInput): Promise<CoverageSummary> {
  const ai = getAiService();

  const teamSize = input.teamSize ?? 10;
  const overlapCount = input.overlappingLeaves.length;
  const availableCount = Math.max(0, teamSize - overlapCount - 1); // -1 for the requester
  const coveragePercent = Math.round((availableCount / teamSize) * 100);

  // Determine risk level
  const riskLevel: CoverageSummary["riskLevel"] =
    coveragePercent < 40 ? "high" :
    coveragePercent < 65 ? "medium" : "low";

  // Build conflict list
  const conflicts: string[] = [];
  if (overlapCount >= 3) {
    conflicts.push(`${overlapCount} team members already on approved leave during this period`);
  }
  if (coveragePercent < 50) {
    conflicts.push(`Team coverage drops below 50% (${coveragePercent}% available)`);
  }

  const startStr = input.startDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const endStr = input.endDate.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const aiPrompt = `You are an HR manager assistant reviewing a leave approval.

Period: ${startStr} to ${endStr}
Team size: ${teamSize}
Members already on approved leave during this period: ${overlapCount}
Estimated team availability: ${coveragePercent}%
Risk level: ${riskLevel}
Identified conflicts: ${conflicts.length > 0 ? conflicts.join("; ") : "None"}

Write a concise, factual 2–3 sentence summary for the manager reviewing this leave request.
- State the coverage situation plainly
- Mention any conflicts
- End with a neutral suggestion (not a directive)
- Do NOT approve or reject — the manager decides
- Keep under 60 words`;

  let aiNarrative = "";
  try {
    const response = await ai.generateText(
      aiPrompt,
      { systemPrompt: "You are a neutral HR assistant. Output only the coverage summary paragraph." }
    );
    aiNarrative = response.text.trim();
  } catch (err) {
    console.error("[leaveAI] analyzeTeamCoverage error:", err);
    aiNarrative = `During ${startStr}–${endStr}, ${overlapCount} team member(s) are already on approved leave, leaving approximately ${coveragePercent}% of the team available. Coverage risk is ${riskLevel}.`;
  }

  const recommendation =
    riskLevel === "high"
      ? "Consider discussing coverage arrangements before approving"
      : riskLevel === "medium"
      ? "Review team workload before approving"
      : "Coverage appears adequate for this period";

  return {
    overlapCount,
    coveragePercent,
    riskLevel,
    conflicts,
    recommendation,
    aiNarrative,
  };
}
