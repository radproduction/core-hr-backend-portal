/**
 * recruitmentDb.ts — DB query helpers for Module 5: Recruitment (MongoDB)
 */
import type {
  AiScreeningConfig,
  Application,
  ApplicationStageHistory,
  Candidate,
  CandidateTag,
  CareerPortalSetting,
  EvaluationTemplate,
  InsertAiScreeningConfig,
  InsertApplication,
  InsertCandidate,
  InsertCandidateTag,
  InsertCareerPortalSetting,
  InsertEvaluationTemplate,
  InsertInterviewSchedule,
  InsertInterviewScorecard,
  InsertJobPosting,
  InsertJobRequisition,
  InsertOfferLetter,
  InsertRecruitmentActivity,
  InsertRecruitmentEmailTemplate,
  InterviewSchedule,
  InterviewScorecard,
  JobPosting,
  JobRequisition,
  OfferLetter,
  RecruitmentActivity,
  RecruitmentEmailTemplate,
} from "../drizzle/schema";
import {
  insertDoc, updateDoc, findMany, findOneDoc,
} from "./_core/mongoStore";

const REQUISITIONS = "JobRequisitionRecord";
const POSTINGS = "JobPostingRecord";
const CANDIDATES = "CandidateRecord";
const APPLICATIONS = "ApplicationRecord";
const STAGE_HISTORY = "ApplicationStageHistoryRecord";
const EVAL_TEMPLATES = "EvaluationTemplateRecord";
const INTERVIEWS = "InterviewScheduleRecord";
const SCORECARDS = "InterviewScorecardRecord";
const OFFERS = "OfferLetterRecord";
const PORTAL_SETTINGS = "CareerPortalSettingRecord";
const EMAIL_TEMPLATES = "RecruitmentEmailTemplateRecord";
const AI_CONFIGS = "AiScreeningConfigRecord";
const TAGS = "CandidateTagRecord";
const ACTIVITIES = "RecruitmentActivityRecord";

const STAGES = ["applied", "screening", "shortlisted", "test", "interview", "evaluation", "offer", "hired", "rejected"];

// ─── JOB REQUISITIONS ─────────────────────────────────────────────────────────
export async function listJobRequisitions(
  companyId: number,
  filters?: { status?: string; departmentId?: number }
): Promise<JobRequisition[]> {
  const q: Record<string, unknown> = { companyId };
  if (filters?.status) q.status = filters.status;
  if (filters?.departmentId) q.departmentId = filters.departmentId;
  return findMany(REQUISITIONS, q, { createdAt: -1 });
}

export async function getJobRequisition(id: number): Promise<JobRequisition | undefined> {
  return findOneDoc(REQUISITIONS, { id });
}

export async function createJobRequisition(data: InsertJobRequisition): Promise<number> {
  return (await insertDoc(REQUISITIONS, "jobRequisitions", data as Record<string, unknown>)).id;
}

export async function updateJobRequisition(id: number, data: Partial<InsertJobRequisition>): Promise<void> {
  await updateDoc(REQUISITIONS, { id }, { ...data, updatedAt: new Date() });
}

// ─── JOB POSTINGS ─────────────────────────────────────────────────────────────
export async function listJobPostings(
  companyId: number,
  filters?: { status?: string; isPublic?: boolean }
): Promise<JobPosting[]> {
  const q: Record<string, unknown> = { companyId };
  if (filters?.status) q.status = filters.status;
  if (filters?.isPublic !== undefined) q.isPublic = filters.isPublic;
  return findMany(POSTINGS, q, { createdAt: -1 });
}

export async function listPublicJobPostings(companyId?: number): Promise<JobPosting[]> {
  const q: Record<string, unknown> = { status: "published", isPublic: true };
  if (companyId) q.companyId = companyId;
  return findMany(POSTINGS, q, { publishedAt: -1 });
}

export async function getJobPosting(id: number): Promise<JobPosting | undefined> {
  return findOneDoc(POSTINGS, { id });
}

export async function createJobPosting(data: InsertJobPosting): Promise<number> {
  return (await insertDoc(POSTINGS, "jobPostings", data as Record<string, unknown>)).id;
}

export async function updateJobPosting(id: number, data: Partial<InsertJobPosting>): Promise<void> {
  await updateDoc(POSTINGS, { id }, { ...data, updatedAt: new Date() });
}

// ─── CANDIDATES ───────────────────────────────────────────────────────────────
export async function listCandidates(
  companyId: number,
  filters?: { search?: string; source?: string; status?: string; minExperience?: number; maxExperience?: number }
): Promise<Candidate[]> {
  const q: Record<string, unknown> = { companyId };
  if (filters?.status) q.status = filters.status;
  if (filters?.source) q.source = filters.source;
  if (filters?.search) {
    const rx = { $regex: filters.search, $options: "i" };
    q.$or = [
      { firstName: rx }, { lastName: rx }, { email: rx }, { currentTitle: rx },
    ];
  }
  return findMany(CANDIDATES, q, { createdAt: -1 });
}

export async function getCandidate(id: number): Promise<Candidate | undefined> {
  return findOneDoc(CANDIDATES, { id });
}

export async function createCandidate(data: InsertCandidate): Promise<number> {
  return (await insertDoc(CANDIDATES, "candidates", data as Record<string, unknown>)).id;
}

export async function updateCandidate(id: number, data: Partial<InsertCandidate>): Promise<void> {
  await updateDoc(CANDIDATES, { id }, { ...data, updatedAt: new Date() });
}

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────
export async function listApplications(
  companyId: number,
  filters?: { jobPostingId?: number; candidateId?: number; stage?: string; status?: string }
): Promise<Application[]> {
  const q: Record<string, unknown> = { companyId };
  if (filters?.jobPostingId) q.jobPostingId = filters.jobPostingId;
  if (filters?.candidateId) q.candidateId = filters.candidateId;
  if (filters?.stage) q.stage = filters.stage;
  if (filters?.status) q.status = filters.status;
  return findMany(APPLICATIONS, q, { appliedAt: -1 });
}

export async function getApplication(id: number): Promise<Application | undefined> {
  return findOneDoc(APPLICATIONS, { id });
}

export async function createApplication(data: InsertApplication): Promise<number> {
  return (await insertDoc(APPLICATIONS, "applications", { appliedAt: new Date(), ...data })).id;
}

export async function updateApplication(id: number, data: Partial<InsertApplication>): Promise<void> {
  await updateDoc(APPLICATIONS, { id }, { ...data, updatedAt: new Date() });
}

export async function moveApplicationStage(
  applicationId: number,
  toStage: Application["stage"],
  movedBy: number,
  notes?: string
): Promise<void> {
  const current = await getApplication(applicationId);
  if (!current) return;
  await insertDoc(STAGE_HISTORY, "applicationStageHistory", {
    applicationId,
    fromStage: current.stage,
    toStage,
    movedBy,
    notes: notes ?? null,
    movedAt: new Date(),
  });
  await updateDoc(APPLICATIONS, { id: applicationId }, { stage: toStage, updatedAt: new Date() });
}

export async function getApplicationStageHistory(applicationId: number): Promise<ApplicationStageHistory[]> {
  return findMany(STAGE_HISTORY, { applicationId }, { movedAt: 1 });
}

export async function getKanbanData(companyId: number, jobPostingId?: number): Promise<Record<string, Application[]>> {
  const q: Record<string, unknown> = { companyId };
  if (jobPostingId) q.jobPostingId = jobPostingId;
  const rows = await findMany(APPLICATIONS, q, { appliedAt: -1 });
  const kanban: Record<string, Application[]> = {};
  for (const stage of STAGES) kanban[stage] = [];
  for (const row of rows) kanban[row.stage]?.push(row);
  return kanban;
}

// ─── EVALUATION TEMPLATES ─────────────────────────────────────────────────────
export async function listEvaluationTemplates(companyId: number, type?: string): Promise<EvaluationTemplate[]> {
  const q: Record<string, unknown> = { companyId, isActive: true };
  if (type) q.type = type;
  return findMany(EVAL_TEMPLATES, q, { name: 1 });
}

export async function createEvaluationTemplate(data: InsertEvaluationTemplate): Promise<number> {
  return (await insertDoc(EVAL_TEMPLATES, "evaluationTemplates", { isActive: true, ...data })).id;
}

export async function updateEvaluationTemplate(id: number, data: Partial<InsertEvaluationTemplate>): Promise<void> {
  await updateDoc(EVAL_TEMPLATES, { id }, { ...data, updatedAt: new Date() });
}

// ─── INTERVIEW SCHEDULES ──────────────────────────────────────────────────────
export async function listInterviewSchedules(
  companyId: number,
  filters?: { applicationId?: number; interviewerId?: number; status?: string }
): Promise<InterviewSchedule[]> {
  const q: Record<string, unknown> = { companyId };
  if (filters?.applicationId) q.applicationId = filters.applicationId;
  if (filters?.interviewerId) q.interviewerId = filters.interviewerId;
  if (filters?.status) q.status = filters.status;
  return findMany(INTERVIEWS, q, { scheduledAt: -1 });
}

export async function createInterviewSchedule(data: InsertInterviewSchedule): Promise<number> {
  return (await insertDoc(INTERVIEWS, "interviewSchedules", data as Record<string, unknown>)).id;
}

export async function updateInterviewSchedule(id: number, data: Partial<InsertInterviewSchedule>): Promise<void> {
  await updateDoc(INTERVIEWS, { id }, { ...data, updatedAt: new Date() });
}

// ─── INTERVIEW SCORECARDS ─────────────────────────────────────────────────────
export async function listScorecards(
  companyId: number,
  filters?: { applicationId?: number; interviewScheduleId?: number }
): Promise<InterviewScorecard[]> {
  const q: Record<string, unknown> = { companyId };
  if (filters?.applicationId) q.applicationId = filters.applicationId;
  if (filters?.interviewScheduleId) q.interviewScheduleId = filters.interviewScheduleId;
  return findMany(SCORECARDS, q, { createdAt: -1 });
}

export async function submitScorecard(data: InsertInterviewScorecard): Promise<number> {
  return (await insertDoc(SCORECARDS, "interviewScorecards", { ...data, submittedAt: new Date() })).id;
}

export async function updateScorecard(id: number, data: Partial<InsertInterviewScorecard>): Promise<void> {
  await updateDoc(SCORECARDS, { id }, data as Record<string, unknown>);
}

// ─── OFFER LETTERS ────────────────────────────────────────────────────────────
export async function listOfferLetters(
  companyId: number,
  filters?: { applicationId?: number; status?: string }
): Promise<OfferLetter[]> {
  const q: Record<string, unknown> = { companyId };
  if (filters?.applicationId) q.applicationId = filters.applicationId;
  if (filters?.status) q.status = filters.status;
  return findMany(OFFERS, q, { createdAt: -1 });
}

export async function createOfferLetter(data: InsertOfferLetter): Promise<number> {
  return (await insertDoc(OFFERS, "offerLetters", data as Record<string, unknown>)).id;
}

export async function updateOfferLetter(id: number, data: Partial<InsertOfferLetter>): Promise<void> {
  await updateDoc(OFFERS, { id }, { ...data, updatedAt: new Date() });
}

// ─── CAREER PORTAL SETTINGS ───────────────────────────────────────────────────
export async function getCareerPortalSettings(companyId: number): Promise<CareerPortalSetting | undefined> {
  return findOneDoc(PORTAL_SETTINGS, { companyId });
}

export async function upsertCareerPortalSettings(companyId: number, data: Partial<InsertCareerPortalSetting>): Promise<void> {
  const existing = await getCareerPortalSettings(companyId);
  if (existing) {
    await updateDoc(PORTAL_SETTINGS, { companyId }, { ...data, updatedAt: new Date() });
  } else {
    await insertDoc(PORTAL_SETTINGS, "careerPortalSettings", { companyId, ...data });
  }
}

// ─── RECRUITMENT EMAIL TEMPLATES ──────────────────────────────────────────────
export async function listEmailTemplates(companyId: number): Promise<RecruitmentEmailTemplate[]> {
  return findMany(EMAIL_TEMPLATES, { companyId }, { name: 1 });
}

export async function createEmailTemplate(data: InsertRecruitmentEmailTemplate): Promise<number> {
  return (await insertDoc(EMAIL_TEMPLATES, "recruitmentEmailTemplates", data as Record<string, unknown>)).id;
}

// ─── AI SCREENING CONFIGS ─────────────────────────────────────────────────────
export async function getAiScreeningConfig(jobPostingId: number): Promise<AiScreeningConfig | undefined> {
  return findOneDoc(AI_CONFIGS, { jobPostingId, isActive: true });
}

export async function upsertAiScreeningConfig(data: InsertAiScreeningConfig): Promise<void> {
  const existing = await getAiScreeningConfig(data.jobPostingId);
  if (existing) {
    await updateDoc(AI_CONFIGS, { id: existing.id }, { ...data, updatedAt: new Date() });
  } else {
    await insertDoc(AI_CONFIGS, "aiScreeningConfigs", { isActive: true, ...data });
  }
}

// ─── CANDIDATE TAGS ───────────────────────────────────────────────────────────
export async function listCandidateTags(companyId: number): Promise<CandidateTag[]> {
  return findMany(TAGS, { companyId }, { name: 1 });
}

export async function createCandidateTag(data: InsertCandidateTag): Promise<number> {
  return (await insertDoc(TAGS, "candidateTags", data as Record<string, unknown>)).id;
}

// ─── RECRUITMENT ACTIVITIES ───────────────────────────────────────────────────
export async function logRecruitmentActivity(data: InsertRecruitmentActivity): Promise<void> {
  await insertDoc(ACTIVITIES, "recruitmentActivities", data as Record<string, unknown>);
}

export async function listRecruitmentActivities(
  companyId: number,
  filters?: { applicationId?: number; candidateId?: number; jobPostingId?: number }
): Promise<RecruitmentActivity[]> {
  const q: Record<string, unknown> = { companyId };
  if (filters?.applicationId) q.applicationId = filters.applicationId;
  if (filters?.candidateId) q.candidateId = filters.candidateId;
  if (filters?.jobPostingId) q.jobPostingId = filters.jobPostingId;
  return findMany(ACTIVITIES, q, { createdAt: -1 }, 50);
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
export async function getPipelineReport(companyId: number, jobPostingId?: number) {
  const q: Record<string, unknown> = { companyId };
  if (jobPostingId) q.jobPostingId = jobPostingId;
  const rows = await findMany(APPLICATIONS, q);
  return STAGES.map((stage) => ({ stage, count: rows.filter((r: any) => r.stage === stage).length }));
}

export async function getTimeToHireReport(companyId: number) {
  const hired = await findMany(APPLICATIONS, { companyId, stage: "hired" });
  return hired.map((a: any) => {
    const applied = a.appliedAt ? new Date(a.appliedAt).getTime() : null;
    const hiredAt = a.updatedAt ? new Date(a.updatedAt).getTime() : null;
    return {
      applicationId: a.id,
      candidateId: a.candidateId,
      jobPostingId: a.jobPostingId,
      appliedAt: a.appliedAt,
      hiredAt: a.updatedAt,
      daysToHire: applied && hiredAt ? Math.round((hiredAt - applied) / (1000 * 60 * 60 * 24)) : null,
    };
  });
}

export async function getSourceAnalysisReport(companyId: number) {
  const rows = await findMany(CANDIDATES, { companyId });
  const sources = ["direct", "referral", "linkedin", "job_board", "career_portal", "agency", "other"];
  return sources.map((source) => ({ source, count: rows.filter((r: any) => r.source === source).length }));
}
