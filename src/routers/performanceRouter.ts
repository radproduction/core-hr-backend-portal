/**
 * server/routers/performanceRouter.ts
 * Module 7 — Performance Management
 * Sub-routers: templates, kpis, cycles, evaluations, reports, ai
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  listAppraisalTemplates, getAppraisalTemplate, createAppraisalTemplate,
  updateAppraisalTemplate, deleteAppraisalTemplate, upsertTemplateSections,
  listKpiGroups, getKpiGroupWithDefinitions, createKpiGroup, updateKpiGroup,
  createKpiDefinition, updateKpiDefinition, listKpiDefinitions,
  listAppraisalCycles, getAppraisalCycle, createAppraisalCycle, updateAppraisalCycle,
  addCycleParticipants, getCycleParticipant, updateCycleParticipant,
  getParticipantByEmployeeCycle, upsertParticipantKpi, deleteParticipantKpi,
  upsertEvaluationRating, getEvaluationRatings, getRaterRatings,
  getCycleLeaderboard, getCycleSummaryStats, getPerformanceAuditLog,
  writePerfAuditLog,
} from "../performanceDb";

// ─── Shared Schemas ────────────────────────────────────────────────────────────
const questionSchema = z.object({
  id: z.number().optional(),
  questionText: z.string().min(1),
  questionType: z.enum(["rating", "text", "yes_no", "multi_choice"]).default("rating"),
  raterType: z.enum(["self", "manager", "peer", "all"]).default("all"),
  weight: z.number().min(0).max(100).default(1),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  isRequired: z.boolean().default(true),
  displayOrder: z.number().default(0),
});

const sectionSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  sectionType: z.enum(["kpi", "competency", "questionnaire", "development"]).default("questionnaire"),
  weight: z.number().min(0).max(100).default(0),
  displayOrder: z.number().default(0),
  isRequired: z.boolean().default(true),
  questions: z.array(questionSchema).default([]),
});

const scoringPolicySchema = z.object({
  scale: z.number().min(2).max(10).default(5),
  labels: z.record(z.string(), z.string()).optional(),
  passingScore: z.number().optional(),
}).optional();

const incrementPolicySchema = z.object({
  bands: z.array(z.object({
    minScore: z.number(),
    maxScore: z.number(),
    incrementPct: z.number(),
    label: z.string().optional(),
  })).default([]),
}).optional();

// ─── Templates Router ──────────────────────────────────────────────────────────
const templatesRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listAppraisalTemplates(input.companyId)),

  get: protectedProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .query(async ({ input }) => {
      const tpl = await getAppraisalTemplate(input.id, input.companyId);
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND" });
      return tpl;
    }),

  create: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      templateType: z.enum(["managerial", "non_managerial", "universal"]).default("universal"),
      scoringPolicy: scoringPolicySchema,
      incrementPolicy: incrementPolicySchema,
      sections: z.array(sectionSchema).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      const { sections, ...tplData } = input;
      const { id } = await createAppraisalTemplate({
        ...tplData,
        scoringPolicy: tplData.scoringPolicy as Record<string, unknown> ?? null,
        incrementPolicy: tplData.incrementPolicy as Record<string, unknown> ?? null,
        createdBy: ctx.user?.id,
      });
      if (sections.length) await upsertTemplateSections(id, sections.map(s => ({ ...s, weight: String(s.weight) })) as Parameters<typeof upsertTemplateSections>[1]);
      await writePerfAuditLog({ companyId: input.companyId, actorId: ctx.user?.id, entityType: "appraisalTemplate", entityId: id, action: "create", newValue: tplData });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      companyId: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      templateType: z.enum(["managerial", "non_managerial", "universal"]).optional(),
      scoringPolicy: scoringPolicySchema,
      incrementPolicy: incrementPolicySchema,
      sections: z.array(sectionSchema).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, companyId, sections, ...data } = input;
      await updateAppraisalTemplate(id, companyId, {
        ...data,
        scoringPolicy: data.scoringPolicy as Record<string, unknown> ?? undefined,
        incrementPolicy: data.incrementPolicy as Record<string, unknown> ?? undefined,
      });
      if (sections) await upsertTemplateSections(id, sections.map(s => ({ ...s, weight: String(s.weight) })) as Parameters<typeof upsertTemplateSections>[1]);
      await writePerfAuditLog({ companyId, actorId: ctx.user?.id, entityType: "appraisalTemplate", entityId: id, action: "update", newValue: data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await deleteAppraisalTemplate(input.id, input.companyId);
      await writePerfAuditLog({ companyId: input.companyId, actorId: ctx.user?.id, entityType: "appraisalTemplate", entityId: input.id, action: "deactivate" });
    }),
});

// ─── KPIs Router ──────────────────────────────────────────────────────────────
const kpisRouter = router({
  listGroups: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listKpiGroups(input.companyId)),

  getGroup: protectedProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .query(async ({ input }) => {
      const g = await getKpiGroupWithDefinitions(input.id, input.companyId);
      if (!g) throw new TRPCError({ code: "NOT_FOUND" });
      return g;
    }),

  createGroup: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      designationId: z.number().optional(),
      departmentId: z.number().optional(),
    }))
    .mutation(({ input }) => createKpiGroup(input)),

  updateGroup: protectedProcedure
    .input(z.object({
      id: z.number(), companyId: z.number(),
      name: z.string().optional(), description: z.string().optional(),
      designationId: z.number().optional(), departmentId: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, companyId, ...data } = input;
      return updateKpiGroup(id, companyId, data);
    }),

  listDefinitions: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listKpiDefinitions(input.companyId)),

  createDefinition: protectedProcedure
    .input(z.object({
      groupId: z.number(), companyId: z.number(),
      title: z.string().min(1), description: z.string().optional(),
      measurementUnit: z.string().optional(),
      targetType: z.enum(["numeric", "percentage", "boolean", "text"]).default("numeric"),
      defaultTarget: z.string().optional(),
      weight: z.number().min(0).max(100).default(1),
    }))
    .mutation(({ input }) => createKpiDefinition({
        ...input,
        weight: String(input.weight),
      })),


  updateDefinition: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(), description: z.string().optional(),
      measurementUnit: z.string().optional(), defaultTarget: z.string().optional(),
      weight: z.number().optional(), isActive: z.boolean().optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateKpiDefinition(id, {
        ...data,
        weight: data.weight !== undefined ? String(data.weight) : undefined,
      });
    }),
});

// ─── Cycles Router ─────────────────────────────────────────────────────────────
const cyclesRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listAppraisalCycles(input.companyId)),

  get: protectedProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .query(async ({ input }) => {
      const c = await getAppraisalCycle(input.id, input.companyId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      return c;
    }),

  create: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      name: z.string().min(1),
      periodLabel: z.string().optional(),
      cycleType: z.enum(["annual", "mid_year", "quarterly", "probation", "custom"]).default("annual"),
      templateId: z.number(),
      startDate: z.date(),
      endDate: z.date(),
      selfReviewDeadline: z.date().optional(),
      managerReviewDeadline: z.date().optional(),
      calibrationDeadline: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id } = await createAppraisalCycle({ ...input, createdBy: ctx.user?.id });
      await writePerfAuditLog({ companyId: input.companyId, actorId: ctx.user?.id, entityType: "appraisalCycle", entityId: id, action: "create", newValue: { name: input.name } });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(), companyId: z.number(),
      name: z.string().optional(), periodLabel: z.string().optional(),
      status: z.enum(["draft", "active", "self_review", "manager_review", "calibration", "completed", "archived"]).optional(),
      selfReviewDeadline: z.date().optional(),
      managerReviewDeadline: z.date().optional(),
      calibrationDeadline: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, companyId, ...data } = input;
      await updateAppraisalCycle(id, companyId, data);
      await writePerfAuditLog({ companyId, actorId: ctx.user?.id, entityType: "appraisalCycle", entityId: id, action: "update", newValue: data });
    }),

  addParticipants: protectedProcedure
    .input(z.object({
      cycleId: z.number(), companyId: z.number(),
      participants: z.array(z.object({
        employeeId: z.number(),
        managerId: z.number().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      await addCycleParticipants(input.cycleId, input.participants.map(p => ({
        cycleId: input.cycleId,
        employeeId: p.employeeId,
        managerId: p.managerId,
      })));
      await writePerfAuditLog({ companyId: input.companyId, actorId: ctx.user?.id, entityType: "cycleParticipants", entityId: input.cycleId, action: "add_participants", newValue: { count: input.participants.length } });
    }),

  getParticipant: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const p = await getCycleParticipant(input.id);
      if (!p) throw new TRPCError({ code: "NOT_FOUND" });
      return p;
    }),

  getMyParticipation: protectedProcedure
    .input(z.object({ cycleId: z.number(), employeeId: z.number() }))
    .query(({ input }) => getParticipantByEmployeeCycle(input.employeeId, input.cycleId)),
});

// ─── Evaluations Router ────────────────────────────────────────────────────────
const evaluationsRouter = router({
  getForm: protectedProcedure
    .input(z.object({ participantId: z.number(), raterId: z.number() }))
    .query(async ({ input }) => {
      const participant = await getCycleParticipant(input.participantId);
      if (!participant) throw new TRPCError({ code: "NOT_FOUND" });
      const existingRatings = await getRaterRatings(input.participantId, input.raterId);
      const allRatings = await getEvaluationRatings(input.participantId);
      return { participant, myRatings: existingRatings, allRatings };
    }),

  submitRatings: protectedProcedure
    .input(z.object({
      participantId: z.number(),
      raterId: z.number(),
      raterType: z.enum(["self", "manager", "peer"]),
      ratings: z.array(z.object({
        questionId: z.number(),
        ratingValue: z.string().optional(),
        ratingText: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const now = new Date();
      for (const r of input.ratings) {
        await upsertEvaluationRating({
          participantId: input.participantId,
          questionId: r.questionId,
          raterId: input.raterId,
          raterType: input.raterType,
          ratingValue: r.ratingValue,
          ratingText: r.ratingText,
          submittedAt: now,
        });
      }
      // Update participant status
      const statusMap: Record<string, "self_submitted" | "manager_submitted"> = {
        self: "self_submitted",
        manager: "manager_submitted",
      };
      if (statusMap[input.raterType]) {
        await updateCycleParticipant(input.participantId, { status: statusMap[input.raterType] });
      }
      return { success: true };
    }),

  saveKpis: protectedProcedure
    .input(z.object({
      participantId: z.number(),
      kpis: z.array(z.object({
        id: z.number().optional(),
        kpiDefinitionId: z.number().optional(),
        customTitle: z.string().optional(),
        target: z.string().optional(),
        actual: z.string().optional(),
        score: z.number().optional(),
        weight: z.number().default(1),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      for (const kpi of input.kpis) {
        await upsertParticipantKpi({
          ...kpi,
          participantId: input.participantId,
          weight: String(kpi.weight ?? 1),
          score: kpi.score !== undefined ? String(kpi.score) : undefined,
        } as Parameters<typeof upsertParticipantKpi>[0]);
      }
      return { success: true };
    }),

  deleteKpi: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteParticipantKpi(input.id)),

  saveFinalReview: protectedProcedure
    .input(z.object({
      participantId: z.number(),
      companyId: z.number(),
      managerNotes: z.string().optional(),
      finalReview: z.string().optional(),
      managerScore: z.number().optional(),
      finalScore: z.number().optional(),
      incrementPercent: z.number().optional(),
      incrementAmount: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { participantId, companyId, ...data } = input;
      await updateCycleParticipant(participantId, {
        ...data,
        managerScore: data.managerScore !== undefined ? String(data.managerScore) : undefined,
        finalScore: data.finalScore !== undefined ? String(data.finalScore) : undefined,
        incrementPercent: data.incrementPercent !== undefined ? String(data.incrementPercent) : undefined,
        incrementAmount: data.incrementAmount !== undefined ? String(data.incrementAmount) : undefined,
      });
      await writePerfAuditLog({ companyId, actorId: ctx.user?.id, entityType: "cycleParticipant", entityId: participantId, action: "save_review", newValue: { finalScore: data.finalScore } });
    }),
});

// ─── AI Router ─────────────────────────────────────────────────────────────────
const performanceAiRouter = router({
  writeReview: protectedProcedure
    .input(z.object({
      managerNotes: z.string().min(1),
      employeeName: z.string(),
      designation: z.string().optional(),
      periodLabel: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `You are an expert HR professional. A manager has provided rough notes about an employee's performance. Transform these notes into a balanced, professional, constructive performance review paragraph. The review should be specific, fair, and free of bias. It should acknowledge strengths and areas for development without using gendered language, age references, or protected characteristics.

Employee: ${input.employeeName}
Role: ${input.designation ?? "N/A"}
Period: ${input.periodLabel ?? "current review period"}

Manager's rough notes:
"${input.managerNotes}"

Write a professional 2-3 paragraph performance review. Return only the review text, no headers or labels.`;

      const response = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
      });
      const text = (response.choices?.[0]?.message?.content as string) ?? "";
      return { reviewText: text };
    }),

  detectBias: protectedProcedure
    .input(z.object({
      reviewText: z.string().min(1),
      employeeName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `You are a bias detection specialist. Analyze the following performance review for potential bias indicators including: gender bias, age bias, affinity bias, halo/horn effect, recency bias, attribution bias, or any language that references protected characteristics.

Review text:
"${input.reviewText}"

Respond with JSON only in this exact format:
{
  "hasBias": boolean,
  "biasScore": number (0-100, 0=no bias, 100=severe bias),
  "flags": [
    {
      "type": "string (e.g. gender_bias, recency_bias)",
      "severity": "low|medium|high",
      "excerpt": "the problematic phrase",
      "suggestion": "how to rephrase it"
    }
  ],
  "overallAssessment": "brief summary"
}`;

      const response = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const raw = (response.choices?.[0]?.message?.content as string) ?? "{}";
      try {
        return JSON.parse(raw) as {
          hasBias: boolean; biasScore: number;
          flags: Array<{ type: string; severity: string; excerpt: string; suggestion: string }>;
          overallAssessment: string;
        };
      } catch {
        return { hasBias: false, biasScore: 0, flags: [], overallAssessment: "Analysis unavailable" };
      }
    }),

  suggestKpis: protectedProcedure
    .input(z.object({
      designation: z.string(),
      department: z.string().optional(),
      existingKpis: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input }) => {
      const prompt = `You are an HR strategy expert. Suggest 5-8 relevant, measurable KPIs for the following role. Each KPI should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound).

Role: ${input.designation}
Department: ${input.department ?? "General"}
Existing KPIs (avoid duplicating): ${input.existingKpis.join(", ") || "none"}

Respond with JSON only:
{
  "suggestions": [
    {
      "title": "KPI title",
      "description": "What it measures",
      "measurementUnit": "e.g. %, count, AED, score",
      "targetType": "numeric|percentage|boolean|text",
      "suggestedTarget": "e.g. 95% or 12 or true",
      "rationale": "why this KPI matters for this role"
    }
  ]
}`;

      const response = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const raw = (response.choices?.[0]?.message?.content as string) ?? "{}";
      try {
        const parsed = JSON.parse(raw) as { suggestions: Array<{ title: string; description: string; measurementUnit: string; targetType: string; suggestedTarget: string; rationale: string }> };
        return parsed;
      } catch {
        return { suggestions: [] };
      }
    }),

  cycleSummary: protectedProcedure
    .input(z.object({
      cycleId: z.number(),
      companyId: z.number(),
      cycleName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const [stats, leaderboard] = await Promise.all([
        getCycleSummaryStats(input.cycleId),
        getCycleLeaderboard(input.cycleId, input.companyId),
      ]);
      if (!stats) throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });

      const topPerformers = leaderboard.slice(0, 5).map(p => `${p.employeeName} (${p.finalScore?.toFixed(1)})`).join(", ");
      const flightRisks = leaderboard.filter(p => (p.finalScore ?? 5) < 2.5).map(p => p.employeeName).join(", ");

      const prompt = `You are an HR analytics expert. Generate an executive summary for the following performance cycle.

Cycle: ${input.cycleName}
Total Participants: ${stats.total}
Completed Reviews: ${stats.completed}
Average Score: ${stats.avgScore?.toFixed(2) ?? "N/A"} / 5.0
Top Performers (score ≥ 4.5): ${stats.topPerformers} employees — ${topPerformers || "none identified yet"}
Potential Flight Risks (score < 2.5): ${stats.flightRisks} employees — ${flightRisks || "none identified"}

Write a 3-4 paragraph executive summary covering: overall performance health, key highlights, areas of concern, and recommended next steps. Be specific and actionable. Return only the summary text.`;

      const response = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
      });
      const summaryText = (response.choices?.[0]?.message?.content as string) ?? "";
      return { summaryText, stats, topPerformers: leaderboard.slice(0, 10), flightRisks: leaderboard.filter(p => (p.finalScore ?? 5) < 2.5) };
    }),
});

// ─── Reports Router ────────────────────────────────────────────────────────────
const reportsRouter = router({
  leaderboard: protectedProcedure
    .input(z.object({ cycleId: z.number(), companyId: z.number() }))
    .query(({ input }) => getCycleLeaderboard(input.cycleId, input.companyId)),

  summaryStats: protectedProcedure
    .input(z.object({ cycleId: z.number() }))
    .query(({ input }) => getCycleSummaryStats(input.cycleId)),

  auditLog: protectedProcedure
    .input(z.object({ companyId: z.number(), limit: z.number().default(50) }))
    .query(({ input }) => getPerformanceAuditLog(input.companyId, input.limit)),
});

// ─── Root Performance Router ───────────────────────────────────────────────────
export const performanceRouter = router({
  templates: templatesRouter,
  kpis: kpisRouter,
  cycles: cyclesRouter,
  evaluations: evaluationsRouter,
  ai: performanceAiRouter,
  reports: reportsRouter,
});
