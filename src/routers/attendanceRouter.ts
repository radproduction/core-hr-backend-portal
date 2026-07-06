import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  bulkAssignRoster,
  checkGeoFence,
  clockIn,
  clockOut,
  createAnomalyFlag,
  createGeoFence,
  createOvertimeRequest,
  createPunchImportJob,
  deleteGeoFence,
  deleteShift,
  getAttendanceRecord,
  getAttendanceReportData,
  getAttendanceStatsByStatus,
  getGeoFenceViolations,
  getOvertimeSummary,
  getTodayAttendanceSummary,
  getTopLateEmployees,
  listAnomalyFlags,
  listAttendanceRecords,
  listGeoFences,
  listOvertimeRequests,
  listPunchImportJobs,
  listShifts,
  reviewAnomalyFlag,
  updateAttendanceRecord,
  updateGeoFence,
  updateOvertimeRequest,
  updatePunchImportJob,
  updateShift,
  upsertRosterEntry,
  listAbsenteeismPredictions,
  getRosterForDateRange,
  createShift,
} from "../attendanceDb";
import { createAuditLog } from "../mongoDb";
import { notifyOwner } from "../_core/notification";
import { runAndPersistAnomalyDetection, runAndPersistAbsenteeismPredictions } from "../ai/attendanceAI";

// ─── GEO-FENCES ──────────────────────────────────────────────────────────────
const geoFencesRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listGeoFences(input.companyId)),

  create: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      locationId: z.number().optional(),
      name: z.string().min(1),
      lat: z.string(),
      lng: z.string(),
      radiusMeters: z.number().min(10).max(10000).default(200),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await createGeoFence(input);
      await createAuditLog({
        companyId: input.companyId,
        actorUserId: ctx.user.id,
        action: "create",
        module: "attendance",
        entityType: "geoFence",
        entityId: id,
        after: input,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      lat: z.string().optional(),
      lng: z.string().optional(),
      radiusMeters: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateGeoFence(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteGeoFence(input.id);
      return { success: true };
    }),
});

// ─── SHIFTS ───────────────────────────────────────────────────────────────────
const shiftsRouter = router({
  list: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listShifts(input.companyId)),

  create: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      name: z.string().min(1),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      graceMinutes: z.number().min(0).default(0),
      breakMinutes: z.number().min(0).default(0),
      isFlexible: z.boolean().default(false),
      isOvernight: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await createShift(input);
      await createAuditLog({
        companyId: input.companyId,
        actorUserId: ctx.user.id,
        action: "create",
        module: "attendance",
        entityType: "shift",
        entityId: id,
        after: input,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      graceMinutes: z.number().optional(),
      breakMinutes: z.number().optional(),
      isFlexible: z.boolean().optional(),
      isOvernight: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateShift(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteShift(input.id);
      return { success: true };
    }),
});

// ─── ROSTERS ─────────────────────────────────────────────────────────────────
const rostersRouter = router({
  getRange: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(({ input }) => getRosterForDateRange(input.companyId, input.startDate, input.endDate)),

  assign: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number(),
      shiftId: z.number().optional(),
      date: z.date(),
      isRestDay: z.boolean().default(false),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await upsertRosterEntry(input);
      return { success: true };
    }),

  bulkAssign: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeIds: z.array(z.number()),
      shiftId: z.number().optional(),
      startDate: z.date(),
      endDate: z.date(),
      excludeWeekends: z.boolean().default(true),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const entries = [];
      const current = new Date(input.startDate);
      while (current <= input.endDate) {
        const dayOfWeek = current.getDay();
        if (!input.excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
          for (const employeeId of input.employeeIds) {
            entries.push({
              companyId: input.companyId,
              employeeId,
              shiftId: input.shiftId,
              date: new Date(current),
              isRestDay: false,
              notes: input.notes,
              createdBy: undefined,
            });
          }
        }
        current.setDate(current.getDate() + 1);
      }
      await bulkAssignRoster(entries);
      return { count: entries.length };
    }),
});

// ─── CLOCK IN/OUT ─────────────────────────────────────────────────────────────
const clockRouter = router({
  in: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number(),
      lat: z.string().optional(),
      lng: z.string().optional(),
      shiftId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Check for existing record today
      const existing = await getAttendanceRecord(input.employeeId, today);
      if (existing?.clockIn) {
        throw new TRPCError({ code: "CONFLICT", message: "Already clocked in today" });
      }

      // Geo-fence validation
      let geoFenceStatus: "inside" | "outside" | "unknown" = "unknown";
      let matchedFenceId: number | undefined;
      if (input.lat && input.lng) {
        const fences = await listGeoFences(input.companyId);
        const activeFences = fences.filter(f => f.isActive);
        if (activeFences.length > 0) {
          const lat = parseFloat(input.lat);
          const lng = parseFloat(input.lng);
          for (const fence of activeFences) {
            const status = checkGeoFence(lat, lng, fence);
            if (status === "inside") {
              geoFenceStatus = "inside";
              matchedFenceId = fence.id;
              break;
            }
          }
          if (geoFenceStatus !== "inside") geoFenceStatus = "outside";
        }
      }

      const id = await clockIn({
        companyId: input.companyId,
        employeeId: input.employeeId,
        date: today,
        clockIn: now,
        clockInLat: input.lat ?? null,
        clockInLng: input.lng ?? null,
        geoFenceId: matchedFenceId,
        geoFenceStatus,
        shiftId: input.shiftId,
        status: "present",
        source: "web",
        notes: input.notes,
      });

      // Notify admin of clock-in
      await notifyOwner({
        title: "Employee Clock-In",
        content: `Employee #${input.employeeId} clocked in at ${now.toLocaleTimeString()}${geoFenceStatus === "outside" ? " ⚠️ Outside geo-fence" : ""}`,
      }).catch(() => {});

      return { id, geoFenceStatus, clockIn: now };
    }),

  out: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number(),
      lat: z.string().optional(),
      lng: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const record = await getAttendanceRecord(input.employeeId, today);
      if (!record || !record.clockIn) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No clock-in record found for today" });
      }
      if (record.clockOut) {
        throw new TRPCError({ code: "CONFLICT", message: "Already clocked out today" });
      }

      const workMs = now.getTime() - record.clockIn.getTime();
      const workMinutes = Math.floor(workMs / 60000);
      const standardMinutes = 8 * 60; // default 8h shift
      const overtimeMinutes = Math.max(0, workMinutes - standardMinutes);
      const earlyLeaveMinutes = workMinutes < standardMinutes ? standardMinutes - workMinutes : 0;

      let status: "present" | "late" | "early_leave" | "half_day" = "present";
      if (earlyLeaveMinutes > 60) status = "early_leave";
      if (workMinutes < standardMinutes / 2) status = "half_day";
      if (record.lateMinutes && record.lateMinutes > 0) status = "late";

      await clockOut(
        record.id,
        now,
        input.lat ?? null,
        input.lng ?? null,
        workMinutes,
        overtimeMinutes,
        earlyLeaveMinutes,
        status,
      );

      // Auto-create overtime request if significant overtime
      if (overtimeMinutes >= 30) {
        await createOvertimeRequest({
          companyId: input.companyId,
          employeeId: input.employeeId,
          attendanceRecordId: record.id,
          date: today,
          requestedMinutes: overtimeMinutes,
          reason: "Auto-detected from clock records",
          status: "pending",
        });
      }

      await notifyOwner({
        title: "Employee Clock-Out",
        content: `Employee #${input.employeeId} clocked out at ${now.toLocaleTimeString()}. Work: ${Math.floor(workMinutes / 60)}h ${workMinutes % 60}m${overtimeMinutes > 0 ? `, OT: ${overtimeMinutes}m` : ""}`,
      }).catch(() => {});

      return { workMinutes, overtimeMinutes, earlyLeaveMinutes, status, clockOut: now };
    }),

  todaySummary: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => getTodayAttendanceSummary(input.companyId)),
});

// ─── ATTENDANCE RECORDS ───────────────────────────────────────────────────────
const recordsRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      status: z.enum(["present", "absent", "late", "early_leave", "half_day", "on_leave", "holiday", "weekend", "overtime"]).optional(),
      limit: z.number().max(1000).default(200),
      offset: z.number().default(0),
    }))
    .query(({ input }) => listAttendanceRecords(input.companyId, input)),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      clockIn: z.date().optional(),
      clockOut: z.date().optional(),
      status: z.enum(["present", "absent", "late", "early_leave", "half_day", "on_leave", "holiday", "weekend", "overtime"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateAttendanceRecord(id, { ...data, correctedBy: ctx.user.id });
      return { success: true };
    }),
});

// ─── OVERTIME ────────────────────────────────────────────────────────────────
const overtimeRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number().optional(),
      status: z.enum(["pending", "approved", "rejected", "auto_approved"]).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(({ input }) => listOvertimeRequests(input.companyId, input)),

  request: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      employeeId: z.number(),
      date: z.date(),
      requestedMinutes: z.number().min(30),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const id = await createOvertimeRequest({ ...input, status: "pending" });
      return { id };
    }),

  approve: protectedProcedure
    .input(z.object({
      id: z.number(),
      approvedMinutes: z.number(),
      approvedBy: z.number(),
    }))
    .mutation(async ({ input }) => {
      await updateOvertimeRequest(input.id, {
        status: "approved",
        approvedMinutes: input.approvedMinutes,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
      });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number(), rejectedBy: z.number() }))
    .mutation(async ({ input }) => {
      await updateOvertimeRequest(input.id, { status: "rejected", approvedBy: input.rejectedBy });
      return { success: true };
    }),
});

// ─── PUNCH IMPORT ─────────────────────────────────────────────────────────────
const punchImportRouter = router({
  jobs: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listPunchImportJobs(input.companyId)),

  upload: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      fileName: z.string(),
      source: z.enum(["biometric", "csv_import", "manual", "web", "mobile"]).default("csv_import"),
      rows: z.array(z.object({
        employeeId: z.number(),
        date: z.string(), // ISO date string
        clockIn: z.string().optional(),
        clockOut: z.string().optional(),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const jobId = await createPunchImportJob({
        companyId: input.companyId,
        fileName: input.fileName,
        source: input.source as "biometric" | "csv",
        totalRows: input.rows.length,
        successRows: 0,
        errorRows: 0,
        uploadedBy: ctx.user.id,
      });

      const errors: { row: number; error: string }[] = [];
      let successCount = 0;

      for (let i = 0; i < input.rows.length; i++) {
        const row = input.rows[i];
        try {
          const date = new Date(row.date);
          if (isNaN(date.getTime())) throw new Error("Invalid date");

          const existing = await getAttendanceRecord(row.employeeId, date);
          if (existing) {
            // Update existing record
            const updates: Record<string, unknown> = { source: input.source };
            if (row.clockIn) updates.clockIn = new Date(row.clockIn);
            if (row.clockOut) updates.clockOut = new Date(row.clockOut);
            if (row.clockIn && row.clockOut) {
              const workMs = new Date(row.clockOut).getTime() - new Date(row.clockIn).getTime();
              updates.workMinutes = Math.floor(workMs / 60000);
            }
            await updateAttendanceRecord(existing.id, updates as any);
          } else {
            const clockInDate = row.clockIn ? new Date(row.clockIn) : undefined;
            const clockOutDate = row.clockOut ? new Date(row.clockOut) : undefined;
            let workMinutes = 0;
            if (clockInDate && clockOutDate) {
              workMinutes = Math.floor((clockOutDate.getTime() - clockInDate.getTime()) / 60000);
            }
            await clockIn({
              companyId: input.companyId,
              employeeId: row.employeeId,
              date,
              clockIn: clockInDate,
              clockOut: clockOutDate,
              workMinutes,
              status: clockInDate ? "present" : "absent",
              source: "csv_import",
              notes: row.notes,
            });
          }
          successCount++;
        } catch (err) {
          errors.push({ row: i + 1, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      await updatePunchImportJob(jobId, {
        status: errors.length === input.rows.length ? "failed" : "completed",
        successRows: successCount,
        errorRows: errors.length,
        errorReport: errors.length > 0 ? errors : null,
      });

      return { jobId, successCount, errorCount: errors.length, errors };
    }),
});

// ─── ANOMALY FLAGS ────────────────────────────────────────────────────────────
const anomalyRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      status: z.enum(["pending_review", "reviewed_ok", "reviewed_action", "dismissed"]).optional(),
      employeeId: z.number().optional(),
    }))
    .query(({ input }) => listAnomalyFlags(input.companyId, input)),

  review: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["reviewed_ok", "reviewed_action", "dismissed"]),
      reviewNotes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await reviewAnomalyFlag(input.id, input.status, ctx.user.id, input.reviewNotes);
      return { success: true };
    }),
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────
const reportsRouter = router({
  daily: protectedProcedure
    .input(z.object({ companyId: z.number(), date: z.date() }))
    .query(({ input }) => {
      const end = new Date(input.date);
      end.setHours(23, 59, 59, 999);
      return getAttendanceReportData(input.companyId, input.date, end);
    }),

  monthly: protectedProcedure
    .input(z.object({ companyId: z.number(), year: z.number(), month: z.number(), employeeId: z.number().optional() }))
    .query(({ input }) => {
      const start = new Date(input.year, input.month - 1, 1);
      const end = new Date(input.year, input.month, 0, 23, 59, 59);
      return getAttendanceReportData(input.companyId, start, end, { employeeId: input.employeeId });
    }),

  dateRange: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      startDate: z.date(),
      endDate: z.date(),
      employeeId: z.number().optional(),
    }))
    .query(({ input }) => getAttendanceReportData(input.companyId, input.startDate, input.endDate, { employeeId: input.employeeId })),

  statusSummary: protectedProcedure
    .input(z.object({ companyId: z.number(), startDate: z.date(), endDate: z.date() }))
    .query(({ input }) => getAttendanceStatsByStatus(input.companyId, input.startDate, input.endDate)),

  topLate: protectedProcedure
    .input(z.object({ companyId: z.number(), startDate: z.date(), endDate: z.date(), limit: z.number().default(10) }))
    .query(({ input }) => getTopLateEmployees(input.companyId, input.startDate, input.endDate, input.limit)),

  geoFenceViolations: protectedProcedure
    .input(z.object({ companyId: z.number(), startDate: z.date(), endDate: z.date() }))
    .query(({ input }) => getGeoFenceViolations(input.companyId, input.startDate, input.endDate)),

  overtimeSummary: protectedProcedure
    .input(z.object({ companyId: z.number(), startDate: z.date(), endDate: z.date() }))
    .query(({ input }) => getOvertimeSummary(input.companyId, input.startDate, input.endDate)),

  punchImportHistory: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(({ input }) => listPunchImportJobs(input.companyId)),

  anomalyFlags: protectedProcedure
    .input(z.object({ companyId: z.number(), status: z.enum(["pending_review", "reviewed_ok", "reviewed_action", "dismissed"]).optional() }))
    .query(({ input }) => listAnomalyFlags(input.companyId, { status: input.status })),

  absenteeismPredictions: protectedProcedure
    .input(z.object({ companyId: z.number(), riskLevel: z.enum(["low", "medium", "high"]).optional() }))
    .query(({ input }) => listAbsenteeismPredictions(input.companyId, { riskLevel: input.riskLevel })),
});

// ─── AI ─────────────────────────────────────────────────────────────────────
const attendanceAiRouter = router({
  detectAnomalies: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .mutation(async ({ input }) => {
      return runAndPersistAnomalyDetection(input.companyId, input.startDate, input.endDate);
    }),

  predictAbsenteeism: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      lookbackDays: z.number().min(30).max(365).default(90),
    }))
    .mutation(async ({ input }) => {
      return runAndPersistAbsenteeismPredictions(input.companyId, input.lookbackDays);
    }),

  anomalyFlags: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      status: z.enum(["pending_review", "reviewed_ok", "reviewed_action", "dismissed"]).optional(),
    }))
    .query(({ input }) => listAnomalyFlags(input.companyId, { status: input.status })),

  absenteeismPredictions: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      riskLevel: z.enum(["low", "medium", "high"]).optional(),
    }))
    .query(({ input }) => listAbsenteeismPredictions(input.companyId, { riskLevel: input.riskLevel })),
});

// ─── MAIN ATTENDANCE ROUTER ───────────────────────────────────────────────────
export const attendanceRouter = router({
  geoFences: geoFencesRouter,
  shifts: shiftsRouter,
  rosters: rostersRouter,
  clock: clockRouter,
  records: recordsRouter,
  overtime: overtimeRouter,
  punchImport: punchImportRouter,
  anomaly: anomalyRouter,
  reports: reportsRouter,
  ai: attendanceAiRouter,
});
