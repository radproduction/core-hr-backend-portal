import { and, between, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  AbsenteeismPrediction,
  AttendanceAnomalyFlag,
  AttendanceRecord,
  GeoFence,
  InsertAbsenteeismPrediction,
  InsertAttendanceAnomalyFlag,
  InsertAttendanceRecord,
  InsertGeoFence,
  InsertOvertimeRequest,
  InsertPunchImportJob,
  InsertShift,
  InsertShiftRoster,
  OvertimeRequest,
  PunchImportJob,
  Shift,
  ShiftRoster,
  absenteeismPredictions,
  attendanceAnomalyFlags,
  attendanceRecords,
  geoFences,
  overtimeRequests,
  punchImportJobs,
  shiftRosters,
  shifts,
} from "../drizzle/schema";
import { getDb } from "./db";

// ─── GEO-FENCES ──────────────────────────────────────────────────────────────
export async function listGeoFences(companyId: number): Promise<GeoFence[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(geoFences).where(eq(geoFences.companyId, companyId));
}

export async function createGeoFence(data: InsertGeoFence): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(geoFences).values(data);
  return (result as { insertId: number }).insertId;
}

export async function updateGeoFence(id: number, data: Partial<InsertGeoFence>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(geoFences).set(data).where(eq(geoFences.id, id));
}

export async function deleteGeoFence(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(geoFences).set({ isActive: false }).where(eq(geoFences.id, id));
}

/** Haversine distance in meters between two lat/lng points */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkGeoFence(
  lat: number, lng: number,
  fence: GeoFence,
): "inside" | "outside" {
  const dist = haversineDistance(lat, lng, parseFloat(fence.lat), parseFloat(fence.lng));
  return dist <= fence.radiusMeters ? "inside" : "outside";
}

// ─── SHIFTS ───────────────────────────────────────────────────────────────────
export async function listShifts(companyId: number): Promise<Shift[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shifts).where(and(eq(shifts.companyId, companyId), eq(shifts.isActive, true)));
}

export async function createShift(data: InsertShift): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(shifts).values(data);
  return (result as { insertId: number }).insertId;
}

export async function updateShift(id: number, data: Partial<InsertShift>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(shifts).set(data).where(eq(shifts.id, id));
}

export async function deleteShift(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(shifts).set({ isActive: false }).where(eq(shifts.id, id));
}

// ─── ROSTERS ─────────────────────────────────────────────────────────────────
export async function getRosterForDateRange(
  companyId: number,
  startDate: Date,
  endDate: Date,
): Promise<ShiftRoster[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shiftRosters).where(
    and(
      eq(shiftRosters.companyId, companyId),
      gte(shiftRosters.date, startDate),
      lte(shiftRosters.date, endDate),
    ),
  );
}

export async function upsertRosterEntry(data: InsertShiftRoster): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(shiftRosters).values(data).onDuplicateKeyUpdate({ set: data });
}

export async function bulkAssignRoster(entries: InsertShiftRoster[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (entries.length === 0) return;
  for (const entry of entries) {
    await db.insert(shiftRosters).values(entry).onDuplicateKeyUpdate({ set: entry });
  }
}

// ─── ATTENDANCE RECORDS ───────────────────────────────────────────────────────
export async function getAttendanceRecord(
  employeeId: number,
  date: Date,
): Promise<AttendanceRecord | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  const rows = await db.select().from(attendanceRecords).where(
    and(
      eq(attendanceRecords.employeeId, employeeId),
      gte(attendanceRecords.date, dayStart),
      lte(attendanceRecords.date, dayEnd),
    ),
  ).limit(1);
  return rows[0];
}

export async function clockIn(data: InsertAttendanceRecord): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(attendanceRecords).values(data);
  return (result as { insertId: number }).insertId;
}

export async function clockOut(
  id: number,
  clockOut: Date,
  lat: string | null,
  lng: string | null,
  workMinutes: number,
  overtimeMinutes: number,
  earlyLeaveMinutes: number,
  status: AttendanceRecord["status"],
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(attendanceRecords).set({
    clockOut,
    clockOutLat: lat,
    clockOutLng: lng,
    workMinutes,
    overtimeMinutes,
    earlyLeaveMinutes,
    status,
    updatedAt: new Date(),
  }).where(eq(attendanceRecords.id, id));
}

export async function listAttendanceRecords(
  companyId: number,
  opts: {
    employeeId?: number;
    departmentId?: number;
    startDate?: Date;
    endDate?: Date;
    status?: AttendanceRecord["status"];
    limit?: number;
    offset?: number;
  } = {},
): Promise<AttendanceRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(attendanceRecords.companyId, companyId)];
  if (opts.employeeId) conditions.push(eq(attendanceRecords.employeeId, opts.employeeId));
  if (opts.startDate) conditions.push(gte(attendanceRecords.date, opts.startDate));
  if (opts.endDate) conditions.push(lte(attendanceRecords.date, opts.endDate));
  if (opts.status) conditions.push(eq(attendanceRecords.status, opts.status));
  return db.select().from(attendanceRecords)
    .where(and(...conditions))
    .orderBy(desc(attendanceRecords.date))
    .limit(opts.limit ?? 500)
    .offset(opts.offset ?? 0);
}

export async function updateAttendanceRecord(
  id: number,
  data: Partial<InsertAttendanceRecord>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(attendanceRecords).set({ ...data, updatedAt: new Date() }).where(eq(attendanceRecords.id, id));
}

export async function getTodayAttendanceSummary(companyId: number): Promise<{
  present: number; late: number; absent: number; onLeave: number; total: number;
}> {
  const db = await getDb();
  if (!db) return { present: 0, late: 0, absent: 0, onLeave: 0, total: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const rows = await db.select({
    status: attendanceRecords.status,
    count: sql<number>`COUNT(*)`,
  }).from(attendanceRecords).where(
    and(
      eq(attendanceRecords.companyId, companyId),
      gte(attendanceRecords.date, today),
      lte(attendanceRecords.date, tomorrow),
    ),
  ).groupBy(attendanceRecords.status);
  const summary = { present: 0, late: 0, absent: 0, onLeave: 0, total: 0 };
  for (const row of rows) {
    const count = Number(row.count);
    summary.total += count;
    if (row.status === "present") summary.present += count;
    else if (row.status === "late") summary.late += count;
    else if (row.status === "absent") summary.absent += count;
    else if (row.status === "on_leave") summary.onLeave += count;
  }
  return summary;
}

// ─── OVERTIME ────────────────────────────────────────────────────────────────
export async function createOvertimeRequest(data: InsertOvertimeRequest): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(overtimeRequests).values(data);
  return (result as { insertId: number }).insertId;
}

export async function listOvertimeRequests(
  companyId: number,
  opts: { employeeId?: number; status?: OvertimeRequest["status"]; startDate?: Date; endDate?: Date } = {},
): Promise<OvertimeRequest[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(overtimeRequests.companyId, companyId)];
  if (opts.employeeId) conditions.push(eq(overtimeRequests.employeeId, opts.employeeId));
  if (opts.status) conditions.push(eq(overtimeRequests.status, opts.status));
  if (opts.startDate) conditions.push(gte(overtimeRequests.date, opts.startDate));
  if (opts.endDate) conditions.push(lte(overtimeRequests.date, opts.endDate));
  return db.select().from(overtimeRequests).where(and(...conditions)).orderBy(desc(overtimeRequests.date));
}

export async function updateOvertimeRequest(
  id: number,
  data: Partial<InsertOvertimeRequest>,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(overtimeRequests).set({ ...data, updatedAt: new Date() }).where(eq(overtimeRequests.id, id));
}

// ─── PUNCH IMPORT ─────────────────────────────────────────────────────────────
export async function createPunchImportJob(data: InsertPunchImportJob): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(punchImportJobs).values(data);
  return (result as { insertId: number }).insertId;
}

export async function updatePunchImportJob(id: number, data: Partial<InsertPunchImportJob>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(punchImportJobs).set({ ...data, updatedAt: new Date() }).where(eq(punchImportJobs.id, id));
}

export async function listPunchImportJobs(companyId: number): Promise<PunchImportJob[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(punchImportJobs)
    .where(eq(punchImportJobs.companyId, companyId))
    .orderBy(desc(punchImportJobs.createdAt))
    .limit(100);
}

// ─── ANOMALY FLAGS ────────────────────────────────────────────────────────────
export async function createAnomalyFlag(data: InsertAttendanceAnomalyFlag): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(attendanceAnomalyFlags).values(data);
  return (result as { insertId: number }).insertId;
}

export async function listAnomalyFlags(
  companyId: number,
  opts: { status?: AttendanceAnomalyFlag["status"]; employeeId?: number } = {},
): Promise<AttendanceAnomalyFlag[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(attendanceAnomalyFlags.companyId, companyId)];
  if (opts.status) conditions.push(eq(attendanceAnomalyFlags.status, opts.status));
  if (opts.employeeId) conditions.push(eq(attendanceAnomalyFlags.employeeId, opts.employeeId));
  return db.select().from(attendanceAnomalyFlags)
    .where(and(...conditions))
    .orderBy(desc(attendanceAnomalyFlags.createdAt));
}

export async function reviewAnomalyFlag(
  id: number,
  status: AttendanceAnomalyFlag["status"],
  reviewedBy: number,
  reviewNotes?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(attendanceAnomalyFlags).set({
    status,
    reviewedBy,
    reviewedAt: new Date(),
    reviewNotes: reviewNotes ?? null,
    updatedAt: new Date(),
  }).where(eq(attendanceAnomalyFlags.id, id));
}

// ─── ABSENTEEISM PREDICTIONS ──────────────────────────────────────────────────
export async function upsertAbsenteeismPrediction(data: InsertAbsenteeismPrediction): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(absenteeismPredictions).values(data);
}

export async function listAbsenteeismPredictions(
  companyId: number,
  opts: { riskLevel?: AbsenteeismPrediction["riskLevel"] } = {},
): Promise<AbsenteeismPrediction[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(absenteeismPredictions.companyId, companyId)];
  if (opts.riskLevel) conditions.push(eq(absenteeismPredictions.riskLevel, opts.riskLevel));
  return db.select().from(absenteeismPredictions)
    .where(and(...conditions))
    .orderBy(desc(absenteeismPredictions.riskScore));
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────
export async function getAttendanceReportData(
  companyId: number,
  startDate: Date,
  endDate: Date,
  opts: { employeeId?: number; departmentId?: number } = {},
): Promise<AttendanceRecord[]> {
  return listAttendanceRecords(companyId, { startDate, endDate, ...opts, limit: 10000 });
}

export async function getAttendanceStatsByStatus(
  companyId: number,
  startDate: Date,
  endDate: Date,
): Promise<{ status: string; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    status: attendanceRecords.status,
    count: sql<number>`COUNT(*)`,
  }).from(attendanceRecords).where(
    and(
      eq(attendanceRecords.companyId, companyId),
      gte(attendanceRecords.date, startDate),
      lte(attendanceRecords.date, endDate),
    ),
  ).groupBy(attendanceRecords.status);
  return rows.map(r => ({ status: r.status ?? "unknown", count: Number(r.count) }));
}

export async function getTopLateEmployees(
  companyId: number,
  startDate: Date,
  endDate: Date,
  limit = 10,
): Promise<{ employeeId: number; lateCount: number; totalLateMinutes: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    employeeId: attendanceRecords.employeeId,
    lateCount: sql<number>`COUNT(*)`,
    totalLateMinutes: sql<number>`SUM(lateMinutes)`,
  }).from(attendanceRecords).where(
    and(
      eq(attendanceRecords.companyId, companyId),
      eq(attendanceRecords.status, "late"),
      gte(attendanceRecords.date, startDate),
      lte(attendanceRecords.date, endDate),
    ),
  ).groupBy(attendanceRecords.employeeId)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);
  return rows.map(r => ({
    employeeId: r.employeeId,
    lateCount: Number(r.lateCount),
    totalLateMinutes: Number(r.totalLateMinutes ?? 0),
  }));
}

export async function getGeoFenceViolations(
  companyId: number,
  startDate: Date,
  endDate: Date,
): Promise<AttendanceRecord[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attendanceRecords).where(
    and(
      eq(attendanceRecords.companyId, companyId),
      eq(attendanceRecords.geoFenceStatus, "outside"),
      gte(attendanceRecords.date, startDate),
      lte(attendanceRecords.date, endDate),
    ),
  ).orderBy(desc(attendanceRecords.date));
}

export async function getOvertimeSummary(
  companyId: number,
  startDate: Date,
  endDate: Date,
): Promise<{ employeeId: number; totalOvertimeMinutes: number; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    employeeId: attendanceRecords.employeeId,
    totalOvertimeMinutes: sql<number>`SUM(overtimeMinutes)`,
    count: sql<number>`COUNT(*)`,
  }).from(attendanceRecords).where(
    and(
      eq(attendanceRecords.companyId, companyId),
      gte(attendanceRecords.date, startDate),
      lte(attendanceRecords.date, endDate),
      sql`overtimeMinutes > 0`,
    ),
  ).groupBy(attendanceRecords.employeeId)
    .orderBy(sql`SUM(overtimeMinutes) DESC`);
  return rows.map(r => ({
    employeeId: r.employeeId,
    totalOvertimeMinutes: Number(r.totalOvertimeMinutes ?? 0),
    count: Number(r.count),
  }));
}
