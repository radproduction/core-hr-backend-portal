/**
 * recruitmentRouter.ts — tRPC router for Module 5: Recruitment
 *
 * Sub-routers: requisitions, jobs, candidates, applications, pipeline,
 *              templates, interviews, scorecards, offers, careerPortal, reports, ai
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createApplication,
  createCandidate,
  createCandidateTag,
  createEmailTemplate,
  createEvaluationTemplate,
  createInterviewSchedule,
  createJobPosting,
  createJobRequisition,
  createOfferLetter,
  getApplication,
  getApplicationStageHistory,
  getAiScreeningConfig,
  getCandidate,
  getCareerPortalSettings,
  getJobPosting,
  getJobRequisition,
  getPipelineReport,
  getSourceAnalysisReport,
  getTimeToHireReport,
  getKanbanData,
  listApplications,
  listCandidateTags,
  listCandidates,
  listEmailTemplates,
  listEvaluationTemplates,
  listInterviewSchedules,
  listJobPostings,
  listJobRequisitions,
  listOfferLetters,
  listPublicJobPostings,
  listRecruitmentActivities,
  listScorecards,
  logRecruitmentActivity,
  moveApplicationStage,
  submitScorecard,
  updateApplication,
  updateCandidate,
  updateEvaluationTemplate,
  updateInterviewSchedule,
  updateJobPosting,
  updateJobRequisition,
  updateOfferLetter,
  updateScorecard,
  upsertAiScreeningConfig,
  upsertCareerPortalSettings,
} from "../recruitmentDb";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

// ─── REQUISITIONS ─────────────────────────────────────────────────────────────
const requisitionsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), departmentId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return listJobRequisitions(1, input);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const req = await getJobRequisition(input.id);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      return req;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      headcount: z.number().min(1).default(1),
      departmentId: z.number().optional(),
      designationId: z.number().optional(),
      justification: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      targetDate: z.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createJobRequisition({
        ...input,
        companyId: 1,
        requestedBy: ctx.user.id,
        status: "pending_approval",
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: z.object({
      title: z.string().optional(),
      headcount: z.number().optional(),
      justification: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      status: z.enum(["draft", "pending_approval", "approved", "rejected", "fulfilled", "cancelled"]).optional(),
      notes: z.string().optional(),
    }) }))
    .mutation(async ({ input }) => {
      await updateJobRequisition(input.id, input.data);
      return { success: true };
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await updateJobRequisition(input.id, { status: "approved", approvedBy: ctx.user.id });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      await updateJobRequisition(input.id, { status: "rejected", notes: input.notes });
      return { success: true };
    }),
});

// ─── JOB POSTINGS ─────────────────────────────────────────────────────────────
const jobsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), isPublic: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      return listJobPostings(1, input);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const job = await getJobPosting(input.id);
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return job;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      requirements: z.string().optional(),
      responsibilities: z.string().optional(),
      location: z.string().optional(),
      type: z.enum(["full_time", "part_time", "contract", "internship", "freelance"]).default("full_time"),
      salaryMin: z.string().optional(),
      salaryMax: z.string().optional(),
      currency: z.string().default("AED"),
      experienceMin: z.number().default(0),
      experienceMax: z.number().optional(),
      skills: z.array(z.string()).optional(),
      isPublic: z.boolean().default(true),
      requisitionId: z.number().optional(),
      closingDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createJobPosting({
        ...input,
        companyId: 1,
        createdBy: ctx.user.id,
        status: "draft",
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      await updateJobPosting(input.id, input.data as any);
      return { success: true };
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateJobPosting(input.id, { status: "published", publishedAt: new Date() });
      return { success: true };
    }),

  close: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateJobPosting(input.id, { status: "closed" });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateJobPosting(input.id, { status: "closed" });
      return { success: true };
    }),
});

// ─── CANDIDATES ───────────────────────────────────────────────────────────────
const candidatesRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      source: z.string().optional(),
      status: z.string().optional(),
      minExperience: z.number().optional(),
      maxExperience: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return listCandidates(1, input);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const c = await getCandidate(input.id);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      return c;
    }),

  create: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      currentTitle: z.string().optional(),
      currentCompany: z.string().optional(),
      totalExperience: z.string().optional(),
      skills: z.array(z.string()).optional(),
      education: z.array(z.record(z.string(), z.string())).optional(),
      resumeUrl: z.string().optional(),
      resumeKey: z.string().optional(),
      linkedinUrl: z.string().optional(),
      source: z.enum(["direct", "referral", "linkedin", "job_board", "career_portal", "agency", "other"]).default("direct"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createCandidate({ ...input, companyId: 1 });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      await updateCandidate(input.id, input.data as any);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateCandidate(input.id, { status: "inactive" });
      return { success: true };
    }),

  listTags: protectedProcedure
    .query(async ({ ctx }) => {
      return listCandidateTags(1);
    }),

  createTag: protectedProcedure
    .input(z.object({ name: z.string().min(1), color: z.string().default("#6366f1") }))
    .mutation(async ({ ctx, input }) => {
      const id = await createCandidateTag({ ...input, companyId: 1 });
      return { id };
    }),
});

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────
const applicationsRouter = router({
  list: protectedProcedure
    .input(z.object({
      jobPostingId: z.number().optional(),
      candidateId: z.number().optional(),
      stage: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return listApplications(1, input);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const app = await getApplication(input.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND" });
      return app;
    }),

  create: protectedProcedure
    .input(z.object({
      jobPostingId: z.number(),
      candidateId: z.number(),
      coverLetter: z.string().optional(),
      expectedSalary: z.string().optional(),
      currency: z.string().default("AED"),
      referredBy: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createApplication({ ...input, companyId: 1 });
      await logRecruitmentActivity({
        companyId: 1,
        applicationId: id,
        candidateId: input.candidateId,
        jobPostingId: input.jobPostingId,
        actorId: ctx.user.id,
        action: "application_created",
        details: { stage: "applied" },
      });
      return { id };
    }),

  updateStage: protectedProcedure
    .input(z.object({
      id: z.number(),
      stage: z.enum(["applied", "screening", "shortlisted", "test", "interview", "evaluation", "offer", "hired", "rejected", "withdrawn"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await moveApplicationStage(input.id, input.stage, ctx.user.id, input.notes);
      await logRecruitmentActivity({
        companyId: 1,
        applicationId: input.id,
        actorId: ctx.user.id,
        action: "stage_changed",
        details: { toStage: input.stage, notes: input.notes },
      });
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["active", "on_hold", "rejected", "withdrawn", "hired"]),
      rejectionReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await updateApplication(input.id, { status: input.status, rejectionReason: input.rejectionReason });
      return { success: true };
    }),

  addNote: protectedProcedure
    .input(z.object({ id: z.number(), note: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const app = await getApplication(input.id);
      if (!app) throw new TRPCError({ code: "NOT_FOUND" });
      const existing = app.notes ? app.notes + "\n\n" : "";
      await updateApplication(input.id, { notes: existing + `[${new Date().toISOString()}] ${input.note}` });
      return { success: true };
    }),
});

// ─── PIPELINE (KANBAN) ────────────────────────────────────────────────────────
const pipelineRouter = router({
  getKanban: protectedProcedure
    .input(z.object({ jobPostingId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return getKanbanData(1, input.jobPostingId);
    }),

  moveStage: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      stage: z.enum(["applied", "screening", "shortlisted", "test", "interview", "evaluation", "offer", "hired", "rejected", "withdrawn"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await moveApplicationStage(input.applicationId, input.stage, ctx.user.id, input.notes);
      return { success: true };
    }),

  getStageHistory: protectedProcedure
    .input(z.object({ applicationId: z.number() }))
    .query(async ({ input }) => {
      return getApplicationStageHistory(input.applicationId);
    }),
});

// ─── EVALUATION TEMPLATES ─────────────────────────────────────────────────────
const templatesRouter = router({
  list: protectedProcedure
    .input(z.object({ type: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return listEvaluationTemplates(1, input.type);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["test", "interview", "evaluation", "technical", "behavioral"]).default("interview"),
      description: z.string().optional(),
      criteria: z.array(z.object({ name: z.string(), weight: z.number(), maxScore: z.number() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createEvaluationTemplate({ ...input, companyId: 1, createdBy: ctx.user.id });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      await updateEvaluationTemplate(input.id, input.data as any);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateEvaluationTemplate(input.id, { isActive: false });
      return { success: true };
    }),
});

// ─── INTERVIEWS ───────────────────────────────────────────────────────────────
const interviewsRouter = router({
  list: protectedProcedure
    .input(z.object({
      applicationId: z.number().optional(),
      interviewerId: z.number().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return listInterviewSchedules(1, input);
    }),

  schedule: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      interviewerId: z.number(),
      scheduledAt: z.date(),
      duration: z.number().default(60),
      type: z.enum(["phone", "video", "in_person", "technical", "panel"]).default("video"),
      location: z.string().optional(),
      meetingLink: z.string().optional(),
      templateId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createInterviewSchedule({ ...input, companyId: 1 });
      await logRecruitmentActivity({
        companyId: 1,
        applicationId: input.applicationId,
        actorId: ctx.user.id,
        action: "interview_scheduled",
        details: { scheduledAt: input.scheduledAt, type: input.type },
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      await updateInterviewSchedule(input.id, input.data as any);
      return { success: true };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      await updateInterviewSchedule(input.id, { status: "cancelled", notes: input.reason });
      return { success: true };
    }),
});

// ─── SCORECARDS ───────────────────────────────────────────────────────────────
const scorecardsRouter = router({
  list: protectedProcedure
    .input(z.object({ applicationId: z.number().optional(), interviewScheduleId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return listScorecards(1, input);
    }),

  submit: protectedProcedure
    .input(z.object({
      interviewScheduleId: z.number(),
      applicationId: z.number(),
      ratings: z.record(z.string(), z.number()).optional(),
      overallRating: z.number().min(1).max(10),
      recommendation: z.enum(["strong_hire", "hire", "neutral", "no_hire", "strong_no_hire"]),
      strengths: z.string().optional(),
      weaknesses: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await submitScorecard({ ...input, companyId: 1, interviewerId: ctx.user.id });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      await updateScorecard(input.id, input.data as any);
      return { success: true };
    }),
});

// ─── OFFERS ───────────────────────────────────────────────────────────────────
const offersRouter = router({
  list: protectedProcedure
    .input(z.object({ applicationId: z.number().optional(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return listOfferLetters(1, input);
    }),

  create: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      candidateId: z.number(),
      jobPostingId: z.number(),
      offeredSalary: z.string(),
      currency: z.string().default("AED"),
      startDate: z.date().optional(),
      expiryDate: z.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createOfferLetter({ ...input, companyId: 1, createdBy: ctx.user.id });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      await updateOfferLetter(input.id, input.data as any);
      return { success: true };
    }),

  accept: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateOfferLetter(input.id, { status: "accepted" });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      await updateOfferLetter(input.id, { status: "rejected", notes: input.reason });
      return { success: true };
    }),
});

// ─── CAREER PORTAL ────────────────────────────────────────────────────────────
const careerPortalRouter = router({
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      return getCareerPortalSettings(1);
    }),

  updateSettings: protectedProcedure
    .input(z.object({
      headline: z.string().optional(),
      description: z.string().optional(),
      logoUrl: z.string().optional(),
      bannerUrl: z.string().optional(),
      primaryColor: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertCareerPortalSettings(1, input);
      return { success: true };
    }),

  // Public endpoint — no auth required
  listPublicJobs: publicProcedure
    .input(z.object({ companyId: z.number().optional() }))
    .query(async ({ input }) => {
      return listPublicJobPostings(input.companyId);
    }),

  // Public application submission
  applyPublic: publicProcedure
    .input(z.object({
      jobPostingId: z.number(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      currentTitle: z.string().optional(),
      currentCompany: z.string().optional(),
      totalExperience: z.string().optional(),
      coverLetter: z.string().optional(),
      expectedSalary: z.string().optional(),
      resumeUrl: z.string().optional(),
      resumeKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const job = await getJobPosting(input.jobPostingId);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      if (job.status !== "published") throw new TRPCError({ code: "BAD_REQUEST", message: "Job is not accepting applications" });

      // Create or find candidate
      const candidateId = await createCandidate({
        companyId: job.companyId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        currentTitle: input.currentTitle,
        currentCompany: input.currentCompany,
        totalExperience: input.totalExperience,
        resumeUrl: input.resumeUrl,
        resumeKey: input.resumeKey,
        source: "career_portal",
      });

      // Create application
      const applicationId = await createApplication({
        companyId: job.companyId,
        jobPostingId: input.jobPostingId,
        candidateId,
        coverLetter: input.coverLetter,
        expectedSalary: input.expectedSalary,
        currency: job.currency,
      });

      await logRecruitmentActivity({
        companyId: job.companyId,
        applicationId,
        candidateId,
        jobPostingId: input.jobPostingId,
        action: "public_application_submitted",
        details: { email: input.email },
      });

      return { applicationId, candidateId, message: "Application submitted successfully. You will receive a confirmation email shortly." };
    }),

  getEmailTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      return listEmailTemplates(1);
    }),

  createEmailTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      trigger: z.enum(["application_received", "shortlisted", "interview_scheduled", "offer_sent", "rejected", "hired"]),
      subject: z.string().min(1),
      body: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await createEmailTemplate({ ...input, companyId: 1 });
      return { id };
    }),

  getAiScreeningConfig: protectedProcedure
    .input(z.object({ jobPostingId: z.number() }))
    .query(async ({ input }) => {
      return getAiScreeningConfig(input.jobPostingId);
    }),

  upsertAiScreeningConfig: protectedProcedure
    .input(z.object({
      jobPostingId: z.number(),
      mustHaveSkills: z.array(z.string()).optional(),
      niceToHaveSkills: z.array(z.string()).optional(),
      minExperience: z.number().default(0),
      maxExperience: z.number().optional(),
      keywords: z.array(z.string()).optional(),
      biasCheckEnabled: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertAiScreeningConfig({ ...input, companyId: 1 });
      return { success: true };
    }),
});

// ─── REPORTS ──────────────────────────────────────────────────────────────────
const reportsRouter = router({
  pipeline: protectedProcedure
    .input(z.object({ jobPostingId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return getPipelineReport(1, input.jobPostingId);
    }),

  timeToHire: protectedProcedure
    .query(async ({ ctx }) => {
      return getTimeToHireReport(1);
    }),

  sourceAnalysis: protectedProcedure
    .query(async ({ ctx }) => {
      return getSourceAnalysisReport(1);
    }),

  stageConversion: protectedProcedure
    .input(z.object({ jobPostingId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const pipeline = await getPipelineReport(1, input.jobPostingId);
      const total = pipeline.find((p) => p.stage === "applied")?.count ?? 0;
      return pipeline.map((p) => ({
        ...p,
        conversionRate: total > 0 ? Math.round((p.count / total) * 100) : 0,
      }));
    }),

  offerAcceptance: protectedProcedure
    .query(async ({ ctx }) => {
      const offers = await listOfferLetters(1);
      const total = offers.length;
      const accepted = offers.filter((o) => o.status === "accepted").length;
      const rejected = offers.filter((o) => o.status === "rejected").length;
      const pending = offers.filter((o) => o.status === "sent").length;
      return { total, accepted, rejected, pending, acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0 };
    }),

  activities: protectedProcedure
    .input(z.object({ applicationId: z.number().optional(), candidateId: z.number().optional(), jobPostingId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return listRecruitmentActivities(1, input);
    }),
});

// ─── AI ROUTER ────────────────────────────────────────────────────────────────
const recruitmentAiRouter = router({
  parseResume: protectedProcedure
    .input(z.object({ resumeText: z.string().min(1), resumeUrl: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { parseResume } = await import("../ai/recruitmentAI");
      return parseResume(input.resumeText);
    }),

  screenApplicant: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      jobPostingId: z.number(),
      candidateId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { screenCandidate } = await import("../ai/recruitmentAI");
      const job = await getJobPosting(input.jobPostingId);
      const candidate = await getCandidate(input.candidateId);
      if (!job || !candidate) throw new TRPCError({ code: "NOT_FOUND" });
      const result = await screenCandidate({
        jobTitle: job.title,
        jobDescription: job.description ?? "",
        requirements: job.requirements ?? "",
        candidateProfile: {
          skills: Array.isArray(candidate.skills) ? candidate.skills as string[] : [],
          totalExperience: candidate.totalExperience,
          currentTitle: candidate.currentTitle,
          education: Array.isArray(candidate.education) ? candidate.education as Array<{degree:string;institution:string}> : [],
          summary: candidate.notes,
        },
      });
      // Save scores back to application — human still decides
      await updateApplication(input.applicationId, {
        aiScreeningScore: result.overallScore,
        aiScreeningReason: result.aiDisclaimer,
      });
      return result;
    }),

  matchScore: protectedProcedure
    .input(z.object({ candidateId: z.number(), jobPostingId: z.number() }))
    .mutation(async ({ input }) => {
      const { scoreCandidateMatch } = await import("../ai/recruitmentAI");
      const job = await getJobPosting(input.jobPostingId);
      const candidate = await getCandidate(input.candidateId);
      if (!job || !candidate) throw new TRPCError({ code: "NOT_FOUND" });
      return scoreCandidateMatch({
        jobTitle: job.title,
        requiredSkills: Array.isArray(job.skills) ? job.skills as string[] : [],
        candidateSkills: Array.isArray(candidate.skills) ? candidate.skills as string[] : [],
        requiredExperience: `${job.experienceMin ?? 0}-${job.experienceMax ?? 10} years`,
        candidateExperience: candidate.totalExperience,
      });
    }),

  generateJD: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      department: z.string().optional(),
      keySkills: z.array(z.string()).optional(),
      experienceLevel: z.string().optional(),
      location: z.string().optional(),
      additionalContext: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { generateJobDescription } = await import("../ai/recruitmentAI");
      return generateJobDescription({
        title: input.title,
        department: input.department ?? "General",
        keySkills: input.keySkills ?? [],
        experienceLevel: input.experienceLevel ?? "Mid-level",
        location: input.location ?? "UAE",
        additionalContext: input.additionalContext,
      });
    }),

  suggestInterviewQuestions: protectedProcedure
    .input(z.object({
      jobTitle: z.string().min(1),
      keySkills: z.array(z.string()).optional(),
      experienceLevel: z.string().optional(),
      interviewType: z.enum(["technical", "behavioral", "mixed"]).default("mixed"),
    }))
    .mutation(async ({ input }) => {
      const { suggestInterviewQuestions } = await import("../ai/recruitmentAI");
      return suggestInterviewQuestions({
        jobTitle: input.jobTitle,
        keySkills: input.keySkills ?? [],
        experienceLevel: input.experienceLevel ?? "Mid-level",
        interviewType: input.interviewType,
      });
    }),

  summarizeScorecard: protectedProcedure
    .input(z.object({
      applicationId: z.number(),
      jobTitle: z.string().optional(),
      candidateName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { summarizeScorecards } = await import("../ai/recruitmentAI");
      const scorecards = await listScorecards(1, { applicationId: input.applicationId });
      return summarizeScorecards({
        jobTitle: input.jobTitle ?? "Unknown Role",
        candidateName: input.candidateName ?? "Candidate",
        scorecards: scorecards.map(s => ({
          interviewerName: `Interviewer ${s.interviewerId}`,
          overallRating: s.overallRating ?? 0,
          recommendation: s.recommendation ?? "neutral",
          strengths: s.strengths,
          weaknesses: s.weaknesses,
          notes: s.notes,
        })),
      });
    }),

  biasCheck: protectedProcedure
    .input(z.object({ jobPostingId: z.number() }))
    .mutation(async ({ input }) => {
      const job = await getJobPosting(input.jobPostingId);
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      // Run bias check on job requirements and title
      const criteria = [
        job.title,
        job.requirements ?? "",
        job.description ?? "",
      ].filter(Boolean);
      const { screenCandidate } = await import("../ai/recruitmentAI");
      // Use a dummy candidate to get bias flags from the screener
      const result = await screenCandidate({
        jobTitle: job.title,
        jobDescription: job.description ?? "",
        requirements: job.requirements ?? "",
        candidateProfile: { skills: [], totalExperience: null, currentTitle: null, education: [], summary: null },
        screeningCriteria: criteria,
      });
      return { biasFlags: result.biasFlags, jobTitle: job.title };
    }),
});

// ─── MAIN ROUTER ──────────────────────────────────────────────────────────────
export const recruitmentRouter = router({
  requisitions: requisitionsRouter,
  jobs: jobsRouter,
  candidates: candidatesRouter,
  applications: applicationsRouter,
  pipeline: pipelineRouter,
  templates: templatesRouter,
  interviews: interviewsRouter,
  scorecards: scorecardsRouter,
  offers: offersRouter,
  careerPortal: careerPortalRouter,
  reports: reportsRouter,
  ai: recruitmentAiRouter,
});
