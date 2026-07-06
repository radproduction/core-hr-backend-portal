import {
  boolean,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────
// USERS (Manus OAuth identity)
// ─────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────
// MULTI-TENANT: COMPANIES
// ─────────────────────────────────────────────
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  industry: varchar("industry", { length: 100 }),
  country: varchar("country", { length: 100 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  timezone: varchar("timezone", { length: 100 }).default("UTC"),
  logoUrl: text("logoUrl"),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─────────────────────────────────────────────
// ORG STRUCTURE: LOCATIONS
// ─────────────────────────────────────────────
export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  geoLat: varchar("geoLat", { length: 30 }),
  geoLng: varchar("geoLng", { length: 30 }),
  geoFenceRadius: int("geoFenceRadius").default(200),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

// ─────────────────────────────────────────────
// ORG STRUCTURE: DEPARTMENTS
// ─────────────────────────────────────────────
export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  locationId: int("locationId"),
  parentId: int("parentId"),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }),
  headEmployeeId: int("headEmployeeId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

// ─────────────────────────────────────────────
// ORG STRUCTURE: DESIGNATIONS / GRADES
// ─────────────────────────────────────────────
export const designations = mysqlTable("designations", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  grade: varchar("grade", { length: 50 }),
  level: int("level").default(1),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Designation = typeof designations.$inferSelect;
export type InsertDesignation = typeof designations.$inferInsert;

// ─────────────────────────────────────────────
// HCM ROLES (6 predefined + custom)
// ─────────────────────────────────────────────
export const hcmRoles = mysqlTable("hcmRoles", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  isPredefined: boolean("isPredefined").default(false).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HcmRole = typeof hcmRoles.$inferSelect;
export type InsertHcmRole = typeof hcmRoles.$inferInsert;

// ─────────────────────────────────────────────
// ROLE PERMISSIONS (per-module, per-action)
// ─────────────────────────────────────────────
export const rolePermissions = mysqlTable("rolePermissions", {
  id: int("id").autoincrement().primaryKey(),
  hcmRoleId: int("hcmRoleId").notNull(),
  companyId: int("companyId").notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  canView: boolean("canView").default(false).notNull(),
  canCreate: boolean("canCreate").default(false).notNull(),
  canEdit: boolean("canEdit").default(false).notNull(),
  canDelete: boolean("canDelete").default(false).notNull(),
  canApprove: boolean("canApprove").default(false).notNull(),
  canExport: boolean("canExport").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

// ─────────────────────────────────────────────
// EMPLOYEES
// ─────────────────────────────────────────────
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  userId: int("userId"),
  employeeNumber: varchar("employeeNumber", { length: 50 }),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  displayName: varchar("displayName", { length: 200 }),
  gender: mysqlEnum("gender", ["male", "female", "other", "prefer_not_to_say"]),
  dateOfBirth: timestamp("dateOfBirth"),
  nationalId: varchar("nationalId", { length: 100 }),
  nationality: varchar("nationality", { length: 100 }),
  maritalStatus: mysqlEnum("maritalStatus", ["single", "married", "divorced", "widowed"]),
  personalEmail: varchar("personalEmail", { length: 320 }),
  workEmail: varchar("workEmail", { length: 320 }),
  personalPhone: varchar("personalPhone", { length: 50 }),
  workPhone: varchar("workPhone", { length: 50 }),
  address: text("address"),
  locationId: int("locationId"),
  departmentId: int("departmentId"),
  designationId: int("designationId"),
  hcmRoleId: int("hcmRoleId"),
  reportsToId: int("reportsToId"),
  joinDate: timestamp("joinDate"),
  confirmationDate: timestamp("confirmationDate"),
  employmentType: mysqlEnum("employmentType", ["full_time", "part_time", "contract", "intern", "probation"]).default("full_time"),
  status: mysqlEnum("status", ["active", "inactive", "on_leave", "terminated", "resigned"]).default("active").notNull(),
  photoUrl: text("photoUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

// ─────────────────────────────────────────────
// WORKFLOW TEMPLATES
// ─────────────────────────────────────────────
export const workflowTemplates = mysqlTable("workflowTemplates", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  requestType: varchar("requestType", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = typeof workflowTemplates.$inferInsert;

// ─────────────────────────────────────────────
// WORKFLOW STEPS
// ─────────────────────────────────────────────
export const workflowSteps = mysqlTable("workflowSteps", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  companyId: int("companyId").notNull(),
  stepOrder: int("stepOrder").notNull(),
  stepName: varchar("stepName", { length: 255 }).notNull(),
  approverType: mysqlEnum("approverType", ["role", "specific_employee", "reporting_manager", "department_head"]).notNull(),
  approverRoleId: int("approverRoleId"),
  approverEmployeeId: int("approverEmployeeId"),
  isOptional: boolean("isOptional").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;

// ─────────────────────────────────────────────
// WORKFLOW INSTANCES
// ─────────────────────────────────────────────
export const workflowInstances = mysqlTable("workflowInstances", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  templateId: int("templateId").notNull(),
  requestType: varchar("requestType", { length: 100 }).notNull(),
  requestedBy: int("requestedBy").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  payload: json("payload"),
  status: mysqlEnum("status", ["draft", "submitted", "pending", "approved", "rejected", "cancelled"]).default("draft").notNull(),
  currentStepOrder: int("currentStepOrder").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type InsertWorkflowInstance = typeof workflowInstances.$inferInsert;

// ─────────────────────────────────────────────
// WORKFLOW INSTANCE STEPS
// ─────────────────────────────────────────────
export const workflowInstanceSteps = mysqlTable("workflowInstanceSteps", {
  id: int("id").autoincrement().primaryKey(),
  instanceId: int("instanceId").notNull(),
  companyId: int("companyId").notNull(),
  stepOrder: int("stepOrder").notNull(),
  stepName: varchar("stepName", { length: 255 }).notNull(),
  assignedToEmployeeId: int("assignedToEmployeeId"),
  assignedToRoleId: int("assignedToRoleId"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "skipped"]).default("pending").notNull(),
  actionBy: int("actionBy"),
  comment: text("comment"),
  actionAt: timestamp("actionAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkflowInstanceStep = typeof workflowInstanceSteps.$inferSelect;
export type InsertWorkflowInstanceStep = typeof workflowInstanceSteps.$inferInsert;

// ─────────────────────────────────────────────
// IN-APP NOTIFICATIONS
// ─────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  recipientEmployeeId: int("recipientEmployeeId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  type: mysqlEnum("type", ["workflow", "system", "reminder", "announcement"]).default("system").notNull(),
  referenceType: varchar("referenceType", { length: 100 }),
  referenceId: int("referenceId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  actorEmployeeId: int("actorEmployeeId"),
  actorUserId: int("actorUserId"),
  actorName: varchar("actorName", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: int("entityId"),
  entityLabel: varchar("entityLabel", { length: 500 }),
  before: json("before"),
  after: json("after"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─────────────────────────────────────────────
// EMPLOYEE DOCUMENTS
// ─────────────────────────────────────────────
export const employeeDocuments = mysqlTable("employeeDocuments", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  documentType: mysqlEnum("documentType", [
    "passport", "national_id", "visa", "work_permit", "driving_license",
    "degree", "certificate", "contract", "nda", "offer_letter",
    "appraisal", "warning_letter", "other",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  expiryDate: timestamp("expiryDate"),
  isVerified: boolean("isVerified").default(false).notNull(),
  verifiedBy: int("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
  notes: text("notes"),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type InsertEmployeeDocument = typeof employeeDocuments.$inferInsert;

// ─────────────────────────────────────────────
// EMPLOYEE ASSETS
// ─────────────────────────────────────────────
export const employeeAssets = mysqlTable("employeeAssets", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  assetName: varchar("assetName", { length: 255 }).notNull(),
  assetType: mysqlEnum("assetType", [
    "laptop", "mobile", "tablet", "vehicle", "access_card",
    "uniform", "tools", "other",
  ]).notNull(),
  serialNumber: varchar("serialNumber", { length: 100 }),
  assetTag: varchar("assetTag", { length: 100 }),
  assignedDate: timestamp("assignedDate").notNull(),
  returnDate: timestamp("returnDate"),
  condition: mysqlEnum("condition", ["new", "good", "fair", "damaged", "lost"]).default("good").notNull(),
  conditionOnReturn: mysqlEnum("conditionOnReturn", ["new", "good", "fair", "damaged", "lost"]),
  notes: text("notes"),
  status: mysqlEnum("status", ["assigned", "returned", "lost"]).default("assigned").notNull(),
  assignedBy: int("assignedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmployeeAsset = typeof employeeAssets.$inferSelect;
export type InsertEmployeeAsset = typeof employeeAssets.$inferInsert;

// ─────────────────────────────────────────────
// BULK UPLOAD JOBS
// ─────────────────────────────────────────────
export const bulkUploadJobs = mysqlTable("bulkUploadJobs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }),
  totalRows: int("totalRows").default(0).notNull(),
  successRows: int("successRows").default(0).notNull(),
  errorRows: int("errorRows").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  errorReport: json("errorReport"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type BulkUploadJob = typeof bulkUploadJobs.$inferSelect;
export type InsertBulkUploadJob = typeof bulkUploadJobs.$inferInsert;

// ─────────────────────────────────────────────
// EMPLOYEE TRANSFERS
// ─────────────────────────────────────────────
export const employeeTransfers = mysqlTable("employeeTransfers", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  fromDepartmentId: int("fromDepartmentId"),
  toDepartmentId: int("toDepartmentId"),
  fromLocationId: int("fromLocationId"),
  toLocationId: int("toLocationId"),
  fromDesignationId: int("fromDesignationId"),
  toDesignationId: int("toDesignationId"),
  fromReportsToId: int("fromReportsToId"),
  toReportsToId: int("toReportsToId"),
  effectiveDate: timestamp("effectiveDate").notNull(),
  reason: text("reason"),
  status: mysqlEnum("status", ["draft", "pending", "approved", "rejected", "executed"]).default("draft").notNull(),
  workflowInstanceId: int("workflowInstanceId"),
  requestedBy: int("requestedBy").notNull(),
  executedAt: timestamp("executedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmployeeTransfer = typeof employeeTransfers.$inferSelect;
export type InsertEmployeeTransfer = typeof employeeTransfers.$inferInsert;

// ─────────────────────────────────────────────
// EMPLOYEE EXITS
// ─────────────────────────────────────────────
export const employeeExits = mysqlTable("employeeExits", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  exitType: mysqlEnum("exitType", [
    "resignation", "termination", "retirement", "end_of_contract",
    "redundancy", "death", "absconding",
  ]).notNull(),
  lastWorkingDay: timestamp("lastWorkingDay").notNull(),
  noticeDate: timestamp("noticeDate"),
  reason: text("reason"),
  // Handoff checklist (JSON booleans)
  checklistAssetsReturned: boolean("checklistAssetsReturned").default(false).notNull(),
  checklistAccessRevoked: boolean("checklistAccessRevoked").default(false).notNull(),
  checklistDocumentsHandedOver: boolean("checklistDocumentsHandedOver").default(false).notNull(),
  checklistFinancialClearance: boolean("checklistFinancialClearance").default(false).notNull(),
  checklistExitInterviewDone: boolean("checklistExitInterviewDone").default(false).notNull(),
  exitInterviewNotes: text("exitInterviewNotes"),
  status: mysqlEnum("status", ["initiated", "in_progress", "cleared", "completed"]).default("initiated").notNull(),
  workflowInstanceId: int("workflowInstanceId"),
  initiatedBy: int("initiatedBy").notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmployeeExit = typeof employeeExits.$inferSelect;
export type InsertEmployeeExit = typeof employeeExits.$inferInsert;

// ─────────────────────────────────────────────
// EMPLOYEE EMPLOYMENT HISTORY (timeline)
// ─────────────────────────────────────────────
export const employmentHistory = mysqlTable("employmentHistory", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  eventType: mysqlEnum("eventType", [
    "hired", "promoted", "transferred", "designation_change",
    "salary_change", "status_change", "confirmed", "exited",
  ]).notNull(),
  description: varchar("description", { length: 500 }),
  effectiveDate: timestamp("effectiveDate").notNull(),
  previousValue: json("previousValue"),
  newValue: json("newValue"),
  recordedBy: int("recordedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmploymentHistory = typeof employmentHistory.$inferSelect;
export type InsertEmploymentHistory = typeof employmentHistory.$inferInsert;

// ─────────────────────────────────────────────
// GEO-FENCES
// ─────────────────────────────────────────────
export const geoFences = mysqlTable("geoFences", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  locationId: int("locationId"),
  name: varchar("name", { length: 200 }).notNull(),
  lat: varchar("lat", { length: 30 }).notNull(),
  lng: varchar("lng", { length: 30 }).notNull(),
  radiusMeters: int("radiusMeters").default(200).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});
export type GeoFence = typeof geoFences.$inferSelect;
export type InsertGeoFence = typeof geoFences.$inferInsert;

// ─────────────────────────────────────────────
// SHIFTS
// ─────────────────────────────────────────────
export const shifts = mysqlTable("shifts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  startTime: varchar("startTime", { length: 10 }).notNull(), // "HH:MM"
  endTime: varchar("endTime", { length: 10 }).notNull(),
  graceMinutes: int("graceMinutes").default(0).notNull(),
  breakMinutes: int("breakMinutes").default(0).notNull(),
  isFlexible: boolean("isFlexible").default(false).notNull(),
  isOvernight: boolean("isOvernight").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = typeof shifts.$inferInsert;

// ─────────────────────────────────────────────
// SHIFT ROSTERS
// ─────────────────────────────────────────────
export const shiftRosters = mysqlTable("shiftRosters", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  shiftId: int("shiftId"),
  date: timestamp("date").notNull(),
  isRestDay: boolean("isRestDay").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});
export type ShiftRoster = typeof shiftRosters.$inferSelect;
export type InsertShiftRoster = typeof shiftRosters.$inferInsert;

// ─────────────────────────────────────────────
// ATTENDANCE RECORDS
// ─────────────────────────────────────────────
export const attendanceRecords = mysqlTable("attendanceRecords", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  date: timestamp("date").notNull(),
  clockIn: timestamp("clockIn"),
  clockOut: timestamp("clockOut"),
  clockInLat: varchar("clockInLat", { length: 30 }),
  clockInLng: varchar("clockInLng", { length: 30 }),
  clockOutLat: varchar("clockOutLat", { length: 30 }),
  clockOutLng: varchar("clockOutLng", { length: 30 }),
  geoFenceId: int("geoFenceId"),
  geoFenceStatus: mysqlEnum("geoFenceStatus", ["inside", "outside", "unknown"]).default("unknown"),
  shiftId: int("shiftId"),
  status: mysqlEnum("status", [
    "present", "absent", "late", "early_leave", "half_day",
    "on_leave", "holiday", "weekend", "overtime",
  ]).default("absent").notNull(),
  source: mysqlEnum("source", ["web", "mobile", "biometric", "csv_import", "manual"]).default("web").notNull(),
  workMinutes: int("workMinutes").default(0),
  overtimeMinutes: int("overtimeMinutes").default(0),
  lateMinutes: int("lateMinutes").default(0),
  earlyLeaveMinutes: int("earlyLeaveMinutes").default(0),
  notes: text("notes"),
  correctedBy: int("correctedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = typeof attendanceRecords.$inferInsert;

// ─────────────────────────────────────────────
// OVERTIME REQUESTS
// ─────────────────────────────────────────────
export const overtimeRequests = mysqlTable("overtimeRequests", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  attendanceRecordId: int("attendanceRecordId"),
  date: timestamp("date").notNull(),
  requestedMinutes: int("requestedMinutes").notNull(),
  approvedMinutes: int("approvedMinutes"),
  reason: text("reason"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "auto_approved"]).default("pending").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  workflowInstanceId: int("workflowInstanceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OvertimeRequest = typeof overtimeRequests.$inferSelect;
export type InsertOvertimeRequest = typeof overtimeRequests.$inferInsert;

// ─────────────────────────────────────────────
// PUNCH IMPORT JOBS
// ─────────────────────────────────────────────
export const punchImportJobs = mysqlTable("punchImportJobs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  source: mysqlEnum("source", ["biometric", "csv", "excel", "api"]).default("csv").notNull(),
  totalRows: int("totalRows").default(0).notNull(),
  successRows: int("successRows").default(0).notNull(),
  errorRows: int("errorRows").default(0).notNull(),
  errorReport: json("errorReport"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PunchImportJob = typeof punchImportJobs.$inferSelect;
export type InsertPunchImportJob = typeof punchImportJobs.$inferInsert;

// ─────────────────────────────────────────────
// ATTENDANCE ANOMALY FLAGS (AI-generated, human review only)
// ─────────────────────────────────────────────
export const attendanceAnomalyFlags = mysqlTable("attendanceAnomalyFlags", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  attendanceRecordId: int("attendanceRecordId"),
  date: timestamp("date").notNull(),
  type: mysqlEnum("type", [
    "creeping_lateness", "geo_fence_violation", "buddy_punching",
    "unusual_pattern", "excessive_overtime", "irregular_hours",
  ]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high"]).default("medium").notNull(),
  description: text("description").notNull(),
  aiReasoning: text("aiReasoning"),
  status: mysqlEnum("status", ["pending_review", "reviewed_ok", "reviewed_action", "dismissed"]).default("pending_review").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AttendanceAnomalyFlag = typeof attendanceAnomalyFlags.$inferSelect;
export type InsertAttendanceAnomalyFlag = typeof attendanceAnomalyFlags.$inferInsert;

// ─────────────────────────────────────────────
// ABSENTEEISM PREDICTIONS (AI-generated, human review only)
// ─────────────────────────────────────────────
export const absenteeismPredictions = mysqlTable("absenteeismPredictions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  predictionDate: timestamp("predictionDate").notNull(),
  targetPeriodStart: timestamp("targetPeriodStart").notNull(),
  targetPeriodEnd: timestamp("targetPeriodEnd").notNull(),
  riskScore: int("riskScore").notNull(), // 0-100
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]).notNull(),
  factors: json("factors"),
  recommendation: text("recommendation"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});
export type AbsenteeismPrediction = typeof absenteeismPredictions.$inferSelect;
export type InsertAbsenteeismPrediction = typeof absenteeismPredictions.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3: LEAVE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// LEAVE TYPES
// ─────────────────────────────────────────────
export const leaveTypes = mysqlTable("leaveTypes", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  description: text("description"),
  isPaid: boolean("isPaid").default(true).notNull(),
  isCarryForward: boolean("isCarryForward").default(false).notNull(),
  maxCarryDays: int("maxCarryDays").default(0).notNull(),
  accrualType: mysqlEnum("accrualType", ["none", "monthly", "yearly", "per_period"]).default("none").notNull(),
  accrualRate: decimal("accrualRate", { precision: 5, scale: 2 }).default("0.00"),
  maxBalance: decimal("maxBalance", { precision: 5, scale: 2 }).default("0.00"),
  applicableGender: mysqlEnum("applicableGender", ["all", "male", "female"]).default("all").notNull(),
  requiresApproval: boolean("requiresApproval").default(true).notNull(),
  requiresDocument: boolean("requiresDocument").default(false).notNull(),
  minDaysNotice: int("minDaysNotice").default(0).notNull(),
  maxConsecutiveDays: int("maxConsecutiveDays").default(0).notNull(),
  colorCode: varchar("colorCode", { length: 10 }).default("#6366f1"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LeaveType = typeof leaveTypes.$inferSelect;
export type InsertLeaveType = typeof leaveTypes.$inferInsert;

// ─────────────────────────────────────────────
// LEAVE POLICIES
// ─────────────────────────────────────────────
export const leavePolicies = mysqlTable("leavePolicies", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  leaveTypeId: int("leaveTypeId").notNull(),
  applicableTo: mysqlEnum("applicableTo", ["all", "department", "gender", "designation"]).default("all").notNull(),
  departmentId: int("departmentId"),
  designationId: int("designationId"),
  gender: mysqlEnum("gender", ["all", "male", "female"]).default("all").notNull(),
  entitlementDays: decimal("entitlementDays", { precision: 5, scale: 2 }).notNull(),
  prorateOnJoining: boolean("prorateOnJoining").default(true).notNull(),
  prorateOnExit: boolean("prorateOnExit").default(true).notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LeavePolicy = typeof leavePolicies.$inferSelect;
export type InsertLeavePolicy = typeof leavePolicies.$inferInsert;

// ─────────────────────────────────────────────
// LEAVE BALANCES
// ─────────────────────────────────────────────
export const leaveBalances = mysqlTable("leaveBalances", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  leaveTypeId: int("leaveTypeId").notNull(),
  year: int("year").notNull(),
  entitled: decimal("entitled", { precision: 6, scale: 2 }).default("0.00").notNull(),
  used: decimal("used", { precision: 6, scale: 2 }).default("0.00").notNull(),
  pending: decimal("pending", { precision: 6, scale: 2 }).default("0.00").notNull(),
  carryForward: decimal("carryForward", { precision: 6, scale: 2 }).default("0.00").notNull(),
  compensatory: decimal("compensatory", { precision: 6, scale: 2 }).default("0.00").notNull(),
  balance: decimal("balance", { precision: 6, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LeaveBalance = typeof leaveBalances.$inferSelect;
export type InsertLeaveBalance = typeof leaveBalances.$inferInsert;

// ─────────────────────────────────────────────
// LEAVE REQUESTS
// ─────────────────────────────────────────────
export const leaveRequests = mysqlTable("leaveRequests", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  leaveTypeId: int("leaveTypeId").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  days: decimal("days", { precision: 5, scale: 2 }).notNull(),
  isHalfDay: boolean("isHalfDay").default(false).notNull(),
  halfDayPeriod: mysqlEnum("halfDayPeriod", ["morning", "afternoon"]),
  reason: text("reason").notNull(),
  aiDraftUsed: boolean("aiDraftUsed").default(false).notNull(),
  attachmentKey: varchar("attachmentKey", { length: 500 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled", "withdrawn"]).default("pending").notNull(),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  rejectedReason: text("rejectedReason"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: text("cancelReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = typeof leaveRequests.$inferInsert;

// ─────────────────────────────────────────────
// LEAVE APPROVALS (per-step audit trail)
// ─────────────────────────────────────────────
export const leaveApprovals = mysqlTable("leaveApprovals", {
  id: int("id").autoincrement().primaryKey(),
  leaveRequestId: int("leaveRequestId").notNull(),
  approverId: int("approverId").notNull(),
  step: int("step").default(1).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  comments: text("comments"),
  aiCoverageSummary: text("aiCoverageSummary"),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LeaveApproval = typeof leaveApprovals.$inferSelect;
export type InsertLeaveApproval = typeof leaveApprovals.$inferInsert;

// ─────────────────────────────────────────────
// LEAVE ACCRUAL LOGS
// ─────────────────────────────────────────────
export const leaveAccrualLogs = mysqlTable("leaveAccrualLogs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  leaveTypeId: int("leaveTypeId").notNull(),
  year: int("year").notNull(),
  month: int("month").notNull(),
  accrualDays: decimal("accrualDays", { precision: 5, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 6, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 6, scale: 2 }).notNull(),
  notes: text("notes"),
  runAt: timestamp("runAt").defaultNow().notNull(),
});
export type LeaveAccrualLog = typeof leaveAccrualLogs.$inferSelect;
export type InsertLeaveAccrualLog = typeof leaveAccrualLogs.$inferInsert;

// ─────────────────────────────────────────────
// LEAVE CARRY-FORWARD LOGS
// ─────────────────────────────────────────────
export const leaveCarryForwardLogs = mysqlTable("leaveCarryForwardLogs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  leaveTypeId: int("leaveTypeId").notNull(),
  fromYear: int("fromYear").notNull(),
  toYear: int("toYear").notNull(),
  balanceAtYearEnd: decimal("balanceAtYearEnd", { precision: 6, scale: 2 }).notNull(),
  carriedDays: decimal("carriedDays", { precision: 6, scale: 2 }).notNull(),
  expiredDays: decimal("expiredDays", { precision: 6, scale: 2 }).notNull(),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
});
export type LeaveCarryForwardLog = typeof leaveCarryForwardLogs.$inferSelect;
export type InsertLeaveCarryForwardLog = typeof leaveCarryForwardLogs.$inferInsert;

// ─────────────────────────────────────────────
// COMPENSATORY LEAVES
// ─────────────────────────────────────────────
export const compensatoryLeaves = mysqlTable("compensatoryLeaves", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  earnedDate: timestamp("earnedDate").notNull(),
  reason: text("reason").notNull(),
  earnedDays: decimal("earnedDays", { precision: 5, scale: 2 }).notNull(),
  usedDays: decimal("usedDays", { precision: 5, scale: 2 }).default("0.00").notNull(),
  expiryDate: timestamp("expiryDate"),
  status: mysqlEnum("status", ["active", "used", "expired", "cancelled"]).default("active").notNull(),
  approvedBy: int("approvedBy"),
  linkedLeaveRequestId: int("linkedLeaveRequestId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CompensatoryLeave = typeof compensatoryLeaves.$inferSelect;
export type InsertCompensatoryLeave = typeof compensatoryLeaves.$inferInsert;

// ═════════════════════════════════════════════
// MODULE 4: PAYROLL MANAGEMENT
// ═════════════════════════════════════════════

// ─────────────────────────────────────────────
// SALARY STRUCTURES
// ─────────────────────────────────────────────
export const salaryStructures = mysqlTable("salaryStructures", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("AED").notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SalaryStructure = typeof salaryStructures.$inferSelect;
export type InsertSalaryStructure = typeof salaryStructures.$inferInsert;

// ─────────────────────────────────────────────
// SALARY COMPONENTS
// ─────────────────────────────────────────────
export const salaryComponents = mysqlTable("salaryComponents", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  code: varchar("code", { length: 30 }).notNull(),
  type: mysqlEnum("type", ["earning", "deduction", "tax", "pf"]).notNull(),
  calculationType: mysqlEnum("calculationType", ["fixed", "percentage_of_basic", "percentage_of_gross", "formula"]).default("fixed").notNull(),
  value: decimal("value", { precision: 12, scale: 4 }).default("0.0000").notNull(),
  isTaxable: boolean("isTaxable").default(false).notNull(),
  isPFApplicable: boolean("isPFApplicable").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SalaryComponent = typeof salaryComponents.$inferSelect;
export type InsertSalaryComponent = typeof salaryComponents.$inferInsert;

// ─────────────────────────────────────────────
// SALARY STRUCTURE COMPONENTS (many-to-many with override)
// ─────────────────────────────────────────────
export const salaryStructureComponents = mysqlTable("salaryStructureComponents", {
  id: int("id").autoincrement().primaryKey(),
  structureId: int("structureId").notNull(),
  componentId: int("componentId").notNull(),
  overrideValue: decimal("overrideValue", { precision: 12, scale: 4 }),
  isActive: boolean("isActive").default(true).notNull(),
});
export type SalaryStructureComponent = typeof salaryStructureComponents.$inferSelect;
export type InsertSalaryStructureComponent = typeof salaryStructureComponents.$inferInsert;

// ─────────────────────────────────────────────
// EMPLOYEE SALARY ASSIGNMENTS
// ─────────────────────────────────────────────
export const employeeSalaryAssignments = mysqlTable("employeeSalaryAssignments", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  structureId: int("structureId").notNull(),
  basicSalary: decimal("basicSalary", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("AED").notNull(),
  effectiveDate: timestamp("effectiveDate").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmployeeSalaryAssignment = typeof employeeSalaryAssignments.$inferSelect;
export type InsertEmployeeSalaryAssignment = typeof employeeSalaryAssignments.$inferInsert;

// ─────────────────────────────────────────────
// TAX SLABS
// ─────────────────────────────────────────────
export const taxSlabs = mysqlTable("taxSlabs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  country: varchar("country", { length: 10 }).default("AE").notNull(),
  year: int("year").notNull(),
  fromAmount: decimal("fromAmount", { precision: 14, scale: 2 }).notNull(),
  toAmount: decimal("toAmount", { precision: 14, scale: 2 }),
  rate: decimal("rate", { precision: 6, scale: 4 }).default("0.0000").notNull(),
  fixedAmount: decimal("fixedAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  description: varchar("description", { length: 200 }),
});
export type TaxSlab = typeof taxSlabs.$inferSelect;
export type InsertTaxSlab = typeof taxSlabs.$inferInsert;

// ─────────────────────────────────────────────
// PF SETTINGS
// ─────────────────────────────────────────────
export const pfSettings = mysqlTable("pfSettings", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeRate: decimal("employeeRate", { precision: 6, scale: 4 }).default("0.0000").notNull(),
  employerRate: decimal("employerRate", { precision: 6, scale: 4 }).default("0.0000").notNull(),
  ceiling: decimal("ceiling", { precision: 12, scale: 2 }),
  isActive: boolean("isActive").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PfSettings = typeof pfSettings.$inferSelect;
export type InsertPfSettings = typeof pfSettings.$inferInsert;

// ─────────────────────────────────────────────
// LOANS
// ─────────────────────────────────────────────
export const loans = mysqlTable("loans", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  loanType: varchar("loanType", { length: 80 }).default("Personal Loan").notNull(),
  principalAmount: decimal("principalAmount", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interestRate", { precision: 6, scale: 4 }).default("0.0000").notNull(),
  totalInstallments: int("totalInstallments").notNull(),
  remainingInstallments: int("remainingInstallments").notNull(),
  monthlyDeduction: decimal("monthlyDeduction", { precision: 12, scale: 2 }).notNull(),
  disbursedDate: timestamp("disbursedDate").notNull(),
  status: mysqlEnum("status", ["pending", "active", "completed", "cancelled"]).default("pending").notNull(),
  approvedBy: int("approvedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Loan = typeof loans.$inferSelect;
export type InsertLoan = typeof loans.$inferInsert;

// ─────────────────────────────────────────────
// SALARY ADVANCES
// ─────────────────────────────────────────────
export const salaryAdvances = mysqlTable("salaryAdvances", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  requestedDate: timestamp("requestedDate").defaultNow().notNull(),
  approvedDate: timestamp("approvedDate"),
  deductionMonth: int("deductionMonth"),
  deductionYear: int("deductionYear"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "deducted"]).default("pending").notNull(),
  approvedBy: int("approvedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SalaryAdvance = typeof salaryAdvances.$inferSelect;
export type InsertSalaryAdvance = typeof salaryAdvances.$inferInsert;

// ─────────────────────────────────────────────
// DISBURSEMENT CYCLES
// ─────────────────────────────────────────────
export const disbursementCycles = mysqlTable("disbursementCycles", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  dayOfMonth: int("dayOfMonth").default(25).notNull(),
  bankName: varchar("bankName", { length: 100 }),
  accountFormat: varchar("accountFormat", { length: 50 }).default("IBAN").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DisbursementCycle = typeof disbursementCycles.$inferSelect;
export type InsertDisbursementCycle = typeof disbursementCycles.$inferInsert;

// ─────────────────────────────────────────────
// PAYROLL RUNS
// ─────────────────────────────────────────────
export const payrollRuns = mysqlTable("payrollRuns", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  month: int("month").notNull(),
  year: int("year").notNull(),
  currency: varchar("currency", { length: 10 }).default("AED").notNull(),
  scope: mysqlEnum("scope", ["all", "department", "location", "individual"]).default("all").notNull(),
  scopeIds: json("scopeIds").$type<number[]>(),
  status: mysqlEnum("status", ["draft", "processing", "pending_approval", "approved", "disbursed", "locked"]).default("draft").notNull(),
  runBy: int("runBy").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  lockedAt: timestamp("lockedAt"),
  totalGross: decimal("totalGross", { precision: 14, scale: 2 }).default("0.00").notNull(),
  totalDeductions: decimal("totalDeductions", { precision: 14, scale: 2 }).default("0.00").notNull(),
  totalNet: decimal("totalNet", { precision: 14, scale: 2 }).default("0.00").notNull(),
  employeeCount: int("employeeCount").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type InsertPayrollRun = typeof payrollRuns.$inferInsert;

// ─────────────────────────────────────────────
// PAYSLIPS
// ─────────────────────────────────────────────
export const payslips = mysqlTable("payslips", {
  id: int("id").autoincrement().primaryKey(),
  payrollRunId: int("payrollRunId").notNull(),
  employeeId: int("employeeId").notNull(),
  month: int("month").notNull(),
  year: int("year").notNull(),
  basicSalary: decimal("basicSalary", { precision: 12, scale: 2 }).notNull(),
  grossSalary: decimal("grossSalary", { precision: 12, scale: 2 }).notNull(),
  totalEarnings: decimal("totalEarnings", { precision: 12, scale: 2 }).notNull(),
  totalDeductions: decimal("totalDeductions", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  pfEmployee: decimal("pfEmployee", { precision: 12, scale: 2 }).default("0.00").notNull(),
  pfEmployer: decimal("pfEmployer", { precision: 12, scale: 2 }).default("0.00").notNull(),
  loanDeductions: decimal("loanDeductions", { precision: 12, scale: 2 }).default("0.00").notNull(),
  advanceDeductions: decimal("advanceDeductions", { precision: 12, scale: 2 }).default("0.00").notNull(),
  lateDeductions: decimal("lateDeductions", { precision: 12, scale: 2 }).default("0.00").notNull(),
  absentDeductions: decimal("absentDeductions", { precision: 12, scale: 2 }).default("0.00").notNull(),
  netSalary: decimal("netSalary", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("AED").notNull(),
  attendanceDays: int("attendanceDays").default(0).notNull(),
  absentDays: int("absentDays").default(0).notNull(),
  components: json("components").$type<Array<{code: string; name: string; type: string; amount: number}>>(),
  status: mysqlEnum("status", ["draft", "approved", "disbursed"]).default("draft").notNull(),
  pdfKey: varchar("pdfKey", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Payslip = typeof payslips.$inferSelect;
export type InsertPayslip = typeof payslips.$inferInsert;

// ─────────────────────────────────────────────
// PAYROLL ANOMALY FLAGS
// ─────────────────────────────────────────────
export const payrollAnomalyFlags = mysqlTable("payrollAnomalyFlags", {
  id: int("id").autoincrement().primaryKey(),
  payrollRunId: int("payrollRunId").notNull(),
  employeeId: int("employeeId").notNull(),
  type: mysqlEnum("type", ["salary_spike", "salary_drop", "duplicate_payment", "deduction_error", "missing_component", "new_employee_high_salary", "zero_net"]).notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high"]).default("medium").notNull(),
  description: text("description").notNull(),
  previousValue: decimal("previousValue", { precision: 12, scale: 2 }),
  currentValue: decimal("currentValue", { precision: 12, scale: 2 }),
  percentChange: decimal("percentChange", { precision: 8, scale: 2 }),
  status: mysqlEnum("status", ["pending", "acknowledged", "dismissed"]).default("pending").notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PayrollAnomalyFlag = typeof payrollAnomalyFlags.$inferSelect;
export type InsertPayrollAnomalyFlag = typeof payrollAnomalyFlags.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5: RECRUITMENT
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// JOB REQUISITIONS
// ─────────────────────────────────────────────
export const jobRequisitions = mysqlTable("jobRequisitions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  departmentId: int("departmentId"),
  designationId: int("designationId"),
  requestedBy: int("requestedBy").notNull(),
  approvedBy: int("approvedBy"),
  title: varchar("title", { length: 255 }).notNull(),
  headcount: int("headcount").default(1).notNull(),
  justification: text("justification"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  status: mysqlEnum("status", ["draft", "pending_approval", "approved", "rejected", "fulfilled", "cancelled"]).default("draft").notNull(),
  targetDate: timestamp("targetDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type JobRequisition = typeof jobRequisitions.$inferSelect;
export type InsertJobRequisition = typeof jobRequisitions.$inferInsert;

// ─────────────────────────────────────────────
// JOB POSTINGS
// ─────────────────────────────────────────────
export const jobPostings = mysqlTable("jobPostings", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  requisitionId: int("requisitionId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  requirements: text("requirements"),
  responsibilities: text("responsibilities"),
  location: varchar("location", { length: 255 }),
  type: mysqlEnum("type", ["full_time", "part_time", "contract", "internship", "freelance"]).default("full_time").notNull(),
  salaryMin: decimal("salaryMin", { precision: 12, scale: 2 }),
  salaryMax: decimal("salaryMax", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("AED").notNull(),
  experienceMin: int("experienceMin").default(0),
  experienceMax: int("experienceMax"),
  skills: json("skills"),
  isPublic: boolean("isPublic").default(true).notNull(),
  status: mysqlEnum("status", ["draft", "published", "paused", "closed", "filled"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  closingDate: timestamp("closingDate"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type JobPosting = typeof jobPostings.$inferSelect;
export type InsertJobPosting = typeof jobPostings.$inferInsert;

// ─────────────────────────────────────────────
// CANDIDATES
// ─────────────────────────────────────────────
export const candidates = mysqlTable("candidates", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  currentTitle: varchar("currentTitle", { length: 255 }),
  currentCompany: varchar("currentCompany", { length: 255 }),
  totalExperience: decimal("totalExperience", { precision: 5, scale: 1 }),
  skills: json("skills"),
  education: json("education"),
  resumeUrl: text("resumeUrl"),
  resumeKey: varchar("resumeKey", { length: 500 }),
  linkedinUrl: varchar("linkedinUrl", { length: 500 }),
  source: mysqlEnum("source", ["direct", "referral", "linkedin", "job_board", "career_portal", "agency", "other"]).default("direct").notNull(),
  status: mysqlEnum("status", ["active", "inactive", "blacklisted"]).default("active").notNull(),
  tags: json("tags"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = typeof candidates.$inferInsert;

// ─────────────────────────────────────────────
// APPLICATIONS
// ─────────────────────────────────────────────
export const applications = mysqlTable("applications", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  jobPostingId: int("jobPostingId").notNull(),
  candidateId: int("candidateId").notNull(),
  stage: mysqlEnum("stage", ["applied", "screening", "shortlisted", "test", "interview", "evaluation", "offer", "hired", "rejected", "withdrawn"]).default("applied").notNull(),
  status: mysqlEnum("status", ["active", "on_hold", "rejected", "withdrawn", "hired"]).default("active").notNull(),
  appliedAt: timestamp("appliedAt").defaultNow().notNull(),
  coverLetter: text("coverLetter"),
  expectedSalary: decimal("expectedSalary", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("AED"),
  referredBy: int("referredBy"),
  aiScreeningScore: int("aiScreeningScore"),
  aiScreeningReason: text("aiScreeningReason"),
  aiMatchScore: int("aiMatchScore"),
  aiMatchReason: text("aiMatchReason"),
  notes: text("notes"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;

// ─────────────────────────────────────────────
// APPLICATION STAGE HISTORY
// ─────────────────────────────────────────────
export const applicationStageHistory = mysqlTable("applicationStageHistory", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: int("applicationId").notNull(),
  fromStage: varchar("fromStage", { length: 50 }),
  toStage: varchar("toStage", { length: 50 }).notNull(),
  movedBy: int("movedBy"),
  movedAt: timestamp("movedAt").defaultNow().notNull(),
  notes: text("notes"),
});
export type ApplicationStageHistory = typeof applicationStageHistory.$inferSelect;
export type InsertApplicationStageHistory = typeof applicationStageHistory.$inferInsert;

// ─────────────────────────────────────────────
// EVALUATION TEMPLATES
// ─────────────────────────────────────────────
export const evaluationTemplates = mysqlTable("evaluationTemplates", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["test", "interview", "evaluation", "technical", "behavioral"]).default("interview").notNull(),
  description: text("description"),
  criteria: json("criteria"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EvaluationTemplate = typeof evaluationTemplates.$inferSelect;
export type InsertEvaluationTemplate = typeof evaluationTemplates.$inferInsert;

// ─────────────────────────────────────────────
// INTERVIEW SCHEDULES
// ─────────────────────────────────────────────
export const interviewSchedules = mysqlTable("interviewSchedules", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  applicationId: int("applicationId").notNull(),
  interviewerId: int("interviewerId").notNull(),
  templateId: int("templateId"),
  scheduledAt: timestamp("scheduledAt").notNull(),
  duration: int("duration").default(60).notNull(),
  type: mysqlEnum("type", ["phone", "video", "in_person", "technical", "panel"]).default("video").notNull(),
  location: varchar("location", { length: 500 }),
  meetingLink: varchar("meetingLink", { length: 1000 }),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled", "no_show", "rescheduled"]).default("scheduled").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type InterviewSchedule = typeof interviewSchedules.$inferSelect;
export type InsertInterviewSchedule = typeof interviewSchedules.$inferInsert;

// ─────────────────────────────────────────────
// INTERVIEW SCORECARDS
// ─────────────────────────────────────────────
export const interviewScorecards = mysqlTable("interviewScorecards", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  interviewScheduleId: int("interviewScheduleId").notNull(),
  applicationId: int("applicationId").notNull(),
  interviewerId: int("interviewerId").notNull(),
  ratings: json("ratings"),
  overallRating: int("overallRating"),
  recommendation: mysqlEnum("recommendation", ["strong_hire", "hire", "neutral", "no_hire", "strong_no_hire"]),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  notes: text("notes"),
  aiSummary: text("aiSummary"),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InterviewScorecard = typeof interviewScorecards.$inferSelect;
export type InsertInterviewScorecard = typeof interviewScorecards.$inferInsert;

// ─────────────────────────────────────────────
// OFFER LETTERS
// ─────────────────────────────────────────────
export const offerLetters = mysqlTable("offerLetters", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  applicationId: int("applicationId").notNull(),
  candidateId: int("candidateId").notNull(),
  jobPostingId: int("jobPostingId").notNull(),
  offeredSalary: decimal("offeredSalary", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("AED").notNull(),
  startDate: timestamp("startDate"),
  expiryDate: timestamp("expiryDate"),
  status: mysqlEnum("status", ["draft", "sent", "accepted", "rejected", "expired", "withdrawn"]).default("draft").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type OfferLetter = typeof offerLetters.$inferSelect;
export type InsertOfferLetter = typeof offerLetters.$inferInsert;

// ─────────────────────────────────────────────
// CAREER PORTAL SETTINGS
// ─────────────────────────────────────────────
export const careerPortalSettings = mysqlTable("careerPortalSettings", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  headline: varchar("headline", { length: 500 }),
  description: text("description"),
  logoUrl: text("logoUrl"),
  bannerUrl: text("bannerUrl"),
  primaryColor: varchar("primaryColor", { length: 20 }).default("#2563eb"),
  isActive: boolean("isActive").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CareerPortalSetting = typeof careerPortalSettings.$inferSelect;
export type InsertCareerPortalSetting = typeof careerPortalSettings.$inferInsert;

// ─────────────────────────────────────────────
// RECRUITMENT EMAIL TEMPLATES
// ─────────────────────────────────────────────
export const recruitmentEmailTemplates = mysqlTable("recruitmentEmailTemplates", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  trigger: mysqlEnum("trigger", ["application_received", "shortlisted", "interview_scheduled", "offer_sent", "rejected", "hired"]).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RecruitmentEmailTemplate = typeof recruitmentEmailTemplates.$inferSelect;
export type InsertRecruitmentEmailTemplate = typeof recruitmentEmailTemplates.$inferInsert;

// ─────────────────────────────────────────────
// AI SCREENING CONFIGS
// ─────────────────────────────────────────────
export const aiScreeningConfigs = mysqlTable("aiScreeningConfigs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  jobPostingId: int("jobPostingId").notNull(),
  mustHaveSkills: json("mustHaveSkills"),
  niceToHaveSkills: json("niceToHaveSkills"),
  minExperience: int("minExperience").default(0),
  maxExperience: int("maxExperience"),
  keywords: json("keywords"),
  biasCheckEnabled: boolean("biasCheckEnabled").default(true).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AiScreeningConfig = typeof aiScreeningConfigs.$inferSelect;
export type InsertAiScreeningConfig = typeof aiScreeningConfigs.$inferInsert;

// ─────────────────────────────────────────────
// CANDIDATE TAGS
// ─────────────────────────────────────────────
export const candidateTags = mysqlTable("candidateTags", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#6366f1").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CandidateTag = typeof candidateTags.$inferSelect;
export type InsertCandidateTag = typeof candidateTags.$inferInsert;

// ─────────────────────────────────────────────
// RECRUITMENT ACTIVITIES (audit trail)
// ─────────────────────────────────────────────
export const recruitmentActivities = mysqlTable("recruitmentActivities", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  applicationId: int("applicationId"),
  candidateId: int("candidateId"),
  jobPostingId: int("jobPostingId"),
  actorId: int("actorId"),
  action: varchar("action", { length: 100 }).notNull(),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RecruitmentActivity = typeof recruitmentActivities.$inferSelect;
export type InsertRecruitmentActivity = typeof recruitmentActivities.$inferInsert;

// ─────────────────────────────────────────────
// USER ROLES (many-to-many: user ↔ hcmRole)
// ─────────────────────────────────────────────
export const userRoles = mysqlTable("userRoles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  hcmRoleId: int("hcmRoleId").notNull(),
  companyId: int("companyId").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  assignedBy: int("assignedBy"),
  isActive: boolean("isActive").default(true).notNull(),
});
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = typeof userRoles.$inferInsert;

// ─────────────────────────────────────────────
// USER PERMISSION OVERRIDES (per-user exceptions)
// ─────────────────────────────────────────────
export const userPermissionOverrides = mysqlTable("userPermissionOverrides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyId: int("companyId").notNull(),
  module: varchar("module", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  granted: boolean("granted").notNull(),
  reason: text("reason"),
  grantedBy: int("grantedBy"),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});
export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
export type InsertUserPermissionOverride = typeof userPermissionOverrides.$inferInsert;

// ─────────────────────────────────────────────
// USER ACCESS PROFILES (data scope per user-role pair)
// ─────────────────────────────────────────────
export const userAccessProfiles = mysqlTable("userAccessProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyId: int("companyId").notNull(),
  hcmRoleId: int("hcmRoleId").notNull(),
  dataScope: mysqlEnum("dataScope", ["self", "reports", "department", "company", "custom"]).default("self").notNull(),
  scopeConfig: json("scopeConfig"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserAccessProfile = typeof userAccessProfiles.$inferSelect;
export type InsertUserAccessProfile = typeof userAccessProfiles.$inferInsert;

// ─────────────────────────────────────────────
// USER PROFILES (HCM-level user record, links Manus user → employee)
// ─────────────────────────────────────────────
export const userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId"),
  isActive: boolean("isActive").default(true).notNull(),
  inviteSentAt: timestamp("inviteSentAt"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

// ─────────────────────────────────────────────
// MODULE 7: PERFORMANCE MANAGEMENT
// ─────────────────────────────────────────────

// Appraisal Templates (managerial / non-managerial questionnaire definitions)
export const appraisalTemplates = mysqlTable("appraisalTemplates", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateType: mysqlEnum("templateType", ["managerial", "non_managerial", "universal"]).default("universal").notNull(),
  // Scoring policy: { scale: 5, labels: {1:"Poor",...}, passingScore: 3 }
  scoringPolicy: json("scoringPolicy"),
  // Increment policy: { bands: [{minScore:4.5,maxScore:5,incrementPct:15},{...}] }
  incrementPolicy: json("incrementPolicy"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AppraisalTemplate = typeof appraisalTemplates.$inferSelect;
export type InsertAppraisalTemplate = typeof appraisalTemplates.$inferInsert;

// Template Sections (KPI group / competency / questionnaire)
export const appraisalSections = mysqlTable("appraisalSections", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sectionType: mysqlEnum("sectionType", ["kpi", "competency", "questionnaire", "development"]).default("questionnaire").notNull(),
  weight: decimal("weight", { precision: 5, scale: 2 }).default("0"),
  displayOrder: int("displayOrder").default(0).notNull(),
  isRequired: boolean("isRequired").default(true).notNull(),
});
export type AppraisalSection = typeof appraisalSections.$inferSelect;
export type InsertAppraisalSection = typeof appraisalSections.$inferInsert;

// Questions within a section
export const appraisalQuestions = mysqlTable("appraisalQuestions", {
  id: int("id").autoincrement().primaryKey(),
  sectionId: int("sectionId").notNull(),
  questionText: text("questionText").notNull(),
  questionType: mysqlEnum("questionType", ["rating", "text", "yes_no", "multi_choice"]).default("rating").notNull(),
  raterType: mysqlEnum("raterType", ["self", "manager", "peer", "all"]).default("all").notNull(),
  weight: decimal("weight", { precision: 5, scale: 2 }).default("1"),
  options: json("options"), // for multi_choice: [{value, label}]
  isRequired: boolean("isRequired").default(true).notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
});
export type AppraisalQuestion = typeof appraisalQuestions.$inferSelect;
export type InsertAppraisalQuestion = typeof appraisalQuestions.$inferInsert;

// KPI Groups (role-specific or company-wide)
export const kpiGroups = mysqlTable("kpiGroups", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  designationId: int("designationId"), // null = applies to all roles
  departmentId: int("departmentId"),   // null = applies to all departments
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KpiGroup = typeof kpiGroups.$inferSelect;
export type InsertKpiGroup = typeof kpiGroups.$inferInsert;

// KPI Definitions within a group
export const kpiDefinitions = mysqlTable("kpiDefinitions", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  companyId: int("companyId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  measurementUnit: varchar("measurementUnit", { length: 100 }), // e.g. "%" or "AED" or "count"
  targetType: mysqlEnum("targetType", ["numeric", "percentage", "boolean", "text"]).default("numeric").notNull(),
  defaultTarget: varchar("defaultTarget", { length: 100 }),
  weight: decimal("weight", { precision: 5, scale: 2 }).default("1"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KpiDefinition = typeof kpiDefinitions.$inferSelect;
export type InsertKpiDefinition = typeof kpiDefinitions.$inferInsert;

// Appraisal Cycles (annual / mid-year / quarterly)
export const appraisalCycles = mysqlTable("appraisalCycles", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  periodLabel: varchar("periodLabel", { length: 100 }), // e.g. "H1 2025"
  cycleType: mysqlEnum("cycleType", ["annual", "mid_year", "quarterly", "probation", "custom"]).default("annual").notNull(),
  templateId: int("templateId").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  selfReviewDeadline: timestamp("selfReviewDeadline"),
  managerReviewDeadline: timestamp("managerReviewDeadline"),
  calibrationDeadline: timestamp("calibrationDeadline"),
  status: mysqlEnum("status", ["draft", "active", "self_review", "manager_review", "calibration", "completed", "archived"]).default("draft").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AppraisalCycle = typeof appraisalCycles.$inferSelect;
export type InsertAppraisalCycle = typeof appraisalCycles.$inferInsert;

// Cycle Participants (one row per employee per cycle)
export const cycleParticipants = mysqlTable("cycleParticipants", {
  id: int("id").autoincrement().primaryKey(),
  cycleId: int("cycleId").notNull(),
  employeeId: int("employeeId").notNull(),
  managerId: int("managerId"),
  status: mysqlEnum("status", ["pending", "self_submitted", "manager_submitted", "calibrated", "acknowledged"]).default("pending").notNull(),
  selfScore: decimal("selfScore", { precision: 5, scale: 2 }),
  managerScore: decimal("managerScore", { precision: 5, scale: 2 }),
  finalScore: decimal("finalScore", { precision: 5, scale: 2 }),
  incrementPercent: decimal("incrementPercent", { precision: 5, scale: 2 }),
  incrementAmount: decimal("incrementAmount", { precision: 12, scale: 2 }),
  managerNotes: text("managerNotes"),       // raw manager notes (input to AI)
  aiGeneratedReview: text("aiGeneratedReview"), // AI-polished review text
  finalReview: text("finalReview"),          // human-edited final review
  biasFlagsJson: json("biasFlagsJson"),      // AI bias detection results
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CycleParticipant = typeof cycleParticipants.$inferSelect;
export type InsertCycleParticipant = typeof cycleParticipants.$inferInsert;

// Participant KPIs (actual vs target per employee per cycle)
export const participantKpis = mysqlTable("participantKpis", {
  id: int("id").autoincrement().primaryKey(),
  participantId: int("participantId").notNull(),
  kpiDefinitionId: int("kpiDefinitionId"),  // null if custom KPI
  customTitle: varchar("customTitle", { length: 255 }), // for ad-hoc KPIs
  target: varchar("target", { length: 100 }),
  actual: varchar("actual", { length: 100 }),
  score: decimal("score", { precision: 5, scale: 2 }),
  weight: decimal("weight", { precision: 5, scale: 2 }).default("1"),
  notes: text("notes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ParticipantKpi = typeof participantKpis.$inferSelect;
export type InsertParticipantKpi = typeof participantKpis.$inferInsert;

// Evaluation Ratings (one row per question per rater per participant)
export const evaluationRatings = mysqlTable("evaluationRatings", {
  id: int("id").autoincrement().primaryKey(),
  participantId: int("participantId").notNull(),
  questionId: int("questionId").notNull(),
  raterId: int("raterId").notNull(),       // employeeId of the rater
  raterType: mysqlEnum("raterType", ["self", "manager", "peer"]).notNull(),
  ratingValue: varchar("ratingValue", { length: 100 }), // numeric or text
  ratingText: text("ratingText"),
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EvaluationRating = typeof evaluationRatings.$inferSelect;
export type InsertEvaluationRating = typeof evaluationRatings.$inferInsert;

// Performance Audit Log
export const performanceAuditLog = mysqlTable("performanceAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  actorId: int("actorId"),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: int("entityId"),
  action: varchar("action", { length: 100 }).notNull(),
  oldValue: json("oldValue"),
  newValue: json("newValue"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PerformanceAuditLog = typeof performanceAuditLog.$inferSelect;
export type InsertPerformanceAuditLog = typeof performanceAuditLog.$inferInsert;

// ─────────────────────────────────────────────
// COMPANY NEWS (ESS news feed)
// ─────────────────────────────────────────────
export const companyNews = mysqlTable("companyNews", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  summary: text("summary"),
  body: text("body"),
  category: mysqlEnum("category", ["announcement", "policy", "event", "achievement", "general"]).default("general").notNull(),
  isPinned: boolean("isPinned").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  targetAudience: mysqlEnum("targetAudience", ["all", "department", "role"]).default("all").notNull(),
  targetDepartmentId: int("targetDepartmentId"),
  imageUrl: text("imageUrl"),
  authorId: int("authorId"),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CompanyNews = typeof companyNews.$inferSelect;
export type InsertCompanyNews = typeof companyNews.$inferInsert;

// ─────────────────────────────────────────────
// HR POLICY DOCUMENTS (ESS policy library)
// ─────────────────────────────────────────────
export const hrPolicyDocs = mysqlTable("hrPolicyDocs", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", ["leave", "attendance", "code_of_conduct", "benefits", "payroll", "safety", "general"]).default("general").notNull(),
  fileKey: varchar("fileKey", { length: 500 }),
  fileUrl: text("fileUrl"),
  version: varchar("version", { length: 20 }).default("1.0"),
  isActive: boolean("isActive").default(true).notNull(),
  isMandatory: boolean("isMandatory").default(false).notNull(),
  uploadedBy: int("uploadedBy"),
  effectiveDate: timestamp("effectiveDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type HrPolicyDoc = typeof hrPolicyDocs.$inferSelect;
export type InsertHrPolicyDoc = typeof hrPolicyDocs.$inferInsert;

// ─────────────────────────────────────────────
// MODULE: EXPENSE CLAIMS
// ─────────────────────────────────────────────
export const expenseClaims = mysqlTable("expenseClaims", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  employeeId: int("employeeId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  category: mysqlEnum("category", [
    "travel", "accommodation", "meals", "transport", "office_supplies",
    "training", "client_entertainment", "medical", "other"
  ]).default("other").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("AED").notNull(),
  expenseDate: timestamp("expenseDate").notNull(),
  description: text("description"),
  receiptUrl: text("receiptUrl"),
  receiptKey: varchar("receiptKey", { length: 500 }),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "rejected", "paid"]).default("draft").notNull(),
  submittedAt: timestamp("submittedAt"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  rejectedReason: text("rejectedReason"),
  paidAt: timestamp("paidAt"),
  payrollRunId: int("payrollRunId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ExpenseClaim = typeof expenseClaims.$inferSelect;
export type InsertExpenseClaim = typeof expenseClaims.$inferInsert;
