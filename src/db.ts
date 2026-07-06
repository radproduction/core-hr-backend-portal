import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditLogs,
  companies,
  departments,
  designations,
  employees,
  hcmRoles,
  InsertAuditLog,
  InsertCompany,
  InsertDepartment,
  InsertDesignation,
  InsertEmployee,
  InsertHcmRole,
  InsertLocation,
  InsertNotification,
  InsertRolePermission,
  InsertWorkflowInstance,
  InsertWorkflowInstanceStep,
  InsertWorkflowStep,
  InsertWorkflowTemplate,
  InsertUser,
  locations,
  notifications,
  rolePermissions,
  users,
  workflowInstanceSteps,
  workflowInstances,
  workflowSteps,
  workflowTemplates,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

// ─── USERS ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── COMPANIES ────────────────────────────────────────────────────────────────

export async function getCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).where(eq(companies.isActive, true));
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}

export async function createCompany(data: InsertCompany) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.insert(companies).values(data);
}

export async function updateCompany(id: number, data: Partial<InsertCompany>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(companies).set(data).where(eq(companies.id, id));
}

// ─── LOCATIONS ────────────────────────────────────────────────────────────────

export async function getLocations(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(locations).where(and(eq(locations.companyId, companyId), eq(locations.isActive, true)));
}

export async function createLocation(data: InsertLocation) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(locations).values(data);
}

export async function updateLocation(id: number, companyId: number, data: Partial<InsertLocation>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(locations).set(data).where(and(eq(locations.id, id), eq(locations.companyId, companyId)));
}

// ─── DEPARTMENTS ──────────────────────────────────────────────────────────────

export async function getDepartments(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(departments).where(and(eq(departments.companyId, companyId), eq(departments.isActive, true)));
}

export async function createDepartment(data: InsertDepartment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(departments).values(data);
}

export async function updateDepartment(id: number, companyId: number, data: Partial<InsertDepartment>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(departments).set(data).where(and(eq(departments.id, id), eq(departments.companyId, companyId)));
}

// ─── DESIGNATIONS ─────────────────────────────────────────────────────────────

export async function getDesignations(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(designations).where(and(eq(designations.companyId, companyId), eq(designations.isActive, true)));
}

export async function createDesignation(data: InsertDesignation) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(designations).values(data);
}

export async function updateDesignation(id: number, companyId: number, data: Partial<InsertDesignation>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(designations).set(data).where(and(eq(designations.id, id), eq(designations.companyId, companyId)));
}

// ─── HCM ROLES ────────────────────────────────────────────────────────────────

export async function getHcmRoles(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(hcmRoles).where(and(eq(hcmRoles.companyId, companyId), eq(hcmRoles.isActive, true)));
}

export async function createHcmRole(data: InsertHcmRole) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(hcmRoles).values(data);
}

// ─── ROLE PERMISSIONS ─────────────────────────────────────────────────────────

export async function getRolePermissions(hcmRoleId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rolePermissions).where(
    and(eq(rolePermissions.hcmRoleId, hcmRoleId), eq(rolePermissions.companyId, companyId))
  );
}

export async function upsertRolePermission(data: InsertRolePermission) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(rolePermissions).values(data).onDuplicateKeyUpdate({
    set: {
      canView: data.canView,
      canCreate: data.canCreate,
      canEdit: data.canEdit,
      canDelete: data.canDelete,
      canApprove: data.canApprove,
      canExport: data.canExport,
    },
  });
}

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────
export async function getEmployees(companyId: number, filters?: { departmentId?: number; locationId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [eq(employees.companyId, companyId)];
  if (filters?.departmentId) conditions.push(eq(employees.departmentId, filters.departmentId));
  if (filters?.locationId) conditions.push(eq(employees.locationId, filters.locationId));
  if (filters?.status) conditions.push(eq(employees.status, filters.status as "active" | "inactive" | "on_leave" | "terminated" | "resigned"));
  const rows = await db.select().from(employees).where(and(...conditions)).orderBy(employees.firstName);
  // Fetch all departments and designations for this company in one query each
  const [depts, desigs] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.companyId, companyId)),
    db.select({ id: designations.id, name: designations.name }).from(designations).where(eq(designations.companyId, companyId)),
  ]);
  const deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]));
  const desigMap = Object.fromEntries(desigs.map(d => [d.id, d.name]));
  return rows.map(e => ({
    ...e,
    departmentName: e.departmentId ? (deptMap[e.departmentId] ?? null) : null,
    designationName: e.designationId ? (desigMap[e.designationId] ?? null) : null,
  }));
}

export async function getEmployeeById(id: number, companyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(employees).where(and(eq(employees.id, id), eq(employees.companyId, companyId))).limit(1);
  const emp = result[0];
  if (!emp) return undefined;
  // Enrich with related names
  const [deptRows, desigRows, locRows, reportsToRows] = await Promise.all([
    emp.departmentId ? db.select({ name: departments.name }).from(departments).where(eq(departments.id, emp.departmentId)).limit(1) : Promise.resolve([]),
    emp.designationId ? db.select({ name: designations.name }).from(designations).where(eq(designations.id, emp.designationId)).limit(1) : Promise.resolve([]),
    emp.locationId ? db.select({ name: locations.name }).from(locations).where(eq(locations.id, emp.locationId)).limit(1) : Promise.resolve([]),
    emp.reportsToId ? db.select({ firstName: employees.firstName, lastName: employees.lastName }).from(employees).where(eq(employees.id, emp.reportsToId)).limit(1) : Promise.resolve([]),
  ]);
  return {
    ...emp,
    departmentName: deptRows[0]?.name ?? null,
    designationName: desigRows[0]?.name ?? null,
    locationName: locRows[0]?.name ?? null,
    reportsToName: reportsToRows[0] ? `${(reportsToRows[0] as { firstName: string; lastName: string }).firstName} ${(reportsToRows[0] as { firstName: string; lastName: string }).lastName}` : null,
  };
}

export async function createEmployee(data: InsertEmployee) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(employees).values(data);
  return { id: (result as { insertId: number }).insertId };
}

export async function updateEmployee(id: number, companyId: number, data: Partial<InsertEmployee>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(employees).set(data).where(and(eq(employees.id, id), eq(employees.companyId, companyId)));
}

export async function getHeadcountStats(companyId: number) {
  const db = await getDb();
  if (!db) return { total: 0, active: 0, onLeave: 0, newThisMonth: 0 };
  const allEmps = await db.select().from(employees).where(eq(employees.companyId, companyId));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    total: allEmps.length,
    active: allEmps.filter(e => e.status === "active").length,
    onLeave: allEmps.filter(e => e.status === "on_leave").length,
    newThisMonth: allEmps.filter(e => e.joinDate && e.joinDate >= monthStart).length,
  };
}

// ─── WORKFLOW TEMPLATES ───────────────────────────────────────────────────────

export async function getWorkflowTemplates(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workflowTemplates).where(and(eq(workflowTemplates.companyId, companyId), eq(workflowTemplates.isActive, true)));
}

export async function createWorkflowTemplate(data: InsertWorkflowTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(workflowTemplates).values(data);
}

export async function getWorkflowSteps(templateId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workflowSteps).where(
    and(eq(workflowSteps.templateId, templateId), eq(workflowSteps.companyId, companyId))
  );
}

export async function createWorkflowStep(data: InsertWorkflowStep) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(workflowSteps).values(data);
}

// ─── WORKFLOW INSTANCES ───────────────────────────────────────────────────────

export async function getWorkflowInstances(companyId: number, filters?: { requestedBy?: number; status?: string; requestType?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [eq(workflowInstances.companyId, companyId)];
  if (filters?.requestedBy) conditions.push(eq(workflowInstances.requestedBy, filters.requestedBy));
  if (filters?.status) conditions.push(eq(workflowInstances.status, filters.status as "draft" | "submitted" | "pending" | "approved" | "rejected" | "cancelled"));
  if (filters?.requestType) conditions.push(eq(workflowInstances.requestType, filters.requestType));
  return db.select().from(workflowInstances).where(and(...conditions)).orderBy(desc(workflowInstances.createdAt));
}

export async function getWorkflowInstanceById(id: number, companyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workflowInstances).where(and(eq(workflowInstances.id, id), eq(workflowInstances.companyId, companyId))).limit(1);
  return result[0];
}

export async function createWorkflowInstance(data: InsertWorkflowInstance) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.insert(workflowInstances).values(data);
}

export async function updateWorkflowInstance(id: number, companyId: number, data: Partial<InsertWorkflowInstance>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(workflowInstances).set(data).where(and(eq(workflowInstances.id, id), eq(workflowInstances.companyId, companyId)));
}

export async function getWorkflowInstanceSteps(instanceId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workflowInstanceSteps).where(
    and(eq(workflowInstanceSteps.instanceId, instanceId), eq(workflowInstanceSteps.companyId, companyId))
  );
}

export async function createWorkflowInstanceStep(data: InsertWorkflowInstanceStep) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(workflowInstanceSteps).values(data);
}

export async function updateWorkflowInstanceStep(id: number, data: Partial<InsertWorkflowInstanceStep>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(workflowInstanceSteps).set(data).where(eq(workflowInstanceSteps.id, id));
}

export async function getPendingApprovalsCount(companyId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(workflowInstances).where(
    and(eq(workflowInstances.companyId, companyId), eq(workflowInstances.status, "pending"))
  );
  return Number(result[0]?.count ?? 0);
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export async function getNotifications(recipientEmployeeId: number, companyId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(
    and(eq(notifications.recipientEmployeeId, recipientEmployeeId), eq(notifications.companyId, companyId))
  ).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadNotificationCount(recipientEmployeeId: number, companyId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(
    and(eq(notifications.recipientEmployeeId, recipientEmployeeId), eq(notifications.companyId, companyId), eq(notifications.isRead, false))
  );
  return Number(result[0]?.count ?? 0);
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number, recipientEmployeeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(notifications).set({ isRead: true, readAt: new Date() }).where(
    and(eq(notifications.id, id), eq(notifications.recipientEmployeeId, recipientEmployeeId))
  );
}

export async function markAllNotificationsRead(recipientEmployeeId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(notifications).set({ isRead: true, readAt: new Date() }).where(
    and(eq(notifications.recipientEmployeeId, recipientEmployeeId), eq(notifications.companyId, companyId), eq(notifications.isRead, false))
  );
}

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  try { await db.insert(auditLogs).values(data); }
  catch (err) { console.error("[AuditLog] Failed to write:", err); }
}

export async function getAuditLogs(companyId: number, filters?: { module?: string; actorEmployeeId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [eq(auditLogs.companyId, companyId)];
  if (filters?.module) conditions.push(eq(auditLogs.module, filters.module));
  if (filters?.actorEmployeeId) conditions.push(eq(auditLogs.actorEmployeeId, filters.actorEmployeeId));
  return db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.createdAt)).limit(filters?.limit ?? 100);
}

// ─────────────────────────────────────────────
// MODULE 1: EMPLOYEE DOCUMENTS
// ─────────────────────────────────────────────
import {
  bulkUploadJobs,
  employeeAssets,
  employeeDocuments,
  employeeExits,
  employeeTransfers,
  employmentHistory,
  InsertBulkUploadJob,
  InsertEmployeeAsset,
  InsertEmployeeDocument,
  InsertEmployeeExit,
  InsertEmployeeTransfer,
  InsertEmploymentHistory,
} from "../drizzle/schema";
import { gte, lte } from "drizzle-orm";

export async function getEmployeeDocuments(employeeId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employeeDocuments)
    .where(and(eq(employeeDocuments.employeeId, employeeId), eq(employeeDocuments.companyId, companyId)))
    .orderBy(desc(employeeDocuments.createdAt));
}

export async function createEmployeeDocument(data: InsertEmployeeDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(employeeDocuments).values(data);
}

export async function updateEmployeeDocument(id: number, companyId: number, data: Partial<InsertEmployeeDocument>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(employeeDocuments).set(data)
    .where(and(eq(employeeDocuments.id, id), eq(employeeDocuments.companyId, companyId)));
}

export async function deleteEmployeeDocument(id: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(employeeDocuments)
    .where(and(eq(employeeDocuments.id, id), eq(employeeDocuments.companyId, companyId)));
}

export async function getExpiringDocuments(companyId: number, daysAhead = 30) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  return db.select().from(employeeDocuments)
    .where(and(
      eq(employeeDocuments.companyId, companyId),
      lte(employeeDocuments.expiryDate, cutoff),
      gte(employeeDocuments.expiryDate, new Date()),
    ));
}

// ─────────────────────────────────────────────
// MODULE 1: EMPLOYEE ASSETS
// ─────────────────────────────────────────────
export async function getEmployeeAssets(employeeId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employeeAssets)
    .where(and(eq(employeeAssets.employeeId, employeeId), eq(employeeAssets.companyId, companyId)))
    .orderBy(desc(employeeAssets.assignedDate));
}

export async function getAllAssets(companyId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [eq(employeeAssets.companyId, companyId)];
  if (status) conditions.push(eq(employeeAssets.status, status as "assigned" | "returned" | "lost"));
  return db.select().from(employeeAssets).where(and(...conditions));
}

export async function createEmployeeAsset(data: InsertEmployeeAsset) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(employeeAssets).values(data);
}

export async function updateEmployeeAsset(id: number, companyId: number, data: Partial<InsertEmployeeAsset>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(employeeAssets).set(data)
    .where(and(eq(employeeAssets.id, id), eq(employeeAssets.companyId, companyId)));
}

// ─────────────────────────────────────────────
// MODULE 1: BULK UPLOAD JOBS
// ─────────────────────────────────────────────
export async function createBulkUploadJob(data: InsertBulkUploadJob) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(bulkUploadJobs).values(data);
}

export async function updateBulkUploadJob(id: number, data: Partial<InsertBulkUploadJob>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(bulkUploadJobs).set(data).where(eq(bulkUploadJobs.id, id));
}

export async function getBulkUploadJobs(companyId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bulkUploadJobs)
    .where(eq(bulkUploadJobs.companyId, companyId))
    .orderBy(desc(bulkUploadJobs.createdAt))
    .limit(limit);
}

export async function getBulkUploadJobById(id: number, companyId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(bulkUploadJobs)
    .where(and(eq(bulkUploadJobs.id, id), eq(bulkUploadJobs.companyId, companyId)))
    .limit(1);
  return rows[0];
}

// ─────────────────────────────────────────────
// MODULE 1: EMPLOYEE TRANSFERS
// ─────────────────────────────────────────────
export async function getEmployeeTransfers(companyId: number, employeeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [eq(employeeTransfers.companyId, companyId)];
  if (employeeId) conditions.push(eq(employeeTransfers.employeeId, employeeId));
  return db.select().from(employeeTransfers)
    .where(and(...conditions))
    .orderBy(desc(employeeTransfers.createdAt));
}

export async function createEmployeeTransfer(data: InsertEmployeeTransfer) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(employeeTransfers).values(data);
}

export async function updateEmployeeTransfer(id: number, companyId: number, data: Partial<InsertEmployeeTransfer>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(employeeTransfers).set(data)
    .where(and(eq(employeeTransfers.id, id), eq(employeeTransfers.companyId, companyId)));
}

// ─────────────────────────────────────────────
// MODULE 1: EMPLOYEE EXITS
// ─────────────────────────────────────────────
export async function getEmployeeExits(companyId: number, employeeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [eq(employeeExits.companyId, companyId)];
  if (employeeId) conditions.push(eq(employeeExits.employeeId, employeeId));
  return db.select().from(employeeExits)
    .where(and(...conditions))
    .orderBy(desc(employeeExits.createdAt));
}

export async function createEmployeeExit(data: InsertEmployeeExit) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(employeeExits).values(data);
}

export async function updateEmployeeExit(id: number, companyId: number, data: Partial<InsertEmployeeExit>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(employeeExits).set(data)
    .where(and(eq(employeeExits.id, id), eq(employeeExits.companyId, companyId)));
}

// ─────────────────────────────────────────────
// MODULE 1: EMPLOYMENT HISTORY
// ─────────────────────────────────────────────
export async function getEmploymentHistory(employeeId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employmentHistory)
    .where(and(eq(employmentHistory.employeeId, employeeId), eq(employmentHistory.companyId, companyId)))
    .orderBy(desc(employmentHistory.effectiveDate));
}

export async function createEmploymentHistory(data: InsertEmploymentHistory) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(employmentHistory).values(data);
}

// ─────────────────────────────────────────────
// MODULE 1: REPORTS
// ─────────────────────────────────────────────
export async function getEmployeeReportData(companyId: number, filters?: {
  departmentId?: number;
  locationId?: number;
  status?: string;
  employmentType?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [eq(employees.companyId, companyId)];
  if (filters?.departmentId) conditions.push(eq(employees.departmentId, filters.departmentId));
  if (filters?.locationId) conditions.push(eq(employees.locationId, filters.locationId));
  if (filters?.status) conditions.push(eq(employees.status, filters.status as "active" | "inactive" | "on_leave" | "terminated" | "resigned"));
  if (filters?.employmentType) conditions.push(eq(employees.employmentType, filters.employmentType as "full_time" | "part_time" | "contract" | "intern" | "probation"));
  return db.select().from(employees).where(and(...conditions)).orderBy(employees.firstName);
}

export async function getTurnoverStats(companyId: number, year: number) {
  const db = await getDb();
  if (!db) return { exits: 0, newJoiners: 0 };
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const exits = await db.select().from(employeeExits)
    .where(and(
      eq(employeeExits.companyId, companyId),
      gte(employeeExits.lastWorkingDay, yearStart),
      lte(employeeExits.lastWorkingDay, yearEnd),
    ));
  const joiners = await db.select().from(employees)
    .where(and(
      eq(employees.companyId, companyId),
      gte(employees.joinDate, yearStart),
      lte(employees.joinDate, yearEnd),
    ));
  return { exits: exits.length, newJoiners: joiners.length };
}

export async function getUpcomingBirthdays(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employees)
    .where(and(eq(employees.companyId, companyId), eq(employees.status, "active")));
}

export async function getUpcomingAnniversaries(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(employees)
    .where(and(eq(employees.companyId, companyId), eq(employees.status, "active")));
}
