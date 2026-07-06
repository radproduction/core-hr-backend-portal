/**
 * server/performanceDb.ts
 * DB helpers for Module 7 — Performance Management
 */
import { and, eq, gte, lte, desc, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  appraisalTemplates, appraisalSections, appraisalQuestions,
  kpiGroups, kpiDefinitions,
  appraisalCycles, cycleParticipants, participantKpis,
  evaluationRatings, performanceAuditLog,
  type InsertAppraisalTemplate, type InsertAppraisalSection, type InsertAppraisalQuestion,
  type InsertKpiGroup, type InsertKpiDefinition,
  type InsertAppraisalCycle, type InsertCycleParticipant, type InsertParticipantKpi,
  type InsertEvaluationRating,
  employees,
} from "../drizzle/schema";

// ─── Audit Helper ─────────────────────────────────────────────────────────────
export async function writePerfAuditLog(entry: {
  companyId: number; actorId?: number; entityType: string; entityId?: number;
  action: string; oldValue?: unknown; newValue?: unknown;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(performanceAuditLog).values({
    companyId: entry.companyId,
    actorId: entry.actorId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    oldValue: entry.oldValue as Record<string, unknown> ?? null,
    newValue: entry.newValue as Record<string, unknown> ?? null,
  });
}

// ─── APPRAISAL TEMPLATES ──────────────────────────────────────────────────────
export async function listAppraisalTemplates(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appraisalTemplates)
    .where(eq(appraisalTemplates.companyId, companyId))
    .orderBy(desc(appraisalTemplates.createdAt));
}

export async function getAppraisalTemplate(id: number, companyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [tpl] = await db.select().from(appraisalTemplates)
    .where(and(eq(appraisalTemplates.id, id), eq(appraisalTemplates.companyId, companyId)))
    .limit(1);
  if (!tpl) return undefined;
  const sections = await db.select().from(appraisalSections)
    .where(eq(appraisalSections.templateId, id))
    .orderBy(appraisalSections.displayOrder);
  const sectionIds = sections.map(s => s.id);
  const questions = sectionIds.length
    ? await db.select().from(appraisalQuestions)
        .where(inArray(appraisalQuestions.sectionId, sectionIds))
        .orderBy(appraisalQuestions.displayOrder)
    : [];
  return {
    ...tpl,
    sections: sections.map(s => ({
      ...s,
      questions: questions.filter(q => q.sectionId === s.id),
    })),
  };
}

export async function createAppraisalTemplate(data: InsertAppraisalTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(appraisalTemplates).values(data);
  return { id: (res as { insertId: number }).insertId };
}

export async function updateAppraisalTemplate(id: number, companyId: number, data: Partial<InsertAppraisalTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(appraisalTemplates).set(data)
    .where(and(eq(appraisalTemplates.id, id), eq(appraisalTemplates.companyId, companyId)));
}

export async function deleteAppraisalTemplate(id: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(appraisalTemplates).set({ isActive: false })
    .where(and(eq(appraisalTemplates.id, id), eq(appraisalTemplates.companyId, companyId)));
}

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
export async function upsertTemplateSections(templateId: number, sections: Array<Omit<InsertAppraisalSection, "templateId"> & { id?: number }>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Delete existing sections + questions
  const existing = await db.select({ id: appraisalSections.id }).from(appraisalSections)
    .where(eq(appraisalSections.templateId, templateId));
  if (existing.length) {
    const ids = existing.map(s => s.id);
    await db.delete(appraisalQuestions).where(inArray(appraisalQuestions.sectionId, ids));
    await db.delete(appraisalSections).where(eq(appraisalSections.templateId, templateId));
  }
  // Insert new sections
  const sectionIds: number[] = [];
  for (const s of sections) {
    const { questions: qs, id: _id, ...sData } = s as typeof s & { questions?: InsertAppraisalQuestion[] };
    const [res] = await db.insert(appraisalSections).values({ ...sData, templateId });
    const sectionId = (res as { insertId: number }).insertId;
    sectionIds.push(sectionId);
    if (qs?.length) {
      await db.insert(appraisalQuestions).values(qs.map(q => ({ ...q, sectionId })));
    }
  }
  return sectionIds;
}

// ─── KPI GROUPS ───────────────────────────────────────────────────────────────
export async function listKpiGroups(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(kpiGroups)
    .where(and(eq(kpiGroups.companyId, companyId), eq(kpiGroups.isActive, true)))
    .orderBy(kpiGroups.name);
}

export async function getKpiGroupWithDefinitions(groupId: number, companyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [group] = await db.select().from(kpiGroups)
    .where(and(eq(kpiGroups.id, groupId), eq(kpiGroups.companyId, companyId))).limit(1);
  if (!group) return undefined;
  const defs = await db.select().from(kpiDefinitions)
    .where(and(eq(kpiDefinitions.groupId, groupId), eq(kpiDefinitions.isActive, true)));
  return { ...group, definitions: defs };
}

export async function createKpiGroup(data: InsertKpiGroup) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(kpiGroups).values(data);
  return { id: (res as { insertId: number }).insertId };
}

export async function updateKpiGroup(id: number, companyId: number, data: Partial<InsertKpiGroup>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(kpiGroups).set(data)
    .where(and(eq(kpiGroups.id, id), eq(kpiGroups.companyId, companyId)));
}

export async function createKpiDefinition(data: InsertKpiDefinition) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(kpiDefinitions).values(data);
  return { id: (res as { insertId: number }).insertId };
}

export async function updateKpiDefinition(id: number, data: Partial<InsertKpiDefinition>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(kpiDefinitions).set(data).where(eq(kpiDefinitions.id, id));
}

export async function listKpiDefinitions(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(kpiDefinitions)
    .where(and(eq(kpiDefinitions.companyId, companyId), eq(kpiDefinitions.isActive, true)));
}

// ─── APPRAISAL CYCLES ─────────────────────────────────────────────────────────
export async function listAppraisalCycles(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appraisalCycles)
    .where(eq(appraisalCycles.companyId, companyId))
    .orderBy(desc(appraisalCycles.createdAt));
}

export async function getAppraisalCycle(id: number, companyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [cycle] = await db.select().from(appraisalCycles)
    .where(and(eq(appraisalCycles.id, id), eq(appraisalCycles.companyId, companyId))).limit(1);
  if (!cycle) return undefined;
  const participants = await db.select().from(cycleParticipants)
    .where(eq(cycleParticipants.cycleId, id));
  return { ...cycle, participantCount: participants.length, participants };
}

export async function createAppraisalCycle(data: InsertAppraisalCycle) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [res] = await db.insert(appraisalCycles).values(data);
  return { id: (res as { insertId: number }).insertId };
}

export async function updateAppraisalCycle(id: number, companyId: number, data: Partial<InsertAppraisalCycle>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(appraisalCycles).set(data)
    .where(and(eq(appraisalCycles.id, id), eq(appraisalCycles.companyId, companyId)));
}

// ─── CYCLE PARTICIPANTS ───────────────────────────────────────────────────────
export async function addCycleParticipants(cycleId: number, participants: InsertCycleParticipant[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (!participants.length) return;
  await db.insert(cycleParticipants).values(participants.map(p => ({ ...p, cycleId })));
}

export async function getCycleParticipant(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [p] = await db.select().from(cycleParticipants).where(eq(cycleParticipants.id, id)).limit(1);
  if (!p) return undefined;
  const kpis = await db.select().from(participantKpis).where(eq(participantKpis.participantId, id));
  return { ...p, kpis };
}

export async function updateCycleParticipant(id: number, data: Partial<InsertCycleParticipant>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(cycleParticipants).set(data).where(eq(cycleParticipants.id, id));
}

export async function getParticipantByEmployeeCycle(employeeId: number, cycleId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [p] = await db.select().from(cycleParticipants)
    .where(and(eq(cycleParticipants.employeeId, employeeId), eq(cycleParticipants.cycleId, cycleId)))
    .limit(1);
  return p;
}

// ─── PARTICIPANT KPIs ─────────────────────────────────────────────────────────
export async function upsertParticipantKpi(data: InsertParticipantKpi & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (data.id) {
    const { id, ...rest } = data;
    await db.update(participantKpis).set(rest).where(eq(participantKpis.id, id));
    return { id };
  }
  const { id: _id, ...insertData } = data;
  const [res] = await db.insert(participantKpis).values(insertData);
  return { id: (res as { insertId: number }).insertId };
}

export async function deleteParticipantKpi(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(participantKpis).where(eq(participantKpis.id, id));
}

// ─── EVALUATION RATINGS ───────────────────────────────────────────────────────
export async function upsertEvaluationRating(data: InsertEvaluationRating) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Check if rating exists
  const [existing] = await db.select().from(evaluationRatings)
    .where(and(
      eq(evaluationRatings.participantId, data.participantId!),
      eq(evaluationRatings.questionId, data.questionId!),
      eq(evaluationRatings.raterId, data.raterId!),
    )).limit(1);
  if (existing) {
    await db.update(evaluationRatings).set({
      ratingValue: data.ratingValue,
      ratingText: data.ratingText,
      submittedAt: data.submittedAt,
    }).where(eq(evaluationRatings.id, existing.id));
    return { id: existing.id };
  }
  const [res] = await db.insert(evaluationRatings).values(data);
  return { id: (res as { insertId: number }).insertId };
}

export async function getEvaluationRatings(participantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evaluationRatings)
    .where(eq(evaluationRatings.participantId, participantId));
}

export async function getRaterRatings(participantId: number, raterId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evaluationRatings)
    .where(and(
      eq(evaluationRatings.participantId, participantId),
      eq(evaluationRatings.raterId, raterId),
    ));
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
export async function getCycleLeaderboard(cycleId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const participants = await db.select().from(cycleParticipants)
    .where(eq(cycleParticipants.cycleId, cycleId));
  if (!participants.length) return [];
  const empIds = participants.map(p => p.employeeId);
  const emps = await db.select({
    id: employees.id,
    firstName: employees.firstName,
    lastName: employees.lastName,
    departmentId: employees.departmentId,
  }).from(employees).where(inArray(employees.id, empIds));
  const empMap = Object.fromEntries(emps.map(e => [e.id, e]));
  return participants
    .filter(p => p.finalScore !== null)
    .map(p => ({
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
  const db = await getDb();
  if (!db) return null;
  const participants = await db.select().from(cycleParticipants)
    .where(eq(cycleParticipants.cycleId, cycleId));
  const total = participants.length;
  const completed = participants.filter(p => p.status === "calibrated" || p.status === "acknowledged").length;
  const selfSubmitted = participants.filter(p => p.status !== "pending").length;
  const scores = participants.filter(p => p.finalScore !== null).map(p => Number(p.finalScore));
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const topPerformers = participants.filter(p => p.finalScore !== null && Number(p.finalScore) >= 4.5).length;
  const flightRisks = participants.filter(p => p.finalScore !== null && Number(p.finalScore) < 2.5).length;
  return { total, completed, selfSubmitted, avgScore, topPerformers, flightRisks };
}

export async function getPerformanceAuditLog(companyId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(performanceAuditLog)
    .where(eq(performanceAuditLog.companyId, companyId))
    .orderBy(desc(performanceAuditLog.createdAt))
    .limit(limit);
}
