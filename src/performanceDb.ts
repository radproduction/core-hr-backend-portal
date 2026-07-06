/**
 * server/performanceDb.ts
 * DB helpers for Module 7 — Performance Management (MongoDB)
 */
import type {
  InsertAppraisalTemplate, InsertAppraisalSection, InsertAppraisalQuestion,
  InsertKpiGroup, InsertKpiDefinition,
  InsertAppraisalCycle, InsertCycleParticipant, InsertParticipantKpi,
  InsertEvaluationRating,
} from "../drizzle/schema";
import { getEmployees } from "./mongoDb";
import {
  insertDoc, updateDoc, findMany, findOneDoc, deleteOneDoc, deleteManyDocs,
} from "./_core/mongoStore";

// Collection model names
const TEMPLATES = "AppraisalTemplateRecord";
const SECTIONS = "AppraisalSectionRecord";
const QUESTIONS = "AppraisalQuestionRecord";
const KPI_GROUPS = "KpiGroupRecord";
const KPI_DEFS = "KpiDefinitionRecord";
const CYCLES = "AppraisalCycleRecord";
const PARTICIPANTS = "CycleParticipantRecord";
const PARTICIPANT_KPIS = "ParticipantKpiRecord";
const RATINGS = "EvaluationRatingRecord";
const AUDIT = "PerformanceAuditLogRecord";

// ─── Audit Helper ─────────────────────────────────────────────────────────────
export async function writePerfAuditLog(entry: {
  companyId: number; actorId?: number; entityType: string; entityId?: number;
  action: string; oldValue?: unknown; newValue?: unknown;
}) {
  await insertDoc(AUDIT, "performanceAuditLog", {
    companyId: entry.companyId,
    actorId: entry.actorId ?? null,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    action: entry.action,
    oldValue: (entry.oldValue as Record<string, unknown>) ?? null,
    newValue: (entry.newValue as Record<string, unknown>) ?? null,
  });
}

// ─── APPRAISAL TEMPLATES ──────────────────────────────────────────────────────
export async function listAppraisalTemplates(companyId: number) {
  return findMany(TEMPLATES, { companyId }, { createdAt: -1 });
}

export async function getAppraisalTemplate(id: number, companyId: number) {
  const tpl = await findOneDoc(TEMPLATES, { id, companyId });
  if (!tpl) return undefined;
  const sections = await findMany(SECTIONS, { templateId: id }, { displayOrder: 1 });
  const sectionIds = sections.map((s: any) => s.id);
  const questions = sectionIds.length
    ? await findMany(QUESTIONS, { sectionId: { $in: sectionIds } }, { displayOrder: 1 })
    : [];
  return {
    ...tpl,
    sections: sections.map((s: any) => ({
      ...s,
      questions: questions.filter((q: any) => q.sectionId === s.id),
    })),
  };
}

export async function createAppraisalTemplate(data: InsertAppraisalTemplate) {
  return insertDoc(TEMPLATES, "appraisalTemplates", { isActive: true, ...data });
}

export async function updateAppraisalTemplate(id: number, companyId: number, data: Partial<InsertAppraisalTemplate>) {
  await updateDoc(TEMPLATES, { id, companyId }, data);
}

export async function deleteAppraisalTemplate(id: number, companyId: number) {
  await updateDoc(TEMPLATES, { id, companyId }, { isActive: false });
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
export async function upsertTemplateSections(
  templateId: number,
  sections: Array<Omit<InsertAppraisalSection, "templateId"> & { id?: number }>
) {
  // Delete existing sections + questions
  const existing = await findMany(SECTIONS, { templateId });
  if (existing.length) {
    const ids = existing.map((s: any) => s.id);
    await deleteManyDocs(QUESTIONS, { sectionId: { $in: ids } });
    await deleteManyDocs(SECTIONS, { templateId });
  }
  // Insert new sections (+ their questions)
  const sectionIds: number[] = [];
  for (const s of sections) {
    const { questions: qs, id: _id, ...sData } = s as typeof s & { questions?: InsertAppraisalQuestion[] };
    const { id: sectionId } = await insertDoc(SECTIONS, "appraisalSections", { ...sData, templateId });
    sectionIds.push(sectionId);
    if (qs?.length) {
      for (const q of qs) {
        await insertDoc(QUESTIONS, "appraisalQuestions", { ...q, sectionId });
      }
    }
  }
  return sectionIds;
}

// ─── KPI GROUPS ───────────────────────────────────────────────────────────────
export async function listKpiGroups(companyId: number) {
  return findMany(KPI_GROUPS, { companyId, isActive: true }, { name: 1 });
}

export async function getKpiGroupWithDefinitions(groupId: number, companyId: number) {
  const group = await findOneDoc(KPI_GROUPS, { id: groupId, companyId });
  if (!group) return undefined;
  const defs = await findMany(KPI_DEFS, { groupId, isActive: true });
  return { ...group, definitions: defs };
}

export async function createKpiGroup(data: InsertKpiGroup) {
  return insertDoc(KPI_GROUPS, "kpiGroups", { isActive: true, ...data });
}

export async function updateKpiGroup(id: number, companyId: number, data: Partial<InsertKpiGroup>) {
  await updateDoc(KPI_GROUPS, { id, companyId }, data);
}

export async function createKpiDefinition(data: InsertKpiDefinition) {
  return insertDoc(KPI_DEFS, "kpiDefinitions", { isActive: true, ...data });
}

export async function updateKpiDefinition(id: number, data: Partial<InsertKpiDefinition>) {
  await updateDoc(KPI_DEFS, { id }, data);
}

export async function listKpiDefinitions(companyId: number) {
  return findMany(KPI_DEFS, { companyId, isActive: true });
}

// ─── APPRAISAL CYCLES ─────────────────────────────────────────────────────────
export async function listAppraisalCycles(companyId: number) {
  return findMany(CYCLES, { companyId }, { createdAt: -1 });
}

export async function getAppraisalCycle(id: number, companyId: number) {
  const cycle = await findOneDoc(CYCLES, { id, companyId });
  if (!cycle) return undefined;
  const participants = await findMany(PARTICIPANTS, { cycleId: id });
  return { ...cycle, participantCount: participants.length, participants };
}

export async function createAppraisalCycle(data: InsertAppraisalCycle) {
  return insertDoc(CYCLES, "appraisalCycles", data as Record<string, unknown>);
}

export async function updateAppraisalCycle(id: number, companyId: number, data: Partial<InsertAppraisalCycle>) {
  await updateDoc(CYCLES, { id, companyId }, data);
}

// ─── CYCLE PARTICIPANTS ───────────────────────────────────────────────────────
export async function addCycleParticipants(cycleId: number, participants: InsertCycleParticipant[]) {
  if (!participants.length) return;
  for (const p of participants) {
    await insertDoc(PARTICIPANTS, "cycleParticipants", { ...p, cycleId });
  }
}

export async function getCycleParticipant(id: number) {
  const p = await findOneDoc(PARTICIPANTS, { id });
  if (!p) return undefined;
  const kpis = await findMany(PARTICIPANT_KPIS, { participantId: id });
  return { ...p, kpis };
}

export async function updateCycleParticipant(id: number, data: Partial<InsertCycleParticipant>) {
  await updateDoc(PARTICIPANTS, { id }, data);
}

export async function getParticipantByEmployeeCycle(employeeId: number, cycleId: number) {
  return findOneDoc(PARTICIPANTS, { employeeId, cycleId });
}

// ─── PARTICIPANT KPIs ─────────────────────────────────────────────────────────
export async function upsertParticipantKpi(data: InsertParticipantKpi & { id?: number }) {
  if (data.id) {
    const { id, ...rest } = data;
    await updateDoc(PARTICIPANT_KPIS, { id }, rest as Record<string, unknown>);
    return { id };
  }
  const { id: _id, ...insertData } = data;
  return insertDoc(PARTICIPANT_KPIS, "participantKpis", insertData as Record<string, unknown>);
}

export async function deleteParticipantKpi(id: number) {
  await deleteOneDoc(PARTICIPANT_KPIS, { id });
}

// ─── EVALUATION RATINGS ───────────────────────────────────────────────────────
export async function upsertEvaluationRating(data: InsertEvaluationRating) {
  const existing = await findOneDoc(RATINGS, {
    participantId: data.participantId,
    questionId: data.questionId,
    raterId: data.raterId,
  });
  if (existing) {
    await updateDoc(RATINGS, { id: existing.id }, {
      ratingValue: data.ratingValue,
      ratingText: data.ratingText,
      submittedAt: data.submittedAt,
    });
    return { id: existing.id };
  }
  return insertDoc(RATINGS, "evaluationRatings", data as Record<string, unknown>);
}

export async function getEvaluationRatings(participantId: number) {
  return findMany(RATINGS, { participantId });
}

export async function getRaterRatings(participantId: number, raterId: number) {
  return findMany(RATINGS, { participantId, raterId });
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
export async function getCycleLeaderboard(cycleId: number, companyId: number) {
  const participants = await findMany(PARTICIPANTS, { cycleId });
  if (!participants.length) return [];
  const emps = await getEmployees(companyId);
  const empMap = Object.fromEntries(emps.map((e: any) => [e.id, e]));
  return participants
    .filter((p: any) => p.finalScore !== null && p.finalScore !== undefined)
    .map((p: any) => ({
      participantId: p.id,
      employeeId: p.employeeId,
      employeeName: empMap[p.employeeId] ? `${empMap[p.employeeId].firstName} ${empMap[p.employeeId].lastName}` : `Employee #${p.employeeId}`,
      selfScore: p.selfScore ? Number(p.selfScore) : null,
      managerScore: p.managerScore ? Number(p.managerScore) : null,
      finalScore: p.finalScore ? Number(p.finalScore) : null,
      incrementPercent: p.incrementPercent ? Number(p.incrementPercent) : null,
      status: p.status,
    }))
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
}

export async function getCycleSummaryStats(cycleId: number) {
  const participants = await findMany(PARTICIPANTS, { cycleId });
  const total = participants.length;
  const completed = participants.filter((p: any) => p.status === "calibrated" || p.status === "acknowledged").length;
  const selfSubmitted = participants.filter((p: any) => p.status !== "pending").length;
  const scores = participants.filter((p: any) => p.finalScore !== null && p.finalScore !== undefined).map((p: any) => Number(p.finalScore));
  const avgScore = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;
  const topPerformers = participants.filter((p: any) => p.finalScore != null && Number(p.finalScore) >= 4.5).length;
  const flightRisks = participants.filter((p: any) => p.finalScore != null && Number(p.finalScore) < 2.5).length;
  return { total, completed, selfSubmitted, avgScore, topPerformers, flightRisks };
}

export async function getPerformanceAuditLog(companyId: number, limit = 50) {
  return findMany(AUDIT, { companyId }, { createdAt: -1 }, limit);
}
