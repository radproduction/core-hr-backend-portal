/**
 * recruitmentDb.ts — DB query helpers for Module 5: Recruitment
 *
 * All helpers return raw Drizzle rows. Business logic lives in the router.
 */
import { and, desc, eq, gte, ilike, inArray, like, lte, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  aiScreeningConfigs,
  applicationStageHistory,
  applications,
  candidateTags,
  candidates,
  careerPortalSettings,
  evaluationTemplates,
  interviewSchedules,
  interviewScorecards,
  jobPostings,
  jobRequisitions,
  offerLetters,
  recruitmentActivities,
  recruitmentEmailTemplates,
  type AiScreeningConfig,
  type Application,
  type ApplicationStageHistory,
  type Candidate,
  type CandidateTag,
  type CareerPortalSetting,
  type EvaluationTemplate,
  type InsertAiScreeningConfig,
  type InsertApplication,
  type InsertApplicationStageHistory,
  type InsertCandidate,
  type InsertCandidateTag,
  type InsertCareerPortalSetting,
  type InsertEvaluationTemplate,
  type InsertInterviewSchedule,
  type InsertInterviewScorecard,
  type InsertJobPosting,
  type InsertJobRequisition,
  type InsertOfferLetter,
  type InsertRecruitmentActivity,
  type InsertRecruitmentEmailTemplate,
  type InterviewSchedule,
  type InterviewScorecard,
  type JobPosting,
  type JobRequisition,
  type OfferLetter,
  type RecruitmentActivity,
  type RecruitmentEmailTemplate,
} from "../drizzle/schema";

// ─── JOB REQUISITIONS ─────────────────────────────────────────────────────────
export async function listJobRequisitions(
  companyId: number,
  filters?: { status?: string; departmentId?: number }
): Promise<JobRequisition[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(jobRequisitions.companyId, companyId)];
  if (filters?.status) conditions.push(eq(jobRequisitions.status, filters.status as JobRequisition["status"]));
  if (filters?.departmentId) conditions.push(eq(jobRequisitions.departmentId, filters.departmentId));
  return db.select().from(jobRequisitions).where(and(...conditions)).orderBy(desc(jobRequisitions.createdAt));
}

export async function getJobRequisition(id: number): Promise<JobRequisition | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(jobRequisitions).where(eq(jobRequisitions.id, id));
  return rows[0];
}

export async function createJobRequisition(data: InsertJobRequisition): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(jobRequisitions).values(data);
  return (result[0] as any).insertId;
}

export async function updateJobRequisition(id: number, data: Partial<InsertJobRequisition>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(jobRequisitions).set({ ...data, updatedAt: new Date() }).where(eq(jobRequisitions.id, id));
}

// ─── JOB POSTINGS ─────────────────────────────────────────────────────────────
export async function listJobPostings(
  companyId: number,
  filters?: { status?: string; isPublic?: boolean }
): Promise<JobPosting[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(jobPostings.companyId, companyId)];
  if (filters?.status) conditions.push(eq(jobPostings.status, filters.status as JobPosting["status"]));
  if (filters?.isPublic !== undefined) conditions.push(eq(jobPostings.isPublic, filters.isPublic));
  return db.select().from(jobPostings).where(and(...conditions)).orderBy(desc(jobPostings.createdAt));
}

export async function listPublicJobPostings(companyId?: number): Promise<JobPosting[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(jobPostings.status, "published"), eq(jobPostings.isPublic, true)];
  if (companyId) conditions.push(eq(jobPostings.companyId, companyId));
  return db.select().from(jobPostings).where(and(...conditions)).orderBy(desc(jobPostings.publishedAt));
}

export async function getJobPosting(id: number): Promise<JobPosting | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
  return rows[0];
}

export async function createJobPosting(data: InsertJobPosting): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(jobPostings).values(data);
  return (result[0] as any).insertId;
}

export async function updateJobPosting(id: number, data: Partial<InsertJobPosting>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(jobPostings).set({ ...data, updatedAt: new Date() }).where(eq(jobPostings.id, id));
}

// ─── CANDIDATES ───────────────────────────────────────────────────────────────
export async function listCandidates(
  companyId: number,
  filters?: { search?: string; source?: string; status?: string; minExperience?: number; maxExperience?: number }
): Promise<Candidate[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(candidates.companyId, companyId)];
  if (filters?.status) conditions.push(eq(candidates.status, filters.status as Candidate["status"]));
  if (filters?.source) conditions.push(eq(candidates.source, filters.source as Candidate["source"]));
  if (filters?.search) {
    conditions.push(
      or(
        like(candidates.firstName, `%${filters.search}%`),
        like(candidates.lastName, `%${filters.search}%`),
        like(candidates.email, `%${filters.search}%`),
        like(candidates.currentTitle, `%${filters.search}%`)
      )!
    );
  }
  return db.select().from(candidates).where(and(...conditions)).orderBy(desc(candidates.createdAt));
}

export async function getCandidate(id: number): Promise<Candidate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(candidates).where(eq(candidates.id, id));
  return rows[0];
}

export async function createCandidate(data: InsertCandidate): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(candidates).values(data);
  return (result[0] as any).insertId;
}

export async function updateCandidate(id: number, data: Partial<InsertCandidate>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(candidates).set({ ...data, updatedAt: new Date() }).where(eq(candidates.id, id));
}

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────
export async function listApplications(
  companyId: number,
  filters?: { jobPostingId?: number; candidateId?: number; stage?: string; status?: string }
): Promise<Application[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(applications.companyId, companyId)];
  if (filters?.jobPostingId) conditions.push(eq(applications.jobPostingId, filters.jobPostingId));
  if (filters?.candidateId) conditions.push(eq(applications.candidateId, filters.candidateId));
  if (filters?.stage) conditions.push(eq(applications.stage, filters.stage as Application["stage"]));
  if (filters?.status) conditions.push(eq(applications.status, filters.status as Application["status"]));
  return db.select().from(applications).where(and(...conditions)).orderBy(desc(applications.appliedAt));
}

export async function getApplication(id: number): Promise<Application | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(applications).where(eq(applications.id, id));
  return rows[0];
}

export async function createApplication(data: InsertApplication): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(applications).values(data);
  return (result[0] as any).insertId;
}

export async function updateApplication(id: number, data: Partial<InsertApplication>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(applications).set({ ...data, updatedAt: new Date() }).where(eq(applications.id, id));
}

export async function moveApplicationStage(
  applicationId: number,
  toStage: Application["stage"],
  movedBy: number,
  notes?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const current = await getApplication(applicationId);
  if (!current) return;
  await db.insert(applicationStageHistory).values({
    applicationId,
    fromStage: current.stage,
    toStage,
    movedBy,
    notes,
  });
  await db.update(applications).set({ stage: toStage, updatedAt: new Date() }).where(eq(applications.id, applicationId));
}

export async function getApplicationStageHistory(applicationId: number): Promise<ApplicationStageHistory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(applicationStageHistory).where(eq(applicationStageHistory.applicationId, applicationId)).orderBy(applicationStageHistory.movedAt);
}

export async function getKanbanData(companyId: number, jobPostingId?: number): Promise<Record<string, Application[]>> {
  const db = await getDb();
  if (!db) return {};
  const conditions = [eq(applications.companyId, companyId)];
  if (jobPostingId) conditions.push(eq(applications.jobPostingId, jobPostingId));
  const rows = await db.select().from(applications).where(and(...conditions)).orderBy(desc(applications.appliedAt));
  const stages = ["applied", "screening", "shortlisted", "test", "interview", "evaluation", "offer", "hired", "rejected"];
  const kanban: Record<string, Application[]> = {};
  for (const stage of stages) kanban[stage] = [];
  for (const row of rows) kanban[row.stage]?.push(row);
  return kanban;
}

// ─── EVALUATION TEMPLATES ─────────────────────────────────────────────────────
export async function listEvaluationTemplates(companyId: number, type?: string): Promise<EvaluationTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(evaluationTemplates.companyId, companyId), eq(evaluationTemplates.isActive, true)];
  if (type) conditions.push(eq(evaluationTemplates.type, type as EvaluationTemplate["type"]));
  return db.select().from(evaluationTemplates).where(and(...conditions)).orderBy(evaluationTemplates.name);
}

export async function createEvaluationTemplate(data: InsertEvaluationTemplate): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(evaluationTemplates).values(data);
  return (result[0] as any).insertId;
}

export async function updateEvaluationTemplate(id: number, data: Partial<InsertEvaluationTemplate>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(evaluationTemplates).set({ ...data, updatedAt: new Date() }).where(eq(evaluationTemplates.id, id));
}

// ─── INTERVIEW SCHEDULES ──────────────────────────────────────────────────────
export async function listInterviewSchedules(
  companyId: number,
  filters?: { applicationId?: number; interviewerId?: number; status?: string }
): Promise<InterviewSchedule[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(interviewSchedules.companyId, companyId)];
  if (filters?.applicationId) conditions.push(eq(interviewSchedules.applicationId, filters.applicationId));
  if (filters?.interviewerId) conditions.push(eq(interviewSchedules.interviewerId, filters.interviewerId));
  if (filters?.status) conditions.push(eq(interviewSchedules.status, filters.status as InterviewSchedule["status"]));
  return db.select().from(interviewSchedules).where(and(...conditions)).orderBy(desc(interviewSchedules.scheduledAt));
}

export async function createInterviewSchedule(data: InsertInterviewSchedule): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(interviewSchedules).values(data);
  return (result[0] as any).insertId;
}

export async function updateInterviewSchedule(id: number, data: Partial<InsertInterviewSchedule>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(interviewSchedules).set({ ...data, updatedAt: new Date() }).where(eq(interviewSchedules.id, id));
}

// ─── INTERVIEW SCORECARDS ─────────────────────────────────────────────────────
export async function listScorecards(
  companyId: number,
  filters?: { applicationId?: number; interviewScheduleId?: number }
): Promise<InterviewScorecard[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(interviewScorecards.companyId, companyId)];
  if (filters?.applicationId) conditions.push(eq(interviewScorecards.applicationId, filters.applicationId));
  if (filters?.interviewScheduleId) conditions.push(eq(interviewScorecards.interviewScheduleId, filters.interviewScheduleId));
  return db.select().from(interviewScorecards).where(and(...conditions)).orderBy(desc(interviewScorecards.createdAt));
}

export async function submitScorecard(data: InsertInterviewScorecard): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(interviewScorecards).values({ ...data, submittedAt: new Date() });
  return (result[0] as any).insertId;
}

export async function updateScorecard(id: number, data: Partial<InsertInterviewScorecard>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(interviewScorecards).set(data).where(eq(interviewScorecards.id, id));
}

// ─── OFFER LETTERS ────────────────────────────────────────────────────────────
export async function listOfferLetters(
  companyId: number,
  filters?: { applicationId?: number; status?: string }
): Promise<OfferLetter[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(offerLetters.companyId, companyId)];
  if (filters?.applicationId) conditions.push(eq(offerLetters.applicationId, filters.applicationId));
  if (filters?.status) conditions.push(eq(offerLetters.status, filters.status as OfferLetter["status"]));
  return db.select().from(offerLetters).where(and(...conditions)).orderBy(desc(offerLetters.createdAt));
}

export async function createOfferLetter(data: InsertOfferLetter): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(offerLetters).values(data);
  return (result[0] as any).insertId;
}

export async function updateOfferLetter(id: number, data: Partial<InsertOfferLetter>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(offerLetters).set({ ...data, updatedAt: new Date() }).where(eq(offerLetters.id, id));
}

// ─── CAREER PORTAL SETTINGS ───────────────────────────────────────────────────
export async function getCareerPortalSettings(companyId: number): Promise<CareerPortalSetting | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(careerPortalSettings).where(eq(careerPortalSettings.companyId, companyId));
  return rows[0];
}

export async function upsertCareerPortalSettings(companyId: number, data: Partial<InsertCareerPortalSetting>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getCareerPortalSettings(companyId);
  if (existing) {
    await db.update(careerPortalSettings).set({ ...data, updatedAt: new Date() }).where(eq(careerPortalSettings.companyId, companyId));
  } else {
    await db.insert(careerPortalSettings).values({ companyId, ...data } as InsertCareerPortalSetting);
  }
}

// ─── RECRUITMENT EMAIL TEMPLATES ──────────────────────────────────────────────
export async function listEmailTemplates(companyId: number): Promise<RecruitmentEmailTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recruitmentEmailTemplates).where(eq(recruitmentEmailTemplates.companyId, companyId)).orderBy(recruitmentEmailTemplates.name);
}

export async function createEmailTemplate(data: InsertRecruitmentEmailTemplate): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(recruitmentEmailTemplates).values(data);
  return (result[0] as any).insertId;
}

// ─── AI SCREENING CONFIGS ─────────────────────────────────────────────────────
export async function getAiScreeningConfig(jobPostingId: number): Promise<AiScreeningConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(aiScreeningConfigs).where(and(eq(aiScreeningConfigs.jobPostingId, jobPostingId), eq(aiScreeningConfigs.isActive, true)));
  return rows[0];
}

export async function upsertAiScreeningConfig(data: InsertAiScreeningConfig): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getAiScreeningConfig(data.jobPostingId);
  if (existing) {
    await db.update(aiScreeningConfigs).set({ ...data, updatedAt: new Date() }).where(eq(aiScreeningConfigs.id, existing.id));
  } else {
    await db.insert(aiScreeningConfigs).values(data);
  }
}

// ─── CANDIDATE TAGS ───────────────────────────────────────────────────────────
export async function listCandidateTags(companyId: number): Promise<CandidateTag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(candidateTags).where(eq(candidateTags.companyId, companyId)).orderBy(candidateTags.name);
}

export async function createCandidateTag(data: InsertCandidateTag): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(candidateTags).values(data);
  return (result[0] as any).insertId;
}

// ─── RECRUITMENT ACTIVITIES ───────────────────────────────────────────────────
export async function logRecruitmentActivity(data: InsertRecruitmentActivity): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(recruitmentActivities).values(data);
}

export async function listRecruitmentActivities(
  companyId: number,
  filters?: { applicationId?: number; candidateId?: number; jobPostingId?: number }
): Promise<RecruitmentActivity[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(recruitmentActivities.companyId, companyId)];
  if (filters?.applicationId) conditions.push(eq(recruitmentActivities.applicationId, filters.applicationId));
  if (filters?.candidateId) conditions.push(eq(recruitmentActivities.candidateId, filters.candidateId));
  if (filters?.jobPostingId) conditions.push(eq(recruitmentActivities.jobPostingId, filters.jobPostingId));
  return db.select().from(recruitmentActivities).where(and(...conditions)).orderBy(desc(recruitmentActivities.createdAt)).limit(50);
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
export async function getPipelineReport(companyId: number, jobPostingId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(applications.companyId, companyId)];
  if (jobPostingId) conditions.push(eq(applications.jobPostingId, jobPostingId));
  const rows = await db.select().from(applications).where(and(...conditions));
  const stages = ["applied", "screening", "shortlisted", "test", "interview", "evaluation", "offer", "hired", "rejected"];
  return stages.map((stage) => ({ stage, count: rows.filter((r) => r.stage === stage).length }));
}

export async function getTimeToHireReport(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const hired = await db.select().from(applications).where(and(eq(applications.companyId, companyId), eq(applications.stage, "hired")));
  return hired.map((a) => ({
    applicationId: a.id,
    candidateId: a.candidateId,
    jobPostingId: a.jobPostingId,
    appliedAt: a.appliedAt,
    hiredAt: a.updatedAt,
    daysToHire: Math.round((a.updatedAt.getTime() - a.appliedAt.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

export async function getSourceAnalysisReport(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(candidates).where(eq(candidates.companyId, companyId));
  const sources = ["direct", "referral", "linkedin", "job_board", "career_portal", "agency", "other"];
  return sources.map((source) => ({ source, count: rows.filter((r) => r.source === source).length }));
}
