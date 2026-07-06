/**
 * leaveDb.ts — DB query helpers for Module 3: Leave Management
 *
 * All helpers return raw Drizzle rows. Business logic lives in the router.
 */
import { and, between, desc, eq, gte, lte, or } from "drizzle-orm";
import { getDb } from "./db";
import {
  compensatoryLeaves,
  leaveAccrualLogs,
  leaveApprovals,
  leaveBalances,
  leaveCarryForwardLogs,
  leavePolicies,
  leaveRequests,
  leaveTypes,
  type CompensatoryLeave,
  type InsertCompensatoryLeave,
  type InsertLeaveAccrualLog,
  type InsertLeaveApproval,
  type InsertLeaveBalance,
  type InsertLeaveCarryForwardLog,
  type InsertLeavePolicy,
  type InsertLeaveRequest,
  type InsertLeaveType,
  type LeaveAccrualLog,
  type LeaveApproval,
  type LeaveBalance,
  type LeaveCarryForwardLog,
  type LeavePolicy,
  type LeaveRequest,
  type LeaveType,
} from "../drizzle/schema";

// ─── LEAVE TYPES ──────────────────────────────────────────────────────────────

export async function listLeaveTypes(companyId: number): Promise<LeaveType[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leaveTypes).where(eq(leaveTypes.companyId, companyId)).orderBy(leaveTypes.name);
}

export async function getLeaveType(id: number): Promise<LeaveType | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(leaveTypes).where(eq(leaveTypes.id, id)).limit(1);
  return rows[0];
}

export async function createLeaveType(data: InsertLeaveType): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(leaveTypes).values(data);
  return (result as { insertId: number }).insertId;
}

export async function updateLeaveType(id: number, data: Partial<InsertLeaveType>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(leaveTypes).set(data).where(eq(leaveTypes.id, id));
}

export async function deleteLeaveType(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(leaveTypes).set({ isActive: false }).where(eq(leaveTypes.id, id));
}

// ─── LEAVE POLICIES ───────────────────────────────────────────────────────────

export async function listLeavePolicies(companyId: number): Promise<LeavePolicy[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leavePolicies).where(eq(leavePolicies.companyId, companyId)).orderBy(leavePolicies.name);
}

export async function getLeavePoliciesForType(companyId: number, leaveTypeId: number): Promise<LeavePolicy[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leavePolicies).where(
    and(eq(leavePolicies.companyId, companyId), eq(leavePolicies.leaveTypeId, leaveTypeId))
  );
}

export async function createLeavePolicy(data: InsertLeavePolicy): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(leavePolicies).values(data);
  return (result as { insertId: number }).insertId;
}

export async function updateLeavePolicy(id: number, data: Partial<InsertLeavePolicy>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(leavePolicies).set(data).where(eq(leavePolicies.id, id));
}

export async function deleteLeavePolicy(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(leavePolicies).set({ isActive: false }).where(eq(leavePolicies.id, id));
}

// ─── LEAVE BALANCES ───────────────────────────────────────────────────────────

export async function getLeaveBalance(
  employeeId: number,
  leaveTypeId: number,
  year: number
): Promise<LeaveBalance | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(leaveBalances).where(
    and(
      eq(leaveBalances.employeeId, employeeId),
      eq(leaveBalances.leaveTypeId, leaveTypeId),
      eq(leaveBalances.year, year)
    )
  ).limit(1);
  return rows[0];
}

export async function listLeaveBalances(
  companyId: number,
  year: number,
  employeeId?: number
): Promise<LeaveBalance[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(leaveBalances.companyId, companyId), eq(leaveBalances.year, year)];
  if (employeeId) conditions.push(eq(leaveBalances.employeeId, employeeId));
  return db.select().from(leaveBalances).where(and(...conditions));
}

export async function upsertLeaveBalance(data: InsertLeaveBalance): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getLeaveBalance(data.employeeId, data.leaveTypeId, data.year);
  if (existing) {
    await db.update(leaveBalances).set(data).where(eq(leaveBalances.id, existing.id));
  } else {
    await db.insert(leaveBalances).values(data);
  }
}

export async function adjustLeaveBalance(
  employeeId: number,
  leaveTypeId: number,
  year: number,
  delta: { used?: number; pending?: number; balance?: number; carryForward?: number; compensatory?: number }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const bal = await getLeaveBalance(employeeId, leaveTypeId, year);
  if (!bal) return;
  const updates: Partial<InsertLeaveBalance> = {};
  if (delta.used !== undefined) updates.used = String(parseFloat(bal.used ?? "0") + delta.used) as unknown as typeof bal.used;
  if (delta.pending !== undefined) updates.pending = String(parseFloat(bal.pending ?? "0") + delta.pending) as unknown as typeof bal.pending;
  if (delta.balance !== undefined) updates.balance = String(parseFloat(bal.balance ?? "0") + delta.balance) as unknown as typeof bal.balance;
  if (delta.carryForward !== undefined) updates.carryForward = String(parseFloat(bal.carryForward ?? "0") + delta.carryForward) as unknown as typeof bal.carryForward;
  if (delta.compensatory !== undefined) updates.compensatory = String(parseFloat(bal.compensatory ?? "0") + delta.compensatory) as unknown as typeof bal.compensatory;
  await db.update(leaveBalances).set(updates).where(eq(leaveBalances.id, bal.id));
}

// ─── LEAVE REQUESTS ───────────────────────────────────────────────────────────

export async function createLeaveRequest(data: InsertLeaveRequest): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(leaveRequests).values(data);
  return (result as { insertId: number }).insertId;
}

export async function getLeaveRequest(id: number): Promise<LeaveRequest | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
  return rows[0];
}

export async function listLeaveRequests(
  companyId: number,
  opts: {
    employeeId?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    leaveTypeId?: number;
    limit?: number;
  } = {}
): Promise<LeaveRequest[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(leaveRequests.companyId, companyId)];
  if (opts.employeeId) conditions.push(eq(leaveRequests.employeeId, opts.employeeId));
  if (opts.status) conditions.push(eq(leaveRequests.status, opts.status as LeaveRequest["status"]));
  if (opts.leaveTypeId) conditions.push(eq(leaveRequests.leaveTypeId, opts.leaveTypeId));
  if (opts.startDate) conditions.push(gte(leaveRequests.startDate, opts.startDate));
  if (opts.endDate) conditions.push(lte(leaveRequests.endDate, opts.endDate));
  return db.select().from(leaveRequests)
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.appliedAt))
    .limit(opts.limit ?? 1000);
}

export async function updateLeaveRequest(id: number, data: Partial<InsertLeaveRequest>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(leaveRequests).set(data).where(eq(leaveRequests.id, id));
}

export async function getOverlappingLeaveRequests(
  companyId: number,
  employeeId: number,
  startDate: Date,
  endDate: Date,
  excludeId?: number
): Promise<LeaveRequest[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(leaveRequests).where(
    and(
      eq(leaveRequests.companyId, companyId),
      eq(leaveRequests.employeeId, employeeId),
      or(
        between(leaveRequests.startDate, startDate, endDate),
        between(leaveRequests.endDate, startDate, endDate)
      )
    )
  );
  return excludeId ? rows.filter((r: LeaveRequest) => r.id !== excludeId) : rows;
}

// ─── LEAVE APPROVALS ──────────────────────────────────────────────────────────

export async function createLeaveApproval(data: InsertLeaveApproval): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(leaveApprovals).values(data);
  return (result as { insertId: number }).insertId;
}

export async function listLeaveApprovals(leaveRequestId: number): Promise<LeaveApproval[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leaveApprovals)
    .where(eq(leaveApprovals.leaveRequestId, leaveRequestId))
    .orderBy(leaveApprovals.step);
}

export async function getPendingApprovalsForApprover(approverId: number): Promise<LeaveApproval[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leaveApprovals).where(
    and(eq(leaveApprovals.approverId, approverId), eq(leaveApprovals.status, "pending"))
  ).orderBy(desc(leaveApprovals.createdAt));
}

export async function updateLeaveApproval(id: number, data: Partial<InsertLeaveApproval>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(leaveApprovals).set(data).where(eq(leaveApprovals.id, id));
}

// ─── ACCRUAL LOGS ─────────────────────────────────────────────────────────────

export async function createAccrualLog(data: InsertLeaveAccrualLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(leaveAccrualLogs).values(data);
  return (result as { insertId: number }).insertId;
}

export async function listAccrualLogs(
  companyId: number,
  employeeId?: number,
  year?: number
): Promise<LeaveAccrualLog[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(leaveAccrualLogs.companyId, companyId)];
  if (employeeId) conditions.push(eq(leaveAccrualLogs.employeeId, employeeId));
  if (year) conditions.push(eq(leaveAccrualLogs.year, year));
  return db.select().from(leaveAccrualLogs).where(and(...conditions)).orderBy(desc(leaveAccrualLogs.runAt));
}

// ─── CARRY-FORWARD LOGS ───────────────────────────────────────────────────────

export async function createCarryForwardLog(data: InsertLeaveCarryForwardLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(leaveCarryForwardLogs).values(data);
  return (result as { insertId: number }).insertId;
}

export async function listCarryForwardLogs(
  companyId: number,
  employeeId?: number,
  fromYear?: number
): Promise<LeaveCarryForwardLog[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(leaveCarryForwardLogs.companyId, companyId)];
  if (employeeId) conditions.push(eq(leaveCarryForwardLogs.employeeId, employeeId));
  if (fromYear) conditions.push(eq(leaveCarryForwardLogs.fromYear, fromYear));
  return db.select().from(leaveCarryForwardLogs).where(and(...conditions)).orderBy(desc(leaveCarryForwardLogs.processedAt));
}

// ─── COMPENSATORY LEAVES ──────────────────────────────────────────────────────

export async function createCompensatoryLeave(data: InsertCompensatoryLeave): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(compensatoryLeaves).values(data);
  return (result as { insertId: number }).insertId;
}

export async function getCompensatoryLeave(id: number): Promise<CompensatoryLeave | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(compensatoryLeaves).where(eq(compensatoryLeaves.id, id)).limit(1);
  return rows[0];
}

export async function listCompensatoryLeaves(
  companyId: number,
  employeeId?: number,
  status?: string
): Promise<CompensatoryLeave[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(compensatoryLeaves.companyId, companyId)];
  if (employeeId) conditions.push(eq(compensatoryLeaves.employeeId, employeeId));
  if (status) conditions.push(eq(compensatoryLeaves.status, status as CompensatoryLeave["status"]));
  return db.select().from(compensatoryLeaves).where(and(...conditions)).orderBy(desc(compensatoryLeaves.earnedDate));
}

export async function updateCompensatoryLeave(id: number, data: Partial<InsertCompensatoryLeave>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(compensatoryLeaves).set(data).where(eq(compensatoryLeaves.id, id));
}

// ─── BALANCE CALCULATION HELPERS ─────────────────────────────────────────────

/**
 * Calculate prorated entitlement based on join date within a year.
 * Returns the number of days entitled for the remainder of the year.
 */
export function calculateProratedDays(
  annualEntitlement: number,
  joinDate: Date,
  year: number
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const effectiveStart = joinDate > yearStart ? joinDate : yearStart;
  const totalDaysInYear = 365;
  const remainingDays = Math.ceil((yearEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
  return Math.round((annualEntitlement * remainingDays) / totalDaysInYear * 2) / 2; // round to 0.5
}

/**
 * Calculate business days between two dates (excludes weekends).
 */
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
