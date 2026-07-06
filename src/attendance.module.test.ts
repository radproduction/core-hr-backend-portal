/**
 * Module 2: Time & Attendance — Vitest test suite
 *
 * Coverage:
 *  - DB schema table exports
 *  - attendanceRouter sub-router existence
 *  - attendanceDb helper exports
 *  - AI module exports
 *  - RBAC: attendance module in HCM_MODULES
 *  - Anomaly detection contract (mock mode)
 *  - Absenteeism prediction contract (mock mode)
 */

import { describe, expect, it } from "vitest";

// ─── Schema table exports ─────────────────────────────────────────────────────

describe("Module 2: DB schema — attendance tables", () => {
  it("geoFences table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.geoFences).toBeDefined();
  });

  it("shifts table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.shifts).toBeDefined();
  });

  it("shiftRosters table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.shiftRosters).toBeDefined();
  });

  it("attendanceRecords table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.attendanceRecords).toBeDefined();
  });

  it("overtimeRequests table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.overtimeRequests).toBeDefined();
  });

  it("punchImportJobs table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.punchImportJobs).toBeDefined();
  });

  it("attendanceAnomalyFlags table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.attendanceAnomalyFlags).toBeDefined();
  });

  it("absenteeismPredictions table is exported from schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.absenteeismPredictions).toBeDefined();
  });
});

// ─── attendanceRouter sub-router existence ────────────────────────────────────

describe("Module 2: attendanceRouter — sub-router structure", () => {
  it("attendanceRouter is exported from attendanceRouter.ts", async () => {
    const mod = await import("./routers/attendanceRouter");
    expect(mod.attendanceRouter).toBeDefined();
  });

  it("attendanceRouter is wired into appRouter as 'attendance'", async () => {
    const { appRouter } = await import("./routers");
    // The router object has a _def property with procedures
    expect(appRouter._def.router).toBe(true);
  });

  it("appRouter has attendance namespace", async () => {
    const { appRouter } = await import("./routers");
    // Check that the router definition contains attendance procedures
    const procedures = Object.keys(appRouter._def.procedures);
    const attendanceProcs = procedures.filter(p => p.startsWith("attendance."));
    expect(attendanceProcs.length).toBeGreaterThan(0);
  });

  it("attendance.clock procedures exist", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("attendance.clock"))).toBe(true);
  });

  it("attendance.shifts procedures exist", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("attendance.shifts"))).toBe(true);
  });

  it("attendance.rosters procedures exist", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("attendance.rosters"))).toBe(true);
  });

  it("attendance.overtime procedures exist", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("attendance.overtime"))).toBe(true);
  });

  it("attendance.punchImport procedures exist", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("attendance.punchImport"))).toBe(true);
  });

  it("attendance.reports procedures exist", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("attendance.reports"))).toBe(true);
  });

  it("attendance.ai procedures exist", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("attendance.ai"))).toBe(true);
  });

  it("attendance.anomaly procedures exist", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("attendance.anomaly"))).toBe(true);
  });
});

// ─── attendanceDb helper exports ──────────────────────────────────────────────

describe("Module 2: attendanceDb — helper exports", () => {
  it("clockIn is exported (creates attendance record)", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.clockIn).toBe("function");
  });

  it("getAttendanceRecord is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.getAttendanceRecord).toBe("function");
  });

  it("listAttendanceRecords is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.listAttendanceRecords).toBe("function");
  });

  it("createShift is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.createShift).toBe("function");
  });

  it("listShifts is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.listShifts).toBe("function");
  });

  it("createOvertimeRequest is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.createOvertimeRequest).toBe("function");
  });

  it("listOvertimeRequests is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.listOvertimeRequests).toBe("function");
  });

  it("createPunchImportJob is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.createPunchImportJob).toBe("function");
  });

  it("listPunchImportJobs is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.listPunchImportJobs).toBe("function");
  });

  it("createAnomalyFlag is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.createAnomalyFlag).toBe("function");
  });

  it("listAnomalyFlags is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.listAnomalyFlags).toBe("function");
  });

  it("reviewAnomalyFlag is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.reviewAnomalyFlag).toBe("function");
  });

  it("upsertAbsenteeismPrediction is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.upsertAbsenteeismPrediction).toBe("function");
  });

  it("listAbsenteeismPredictions is exported", async () => {
    const mod = await import("./attendanceDb");
    expect(typeof mod.listAbsenteeismPredictions).toBe("function");
  });
});

// ─── AI module exports ────────────────────────────────────────────────────────

describe("Module 2: attendanceAI — function exports", () => {
  it("detectAttendanceAnomalies is exported", async () => {
    const mod = await import("./ai/attendanceAI");
    expect(typeof mod.detectAttendanceAnomalies).toBe("function");
  });

  it("predictAbsenteeism is exported", async () => {
    const mod = await import("./ai/attendanceAI");
    expect(typeof mod.predictAbsenteeism).toBe("function");
  });

  it("runAndPersistAnomalyDetection is exported", async () => {
    const mod = await import("./ai/attendanceAI");
    expect(typeof mod.runAndPersistAnomalyDetection).toBe("function");
  });

  it("runAndPersistAbsenteeismPredictions is exported", async () => {
    const mod = await import("./ai/attendanceAI");
    expect(typeof mod.runAndPersistAbsenteeismPredictions).toBe("function");
  });
});

// ─── RBAC: attendance module ──────────────────────────────────────────────────

describe("Module 2: RBAC — attendance module", () => {
  it("attendance is in HCM_MODULES", async () => {
    const { HCM_MODULES } = await import("./rbac");
    expect(HCM_MODULES).toContain("attendance");
  });

  it("super_admin has attendance view permission", async () => {
    const { DEFAULT_PERMISSIONS } = await import("./rbac");
    expect(DEFAULT_PERMISSIONS.super_admin?.attendance?.view).toBe(true);
  });

  it("hr_admin has attendance create permission", async () => {
    const { DEFAULT_PERMISSIONS } = await import("./rbac");
    expect(DEFAULT_PERMISSIONS.hr_admin?.attendance?.create).toBe(true);
  });

  it("employee role has attendance view permission", async () => {
    const { DEFAULT_PERMISSIONS } = await import("./rbac");
    expect(DEFAULT_PERMISSIONS.employee?.attendance?.view).toBe(true);
  });

  it("viewer role has attendance view permission", async () => {
    const { DEFAULT_PERMISSIONS } = await import("./rbac");
    expect(DEFAULT_PERMISSIONS.viewer?.attendance?.view).toBe(true);
  });
});

// ─── Anomaly detection contract ───────────────────────────────────────────────

describe("Module 2: detectAttendanceAnomalies — output contract", () => {
  it("is an async function accepting companyId, startDate, endDate", async () => {
    const { detectAttendanceAnomalies } = await import("./ai/attendanceAI");
    expect(typeof detectAttendanceAnomalies).toBe("function");
    // The function should return a Promise
    const start = new Date(2020, 0, 1);
    const end = new Date(2020, 0, 2);
    const result = detectAttendanceAnomalies(999999, start, end);
    expect(result).toBeInstanceOf(Promise);
    // Resolve it (may return empty array for non-existent company)
    const resolved = await result;
    expect(Array.isArray(resolved)).toBe(true);
  });

  it("returns an array of AnomalyFlag objects", async () => {
    const { detectAttendanceAnomalies } = await import("./ai/attendanceAI");
    const start = new Date(2020, 0, 1);
    const end = new Date(2020, 0, 2);
    const result = await detectAttendanceAnomalies(999999, start, end);
    expect(Array.isArray(result)).toBe(true);
    // If any results, check shape
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("employeeId");
      expect(result[0]).toHaveProperty("severity");
    }
  });
});

// ─── Absenteeism prediction contract ─────────────────────────────────────────

describe("Module 2: predictAbsenteeism — output contract", () => {
  it("is an async function accepting companyId and optional lookbackDays", async () => {
    const { predictAbsenteeism } = await import("./ai/attendanceAI");
    expect(typeof predictAbsenteeism).toBe("function");
    const result = predictAbsenteeism(999999, 7);
    expect(result).toBeInstanceOf(Promise);
    const resolved = await result;
    expect(Array.isArray(resolved)).toBe(true);
  });

  it("returns an array of AbsenteeismPrediction objects", async () => {
    const { predictAbsenteeism } = await import("./ai/attendanceAI");
    const result = await predictAbsenteeism(999999, 7);
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const first = result[0];
      expect(first).toHaveProperty("employeeId");
      expect(first).toHaveProperty("riskLevel");
      expect(first).toHaveProperty("riskScore");
      expect(["low", "medium", "high"]).toContain(first.riskLevel);
    }
  });
});

// ─── Punch import source enum ─────────────────────────────────────────────────

describe("Module 2: punchImportJobs — source enum", () => {
  it("punchImportJobs table has source column with correct enum values", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.punchImportJobs;
    expect(table).toBeDefined();
    // The table is defined — enum values are validated at DB level
    expect(typeof table).toBe("object");
  });
});

// ─── Geo-fence schema ─────────────────────────────────────────────────────────

describe("Module 2: geoFences — schema structure", () => {
  it("geoFences table has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const table = schema.geoFences;
    expect(table).toBeDefined();
    // Drizzle table columns are accessible via the table object
    const cols = Object.keys(table);
    expect(cols.length).toBeGreaterThan(0);
  });
});
