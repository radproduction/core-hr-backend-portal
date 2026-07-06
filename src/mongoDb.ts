import mongoose, { Schema } from "mongoose";
import { ENV } from "./_core/env";
import { PREDEFINED_ROLES, DEFAULT_PERMISSIONS } from "./rbac";
import type {
  InsertAuditLog,
  InsertAttendanceAnomalyFlag,
  InsertAttendanceRecord,
  InsertCompanyNews,
  InsertBulkUploadJob,
  InsertCompensatoryLeave,
  InsertCompany,
  InsertDepartment,
  InsertDesignation,
  InsertEmployee,
  InsertEmployeeAsset,
  InsertEmployeeDocument,
  InsertEmployeeExit,
  InsertEmployeeTransfer,
  InsertEmploymentHistory,
  InsertExpenseClaim,
  InsertGeoFence,
  InsertHcmRole,
  InsertHrPolicyDoc,
  InsertLeaveAccrualLog,
  InsertLeaveApproval,
  InsertLeaveBalance,
  InsertLeaveCarryForwardLog,
  InsertLeavePolicy,
  InsertLeaveRequest,
  InsertLeaveType,
  InsertLocation,
  InsertNotification,
  InsertOvertimeRequest,
  InsertPayslip,
  InsertPunchImportJob,
  InsertRolePermission,
  InsertShift,
  InsertShiftRoster,
  InsertUser,
  InsertUserAccessProfile,
  InsertUserPermissionOverride,
  InsertUserProfile,
  InsertUserRole,
  InsertWorkflowInstance,
  InsertWorkflowInstanceStep,
  InsertWorkflowStep,
  InsertWorkflowTemplate,
} from "../drizzle/schema";

const enumFields = {
  role: ["user", "admin"],
  workflowApproverType: ["role", "specific_employee", "reporting_manager", "department_head"],
  workflowStatus: ["draft", "submitted", "pending", "approved", "rejected", "cancelled"],
  workflowStepStatus: ["pending", "approved", "rejected", "skipped"],
  notificationType: ["workflow", "system", "reminder", "announcement"],
  documentType: [
    "passport", "national_id", "visa", "work_permit", "driving_license",
    "degree", "certificate", "contract", "nda", "offer_letter",
    "appraisal", "warning_letter", "other",
  ],
  assetType: ["laptop", "mobile", "tablet", "vehicle", "access_card", "uniform", "tools", "other"],
  assetCondition: ["new", "good", "fair", "damaged", "lost"],
  assetStatus: ["assigned", "returned", "lost"],
  bulkUploadStatus: ["pending", "processing", "completed", "failed"],
  transferStatus: ["draft", "pending", "approved", "rejected", "executed"],
  exitType: ["resignation", "termination", "retirement", "end_of_contract", "redundancy", "death", "absconding"],
  exitStatus: ["initiated", "in_progress", "cleared", "completed"],
  employmentEventType: ["hired", "promoted", "transferred", "designation_change", "salary_change", "status_change", "confirmed", "exited"],
  userDataScope: ["self", "reports", "department", "company", "custom"],
  employeeGender: ["male", "female", "other", "prefer_not_to_say"],
  employeeMaritalStatus: ["single", "married", "divorced", "widowed"],
  employeeEmploymentType: ["full_time", "part_time", "contract", "intern", "probation"],
  employeeStatus: ["active", "inactive", "on_leave", "terminated", "resigned"],
  attendanceGeoFenceStatus: ["inside", "outside", "unknown"],
  attendanceStatus: ["present", "absent", "late", "early_leave", "half_day", "on_leave", "holiday", "weekend", "overtime"],
  attendanceSource: ["web", "mobile", "biometric", "csv_import", "manual"],
  overtimeStatus: ["pending", "approved", "rejected", "auto_approved"],
  punchImportSource: ["biometric", "csv", "excel", "api"],
  anomalyType: ["creeping_lateness", "geo_fence_violation", "buddy_punching", "unusual_pattern", "excessive_overtime", "irregular_hours"],
  anomalySeverity: ["low", "medium", "high"],
  anomalyStatus: ["pending_review", "reviewed_ok", "reviewed_action", "dismissed"],
  riskLevel: ["low", "medium", "high"],
  leaveAccrualType: ["none", "monthly", "yearly", "per_period"],
  leaveApplicableGender: ["all", "male", "female"],
  leaveApplicableTo: ["all", "department", "gender", "designation"],
  leaveRequestStatus: ["pending", "approved", "rejected", "cancelled", "withdrawn"],
  leaveHalfDayPeriod: ["morning", "afternoon"],
  leaveApprovalStatus: ["pending", "approved", "rejected"],
  compensatoryStatus: ["active", "used", "expired", "cancelled"],
  newsCategory: ["announcement", "policy", "event", "achievement", "general"],
  newsTargetAudience: ["all", "department", "role"],
  policyCategory: ["leave", "attendance", "code_of_conduct", "benefits", "payroll", "safety", "general"],
  expenseCategory: ["travel", "accommodation", "meals", "transport", "office_supplies", "training", "client_entertainment", "medical", "other"],
  expenseStatus: ["draft", "submitted", "approved", "rejected", "paid"],
  payslipStatus: ["draft", "approved", "disbursed"],
} as const;

const hasMongo = () => Boolean(ENV.mongoUrl);

const baseOptions = {
  versionKey: false,
  timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
};

const counterSchema = new Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
}, { versionKey: false });

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

const userSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  openId: { type: String, required: true, unique: true },
  name: String,
  email: { type: String, index: true },
  passwordHash: String,
  loginMethod: String,
  role: { type: String, enum: enumFields.role, default: "user" },
  lastSignedIn: { type: Date, default: Date.now },
}, baseOptions);

const companySchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  industry: String,
  country: String,
  currency: { type: String, default: "USD" },
  timezone: { type: String, default: "UTC" },
  logoUrl: String,
  address: String,
  phone: String,
  email: String,
  website: String,
  isActive: { type: Boolean, default: true },
}, baseOptions);

const locationSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  code: String,
  address: String,
  city: String,
  country: String,
  geoLat: String,
  geoLng: String,
  geoFenceRadius: { type: Number, default: 200 },
  isActive: { type: Boolean, default: true },
}, baseOptions);

const departmentSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  locationId: Number,
  parentId: Number,
  name: { type: String, required: true },
  code: String,
  headEmployeeId: Number,
  isActive: { type: Boolean, default: true },
}, baseOptions);

const designationSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  grade: String,
  level: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
}, baseOptions);

const hcmRoleSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  isPredefined: { type: Boolean, default: false },
  description: String,
  isActive: { type: Boolean, default: true },
}, baseOptions);

const rolePermissionSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  hcmRoleId: { type: Number, required: true, index: true },
  companyId: { type: Number, required: true, index: true },
  module: { type: String, required: true },
  canView: { type: Boolean, default: false },
  canCreate: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  canApprove: { type: Boolean, default: false },
  canExport: { type: Boolean, default: false },
}, baseOptions);

const employeeSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  userId: Number,
  employeeNumber: String,
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  displayName: String,
  gender: { type: String, enum: enumFields.employeeGender },
  dateOfBirth: Date,
  nationalId: String,
  nationality: String,
  maritalStatus: { type: String, enum: enumFields.employeeMaritalStatus },
  personalEmail: String,
  workEmail: String,
  personalPhone: String,
  workPhone: String,
  address: String,
  locationId: Number,
  departmentId: Number,
  designationId: Number,
  hcmRoleId: Number,
  reportsToId: Number,
  joinDate: Date,
  confirmationDate: Date,
  employmentType: { type: String, enum: enumFields.employeeEmploymentType, default: "full_time" },
  status: { type: String, enum: enumFields.employeeStatus, default: "active" },
  photoUrl: String,
  createdBy: Number,
}, baseOptions);

const workflowTemplateSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  requestType: { type: String, required: true },
  description: String,
  isActive: { type: Boolean, default: true },
  createdBy: Number,
}, baseOptions);

const workflowStepSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  templateId: { type: Number, required: true, index: true },
  companyId: { type: Number, required: true, index: true },
  stepOrder: { type: Number, required: true },
  stepName: { type: String, required: true },
  approverType: { type: String, enum: enumFields.workflowApproverType, required: true },
  approverRoleId: Number,
  approverEmployeeId: Number,
  isOptional: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const workflowInstanceSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  templateId: { type: Number, required: true },
  requestType: { type: String, required: true },
  requestedBy: { type: Number, required: true },
  title: { type: String, required: true },
  description: String,
  payload: Schema.Types.Mixed,
  status: { type: String, enum: enumFields.workflowStatus, default: "draft" },
  currentStepOrder: { type: Number, default: 1 },
  resolvedAt: Date,
}, baseOptions);

const workflowInstanceStepSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  instanceId: { type: Number, required: true, index: true },
  companyId: { type: Number, required: true, index: true },
  stepOrder: { type: Number, required: true },
  stepName: { type: String, required: true },
  assignedToEmployeeId: Number,
  assignedToRoleId: Number,
  status: { type: String, enum: enumFields.workflowStepStatus, default: "pending" },
  actionBy: Number,
  comment: String,
  actionAt: Date,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const notificationSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  recipientEmployeeId: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  body: String,
  type: { type: String, enum: enumFields.notificationType, default: "system" },
  referenceType: String,
  referenceId: Number,
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  readAt: Date,
}, { versionKey: false });

const auditLogSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  actorEmployeeId: Number,
  actorUserId: Number,
  actorName: String,
  action: { type: String, required: true },
  module: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: Number,
  entityLabel: String,
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const employeeDocumentSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  documentType: { type: String, enum: enumFields.documentType, required: true },
  title: { type: String, required: true },
  fileKey: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileSize: Number,
  mimeType: String,
  expiryDate: Date,
  isVerified: { type: Boolean, default: false },
  verifiedBy: Number,
  verifiedAt: Date,
  notes: String,
  uploadedBy: { type: Number, required: true },
}, baseOptions);

const employeeAssetSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  assetName: { type: String, required: true },
  assetType: { type: String, enum: enumFields.assetType, required: true },
  serialNumber: String,
  assetTag: String,
  assignedDate: { type: Date, required: true },
  returnDate: Date,
  condition: { type: String, enum: enumFields.assetCondition, default: "good" },
  conditionOnReturn: { type: String, enum: enumFields.assetCondition },
  notes: String,
  status: { type: String, enum: enumFields.assetStatus, default: "assigned" },
  assignedBy: { type: Number, required: true },
}, baseOptions);

const bulkUploadJobSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  uploadedBy: { type: Number, required: true },
  fileName: { type: String, required: true },
  fileKey: String,
  totalRows: { type: Number, default: 0 },
  successRows: { type: Number, default: 0 },
  errorRows: { type: Number, default: 0 },
  status: { type: String, enum: enumFields.bulkUploadStatus, default: "pending" },
  errorReport: Schema.Types.Mixed,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const employeeTransferSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  fromDepartmentId: Number,
  toDepartmentId: Number,
  fromLocationId: Number,
  toLocationId: Number,
  fromDesignationId: Number,
  toDesignationId: Number,
  fromReportsToId: Number,
  toReportsToId: Number,
  effectiveDate: { type: Date, required: true },
  reason: String,
  status: { type: String, enum: enumFields.transferStatus, default: "draft" },
  workflowInstanceId: Number,
  requestedBy: { type: Number, required: true },
  executedAt: Date,
}, baseOptions);

const employeeExitSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  exitType: { type: String, enum: enumFields.exitType, required: true },
  lastWorkingDay: { type: Date, required: true },
  noticeDate: Date,
  reason: String,
  checklistAssetsReturned: { type: Boolean, default: false },
  checklistAccessRevoked: { type: Boolean, default: false },
  checklistDocumentsHandedOver: { type: Boolean, default: false },
  checklistFinancialClearance: { type: Boolean, default: false },
  checklistExitInterviewDone: { type: Boolean, default: false },
  exitInterviewNotes: String,
  status: { type: String, enum: enumFields.exitStatus, default: "initiated" },
  workflowInstanceId: Number,
  initiatedBy: { type: Number, required: true },
  completedAt: Date,
}, baseOptions);

const employmentHistorySchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  eventType: { type: String, enum: enumFields.employmentEventType, required: true },
  description: String,
  effectiveDate: { type: Date, required: true },
  previousValue: Schema.Types.Mixed,
  newValue: Schema.Types.Mixed,
  recordedBy: Number,
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const userRoleSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  userId: { type: Number, required: true, index: true },
  hcmRoleId: { type: Number, required: true, index: true },
  companyId: { type: Number, required: true, index: true },
  assignedAt: { type: Date, default: Date.now },
  assignedBy: Number,
  isActive: { type: Boolean, default: true },
}, { versionKey: false });

const userPermissionOverrideSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  userId: { type: Number, required: true, index: true },
  companyId: { type: Number, required: true, index: true },
  module: { type: String, required: true },
  action: { type: String, required: true },
  granted: { type: Boolean, required: true },
  reason: String,
  grantedBy: Number,
  grantedAt: { type: Date, default: Date.now },
  expiresAt: Date,
}, { versionKey: false });

const userAccessProfileSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  userId: { type: Number, required: true, index: true },
  companyId: { type: Number, required: true, index: true },
  hcmRoleId: { type: Number, required: true, index: true },
  dataScope: { type: String, enum: enumFields.userDataScope, default: "self" },
  scopeConfig: Schema.Types.Mixed,
}, baseOptions);

const userProfileSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  userId: { type: Number, required: true, unique: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: Number,
  isActive: { type: Boolean, default: true },
  inviteSentAt: Date,
  lastLoginAt: Date,
}, baseOptions);

const geoFenceSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  locationId: Number,
  name: { type: String, required: true },
  lat: { type: String, required: true },
  lng: { type: String, required: true },
  radiusMeters: { type: Number, default: 200 },
  isActive: { type: Boolean, default: true },
  createdBy: Number,
}, baseOptions);

const shiftSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  graceMinutes: { type: Number, default: 0 },
  breakMinutes: { type: Number, default: 0 },
  isFlexible: { type: Boolean, default: false },
  isOvernight: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: Number,
}, baseOptions);

const shiftRosterSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  shiftId: Number,
  date: { type: Date, required: true, index: true },
  isRestDay: { type: Boolean, default: false },
  notes: String,
  createdBy: Number,
}, baseOptions);
shiftRosterSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });

const attendanceRecordSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  date: { type: Date, required: true, index: true },
  clockIn: Date,
  clockOut: Date,
  clockInLat: String,
  clockInLng: String,
  clockOutLat: String,
  clockOutLng: String,
  geoFenceId: Number,
  geoFenceStatus: { type: String, enum: enumFields.attendanceGeoFenceStatus, default: "unknown" },
  shiftId: Number,
  status: { type: String, enum: enumFields.attendanceStatus, default: "absent" },
  source: { type: String, enum: enumFields.attendanceSource, default: "web" },
  workMinutes: { type: Number, default: 0 },
  overtimeMinutes: { type: Number, default: 0 },
  lateMinutes: { type: Number, default: 0 },
  earlyLeaveMinutes: { type: Number, default: 0 },
  notes: String,
  correctedBy: Number,
}, baseOptions);
attendanceRecordSchema.index({ companyId: 1, employeeId: 1, date: 1 });

const overtimeRequestSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  attendanceRecordId: Number,
  date: { type: Date, required: true, index: true },
  requestedMinutes: { type: Number, required: true },
  approvedMinutes: Number,
  reason: String,
  status: { type: String, enum: enumFields.overtimeStatus, default: "pending" },
  approvedBy: Number,
  approvedAt: Date,
  workflowInstanceId: Number,
}, baseOptions);

const punchImportJobSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  fileName: { type: String, required: true },
  source: { type: String, enum: enumFields.punchImportSource, default: "csv" },
  totalRows: { type: Number, default: 0 },
  successRows: { type: Number, default: 0 },
  errorRows: { type: Number, default: 0 },
  errorReport: Schema.Types.Mixed,
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
  uploadedBy: Number,
}, baseOptions);

const attendanceAnomalyFlagSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  attendanceRecordId: Number,
  date: { type: Date, required: true, index: true },
  type: { type: String, enum: enumFields.anomalyType, required: true },
  severity: { type: String, enum: enumFields.anomalySeverity, default: "medium" },
  description: { type: String, required: true },
  aiReasoning: String,
  status: { type: String, enum: enumFields.anomalyStatus, default: "pending_review" },
  reviewedBy: Number,
  reviewedAt: Date,
  reviewNotes: String,
}, baseOptions);

const absenteeismPredictionSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  predictionDate: { type: Date, required: true },
  targetPeriodStart: { type: Date, required: true },
  targetPeriodEnd: { type: Date, required: true },
  riskScore: { type: Number, required: true },
  riskLevel: { type: String, enum: enumFields.riskLevel, required: true },
  factors: Schema.Types.Mixed,
  recommendation: String,
  generatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

const leaveTypeSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  description: String,
  isPaid: { type: Boolean, default: true },
  isCarryForward: { type: Boolean, default: false },
  maxCarryDays: { type: Number, default: 0 },
  accrualType: { type: String, enum: enumFields.leaveAccrualType, default: "none" },
  accrualRate: { type: String, default: "0.00" },
  maxBalance: { type: String, default: "0.00" },
  applicableGender: { type: String, enum: enumFields.leaveApplicableGender, default: "all" },
  requiresApproval: { type: Boolean, default: true },
  requiresDocument: { type: Boolean, default: false },
  minDaysNotice: { type: Number, default: 0 },
  maxConsecutiveDays: { type: Number, default: 0 },
  colorCode: { type: String, default: "#6366f1" },
  isActive: { type: Boolean, default: true },
}, baseOptions);

const leavePolicySchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  name: { type: String, required: true },
  leaveTypeId: { type: Number, required: true, index: true },
  applicableTo: { type: String, enum: enumFields.leaveApplicableTo, default: "all" },
  departmentId: Number,
  designationId: Number,
  gender: { type: String, enum: enumFields.leaveApplicableGender, default: "all" },
  entitlementDays: { type: String, required: true },
  prorateOnJoining: { type: Boolean, default: true },
  prorateOnExit: { type: Boolean, default: true },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: Date,
  isActive: { type: Boolean, default: true },
}, baseOptions);

const leaveBalanceSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  leaveTypeId: { type: Number, required: true, index: true },
  year: { type: Number, required: true, index: true },
  entitled: { type: String, default: "0.00" },
  used: { type: String, default: "0.00" },
  pending: { type: String, default: "0.00" },
  carryForward: { type: String, default: "0.00" },
  compensatory: { type: String, default: "0.00" },
  balance: { type: String, default: "0.00" },
}, baseOptions);
leaveBalanceSchema.index({ employeeId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

const leaveRequestSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  leaveTypeId: { type: Number, required: true, index: true },
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true, index: true },
  days: { type: String, required: true },
  isHalfDay: { type: Boolean, default: false },
  halfDayPeriod: { type: String, enum: enumFields.leaveHalfDayPeriod },
  reason: { type: String, required: true },
  aiDraftUsed: { type: Boolean, default: false },
  attachmentKey: String,
  status: { type: String, enum: enumFields.leaveRequestStatus, default: "pending" },
  appliedAt: { type: Date, default: Date.now },
  approvedBy: Number,
  approvedAt: Date,
  rejectedReason: String,
  cancelledAt: Date,
  cancelReason: String,
}, baseOptions);

const leaveApprovalSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  leaveRequestId: { type: Number, required: true, index: true },
  approverId: { type: Number, required: true, index: true },
  step: { type: Number, default: 1 },
  status: { type: String, enum: enumFields.leaveApprovalStatus, default: "pending" },
  comments: String,
  aiCoverageSummary: String,
  decidedAt: Date,
}, baseOptions);

const leaveAccrualLogSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  leaveTypeId: { type: Number, required: true, index: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  accrualDays: { type: String, required: true },
  balanceBefore: { type: String, required: true },
  balanceAfter: { type: String, required: true },
  notes: String,
  runAt: { type: Date, default: Date.now },
}, { versionKey: false });

const leaveCarryForwardLogSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  leaveTypeId: { type: Number, required: true, index: true },
  fromYear: { type: Number, required: true },
  toYear: { type: Number, required: true },
  balanceAtYearEnd: { type: String, required: true },
  carriedDays: { type: String, required: true },
  expiredDays: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
}, { versionKey: false });

const compensatoryLeaveSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  earnedDate: { type: Date, required: true },
  reason: { type: String, required: true },
  earnedDays: { type: String, required: true },
  usedDays: { type: String, default: "0.00" },
  expiryDate: Date,
  status: { type: String, enum: enumFields.compensatoryStatus, default: "active" },
  approvedBy: Number,
  linkedLeaveRequestId: Number,
}, baseOptions);

const payslipSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  payrollRunId: { type: Number, required: true },
  employeeId: { type: Number, required: true, index: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  basicSalary: { type: String, required: true },
  grossSalary: { type: String, required: true },
  totalEarnings: { type: String, required: true },
  totalDeductions: { type: String, required: true },
  taxAmount: { type: String, default: "0.00" },
  pfEmployee: { type: String, default: "0.00" },
  pfEmployer: { type: String, default: "0.00" },
  loanDeductions: { type: String, default: "0.00" },
  advanceDeductions: { type: String, default: "0.00" },
  lateDeductions: { type: String, default: "0.00" },
  absentDeductions: { type: String, default: "0.00" },
  netSalary: { type: String, required: true },
  currency: { type: String, default: "AED" },
  attendanceDays: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  components: Schema.Types.Mixed,
  status: { type: String, enum: enumFields.payslipStatus, default: "draft" },
  pdfKey: String,
}, baseOptions);

const companyNewsSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  summary: String,
  body: String,
  category: { type: String, enum: enumFields.newsCategory, default: "general" },
  isPinned: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  targetAudience: { type: String, enum: enumFields.newsTargetAudience, default: "all" },
  targetDepartmentId: Number,
  imageUrl: String,
  authorId: Number,
  publishedAt: { type: Date, default: Date.now },
  expiresAt: Date,
}, baseOptions);

const hrPolicyDocSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  description: String,
  category: { type: String, enum: enumFields.policyCategory, default: "general" },
  fileKey: String,
  fileUrl: String,
  version: { type: String, default: "1.0" },
  isActive: { type: Boolean, default: true },
  isMandatory: { type: Boolean, default: false },
  uploadedBy: Number,
  effectiveDate: Date,
}, baseOptions);

const expenseClaimSchema = new Schema({
  id: { type: Number, unique: true, index: true, required: true },
  companyId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  category: { type: String, enum: enumFields.expenseCategory, default: "other" },
  amount: { type: String, required: true },
  currency: { type: String, default: "AED" },
  expenseDate: { type: Date, required: true },
  description: String,
  receiptUrl: String,
  receiptKey: String,
  status: { type: String, enum: enumFields.expenseStatus, default: "draft" },
  submittedAt: Date,
  approvedBy: Number,
  approvedAt: Date,
  rejectedReason: String,
  paidAt: Date,
  payrollRunId: Number,
}, baseOptions);

const UserModel = mongoose.models.UserRecord || mongoose.model("UserRecord", userSchema);
const CompanyModel = mongoose.models.CompanyRecord || mongoose.model("CompanyRecord", companySchema);
const LocationModel = mongoose.models.LocationRecord || mongoose.model("LocationRecord", locationSchema);
const DepartmentModel = mongoose.models.DepartmentRecord || mongoose.model("DepartmentRecord", departmentSchema);
const DesignationModel = mongoose.models.DesignationRecord || mongoose.model("DesignationRecord", designationSchema);
const HcmRoleModel = mongoose.models.HcmRoleRecord || mongoose.model("HcmRoleRecord", hcmRoleSchema);
const RolePermissionModel = mongoose.models.RolePermissionRecord || mongoose.model("RolePermissionRecord", rolePermissionSchema);
const EmployeeModel = mongoose.models.EmployeeRecord || mongoose.model("EmployeeRecord", employeeSchema);
const WorkflowTemplateModel = mongoose.models.WorkflowTemplateRecord || mongoose.model("WorkflowTemplateRecord", workflowTemplateSchema);
const WorkflowStepModel = mongoose.models.WorkflowStepRecord || mongoose.model("WorkflowStepRecord", workflowStepSchema);
const WorkflowInstanceModel = mongoose.models.WorkflowInstanceRecord || mongoose.model("WorkflowInstanceRecord", workflowInstanceSchema);
const WorkflowInstanceStepModel = mongoose.models.WorkflowInstanceStepRecord || mongoose.model("WorkflowInstanceStepRecord", workflowInstanceStepSchema);
const NotificationModel = mongoose.models.NotificationRecord || mongoose.model("NotificationRecord", notificationSchema);
const AuditLogModel = mongoose.models.AuditLogRecord || mongoose.model("AuditLogRecord", auditLogSchema);
const EmployeeDocumentModel = mongoose.models.EmployeeDocumentRecord || mongoose.model("EmployeeDocumentRecord", employeeDocumentSchema);
const EmployeeAssetModel = mongoose.models.EmployeeAssetRecord || mongoose.model("EmployeeAssetRecord", employeeAssetSchema);
const BulkUploadJobModel = mongoose.models.BulkUploadJobRecord || mongoose.model("BulkUploadJobRecord", bulkUploadJobSchema);
const EmployeeTransferModel = mongoose.models.EmployeeTransferRecord || mongoose.model("EmployeeTransferRecord", employeeTransferSchema);
const EmployeeExitModel = mongoose.models.EmployeeExitRecord || mongoose.model("EmployeeExitRecord", employeeExitSchema);
const EmploymentHistoryModel = mongoose.models.EmploymentHistoryRecord || mongoose.model("EmploymentHistoryRecord", employmentHistorySchema);
const UserRoleModel = mongoose.models.UserRoleRecord || mongoose.model("UserRoleRecord", userRoleSchema);
const UserPermissionOverrideModel = mongoose.models.UserPermissionOverrideRecord || mongoose.model("UserPermissionOverrideRecord", userPermissionOverrideSchema);
const UserAccessProfileModel = mongoose.models.UserAccessProfileRecord || mongoose.model("UserAccessProfileRecord", userAccessProfileSchema);
const UserProfileModel = mongoose.models.UserProfileRecord || mongoose.model("UserProfileRecord", userProfileSchema);
const GeoFenceModel = mongoose.models.GeoFenceRecord || mongoose.model("GeoFenceRecord", geoFenceSchema);
const ShiftModel = mongoose.models.ShiftRecord || mongoose.model("ShiftRecord", shiftSchema);
const ShiftRosterModel = mongoose.models.ShiftRosterRecord || mongoose.model("ShiftRosterRecord", shiftRosterSchema);
const AttendanceRecordModel = mongoose.models.AttendanceRecord || mongoose.model("AttendanceRecord", attendanceRecordSchema);
const OvertimeRequestModel = mongoose.models.OvertimeRequestRecord || mongoose.model("OvertimeRequestRecord", overtimeRequestSchema);
const PunchImportJobModel = mongoose.models.PunchImportJobRecord || mongoose.model("PunchImportJobRecord", punchImportJobSchema);
const AttendanceAnomalyFlagModel = mongoose.models.AttendanceAnomalyFlagRecord || mongoose.model("AttendanceAnomalyFlagRecord", attendanceAnomalyFlagSchema);
const AbsenteeismPredictionModel = mongoose.models.AbsenteeismPredictionRecord || mongoose.model("AbsenteeismPredictionRecord", absenteeismPredictionSchema);
const LeaveTypeModel = mongoose.models.LeaveTypeRecord || mongoose.model("LeaveTypeRecord", leaveTypeSchema);
const LeavePolicyModel = mongoose.models.LeavePolicyRecord || mongoose.model("LeavePolicyRecord", leavePolicySchema);
const LeaveBalanceModel = mongoose.models.LeaveBalanceRecord || mongoose.model("LeaveBalanceRecord", leaveBalanceSchema);
const LeaveRequestModel = mongoose.models.LeaveRequestRecord || mongoose.model("LeaveRequestRecord", leaveRequestSchema);
const LeaveApprovalModel = mongoose.models.LeaveApprovalRecord || mongoose.model("LeaveApprovalRecord", leaveApprovalSchema);
const LeaveAccrualLogModel = mongoose.models.LeaveAccrualLogRecord || mongoose.model("LeaveAccrualLogRecord", leaveAccrualLogSchema);
const LeaveCarryForwardLogModel = mongoose.models.LeaveCarryForwardLogRecord || mongoose.model("LeaveCarryForwardLogRecord", leaveCarryForwardLogSchema);
const CompensatoryLeaveModel = mongoose.models.CompensatoryLeaveRecord || mongoose.model("CompensatoryLeaveRecord", compensatoryLeaveSchema);
const PayslipModel = mongoose.models.PayslipRecord || mongoose.model("PayslipRecord", payslipSchema);
const CompanyNewsModel = mongoose.models.CompanyNewsRecord || mongoose.model("CompanyNewsRecord", companyNewsSchema);
const HrPolicyDocModel = mongoose.models.HrPolicyDocRecord || mongoose.model("HrPolicyDocRecord", hrPolicyDocSchema);
const ExpenseClaimModel = mongoose.models.ExpenseClaimRecord || mongoose.model("ExpenseClaimRecord", expenseClaimSchema);

export async function ensureMongoReady() {
  if (!hasMongo()) {
    throw new Error("MONGODB_URI is not configured");
  }
  if (mongoose.connection.readyState === 1) {
    return;
  }
  await mongoose.connect(ENV.mongoUrl);
}

export async function nextId(key: string) {
  await ensureMongoReady();
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return counter.seq;
}

export function toPlain<T>(value: T | null | undefined): T | null {
  if (!value) return null;
  return JSON.parse(JSON.stringify(value));
}

function withDefaults<T extends Record<string, unknown>>(data: T, defaults: Partial<T>) {
  return { ...defaults, ...data };
}

async function createWithNumericId<T extends Record<string, unknown>>(model: mongoose.Model<any>, key: string, data: T) {
  const id = await nextId(key);
  await model.create({ id, ...data });
  return id;
}

async function seedPredefinedRoles(companyId: number) {
  await ensureMongoReady();
  const existingCount = await HcmRoleModel.countDocuments({ companyId });
  if (existingCount > 0) return;
  for (const role of PREDEFINED_ROLES) {
    const roleId = await createWithNumericId(HcmRoleModel, "hcmRoles", {
      companyId,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isPredefined: true,
      isActive: true,
    });
    const defaults = DEFAULT_PERMISSIONS[role.slug];
    if (!defaults) continue;
    for (const [moduleName, permissions] of Object.entries(defaults)) {
      await createWithNumericId(RolePermissionModel, "rolePermissions", {
        hcmRoleId: roleId,
        companyId,
        module: moduleName,
        canView: Boolean(permissions?.view),
        canCreate: Boolean(permissions?.create),
        canEdit: Boolean(permissions?.edit),
        canDelete: Boolean(permissions?.delete),
        canApprove: Boolean(permissions?.approve),
        canExport: Boolean(permissions?.export),
      });
    }
  }
}

export function isMongoPrimary() {
  return hasMongo();
}

export async function upsertUser(user: InsertUser) {
  await ensureMongoReady();
  const existing = await UserModel.findOne({ openId: user.openId }).lean();
  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : existing?.role ?? "user");
  if (existing) {
    await UserModel.updateOne(
      { openId: user.openId },
      {
        $set: {
          ...(user.name !== undefined ? { name: user.name ?? null } : {}),
          ...(user.email !== undefined ? { email: user.email ?? null } : {}),
          ...(user.loginMethod !== undefined ? { loginMethod: user.loginMethod ?? null } : {}),
          ...(user.lastSignedIn !== undefined ? { lastSignedIn: user.lastSignedIn } : {}),
          role,
        },
      }
    );
    return;
  }
  await UserModel.create({
    id: await nextId("users"),
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    lastSignedIn: user.lastSignedIn ?? new Date(),
    role,
  });
}

export async function getUserByOpenId(openId: string): Promise<any | null> {
  await ensureMongoReady();
  return toPlain(await UserModel.findOne({ openId }).lean());
}

export async function getUserById(id: number): Promise<any | null> {
  await ensureMongoReady();
  return toPlain(await UserModel.findOne({ id }).lean());
}

// ─── Native auth (email/password + OAuth providers) ─────────────────────────

/** Case-insensitive lookup by email. Returns the raw doc (includes passwordHash). */
export async function getUserByEmail(email: string): Promise<any | null> {
  await ensureMongoReady();
  const normalized = email.trim().toLowerCase();
  return UserModel.findOne({ email: normalized }).lean();
}

/** Count users — used to make the very first registered user an admin. */
export async function countUsers(): Promise<number> {
  await ensureMongoReady();
  return UserModel.countDocuments({});
}

/**
 * Create an email/password user. openId is derived as `local:<email>`.
 * Pass role explicitly, or the first-ever user + OWNER_OPEN_ID match becomes admin.
 */
export async function createLocalUser(input: {
  name?: string | null;
  email: string;
  passwordHash: string;
  role?: "user" | "admin";
}): Promise<any> {
  await ensureMongoReady();
  const email = input.email.trim().toLowerCase();
  const openId = `local:${email}`;
  const isFirst = (await UserModel.countDocuments({})) === 0;
  const role = input.role ?? (isFirst ? "admin" : "user");
  const id = await nextId("users");
  await UserModel.create({
    id,
    openId,
    name: input.name ?? null,
    email,
    passwordHash: input.passwordHash,
    loginMethod: "password",
    role,
    lastSignedIn: new Date(),
  });
  return toPlain(await UserModel.findOne({ openId }).lean());
}

/**
 * Upsert a user authenticated via an external OAuth provider (e.g. Google).
 * openId is `<provider>:<providerUserId>`.
 */
export async function upsertOAuthUser(input: {
  provider: string;
  providerUserId: string;
  name?: string | null;
  email?: string | null;
}): Promise<any> {
  await ensureMongoReady();
  const openId = `${input.provider}:${input.providerUserId}`;
  const email = input.email ? input.email.trim().toLowerCase() : null;
  const existing = await UserModel.findOne({ openId }).lean();
  const isFirst = (await UserModel.countDocuments({})) === 0;
  const role = existing?.role ?? (isFirst || openId === ENV.ownerOpenId ? "admin" : "user");
  if (existing) {
    await UserModel.updateOne(
      { openId },
      { $set: { name: input.name ?? existing.name ?? null, email: email ?? existing.email ?? null, loginMethod: input.provider, lastSignedIn: new Date(), role } }
    );
  } else {
    await UserModel.create({
      id: await nextId("users"),
      openId,
      name: input.name ?? null,
      email,
      loginMethod: input.provider,
      role,
      lastSignedIn: new Date(),
    });
  }
  return toPlain(await UserModel.findOne({ openId }).lean());
}

export async function touchUserSignIn(openId: string): Promise<void> {
  await ensureMongoReady();
  await UserModel.updateOne({ openId }, { $set: { lastSignedIn: new Date() } });
}

export async function getCompanies(): Promise<any[]> {
  await ensureMongoReady();
  return CompanyModel.find({ isActive: true }).sort({ name: 1 }).lean();
}

export async function getCompanyById(id: number): Promise<any | null> {
  await ensureMongoReady();
  return toPlain(await CompanyModel.findOne({ id }).lean());
}

export async function createCompany(data: InsertCompany) {
  await ensureMongoReady();
  const id = await createWithNumericId(CompanyModel, "companies", withDefaults(data, {
    currency: "USD",
    timezone: "UTC",
    isActive: true,
  }));
  await seedPredefinedRoles(id);
}

export async function updateCompany(id: number, data: Partial<InsertCompany>) {
  await ensureMongoReady();
  await CompanyModel.updateOne({ id }, { $set: data });
}

export async function getLocations(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return LocationModel.find({ companyId, isActive: true }).sort({ name: 1 }).lean();
}

export async function createLocation(data: InsertLocation) {
  await ensureMongoReady();
  await createWithNumericId(LocationModel, "locations", withDefaults(data, { isActive: true, geoFenceRadius: 200 }));
}

export async function updateLocation(id: number, companyId: number, data: Partial<InsertLocation>) {
  await ensureMongoReady();
  await LocationModel.updateOne({ id, companyId }, { $set: data });
}

export async function getDepartments(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return DepartmentModel.find({ companyId, isActive: true }).sort({ name: 1 }).lean();
}

export async function createDepartment(data: InsertDepartment) {
  await ensureMongoReady();
  await createWithNumericId(DepartmentModel, "departments", withDefaults(data, { isActive: true }));
}

export async function updateDepartment(id: number, companyId: number, data: Partial<InsertDepartment>) {
  await ensureMongoReady();
  await DepartmentModel.updateOne({ id, companyId }, { $set: data });
}

export async function getDesignations(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return DesignationModel.find({ companyId, isActive: true }).sort({ level: 1, name: 1 }).lean();
}

export async function createDesignation(data: InsertDesignation) {
  await ensureMongoReady();
  await createWithNumericId(DesignationModel, "designations", withDefaults(data, { isActive: true, level: 1 }));
}

export async function updateDesignation(id: number, companyId: number, data: Partial<InsertDesignation>) {
  await ensureMongoReady();
  await DesignationModel.updateOne({ id, companyId }, { $set: data });
}

export async function getHcmRoles(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  await seedPredefinedRoles(companyId);
  return HcmRoleModel.find({ companyId, isActive: true }).sort({ isPredefined: -1, name: 1 }).lean();
}

export async function createHcmRole(data: InsertHcmRole) {
  await ensureMongoReady();
  await createWithNumericId(HcmRoleModel, "hcmRoles", withDefaults(data, { isActive: true, isPredefined: false }));
}

export async function getRolePermissions(hcmRoleId: number, companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return RolePermissionModel.find({ hcmRoleId, companyId }).sort({ module: 1 }).lean();
}

export async function upsertRolePermission(data: InsertRolePermission) {
  await ensureMongoReady();
  const existing = await RolePermissionModel.findOne({
    hcmRoleId: data.hcmRoleId,
    companyId: data.companyId,
    module: data.module,
  }).lean();
  if (existing) {
    await RolePermissionModel.updateOne({ id: existing.id }, { $set: data });
    return;
  }
  await createWithNumericId(RolePermissionModel, "rolePermissions", data);
}

export async function getEmployees(companyId: number, filters?: { departmentId?: number; locationId?: number; status?: string }): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (filters?.departmentId) query.departmentId = filters.departmentId;
  if (filters?.locationId) query.locationId = filters.locationId;
  if (filters?.status) query.status = filters.status;
  const [rows, depts, desigs] = await Promise.all([
    EmployeeModel.find(query).sort({ firstName: 1, lastName: 1 }).lean(),
    DepartmentModel.find({ companyId }).lean(),
    DesignationModel.find({ companyId }).lean(),
  ]);
  const deptMap = new Map(depts.map((item: any) => [item.id, item.name]));
  const desigMap = new Map(desigs.map((item: any) => [item.id, item.name]));
  return rows.map((employee: any) => ({
    ...employee,
    departmentName: employee.departmentId ? (deptMap.get(employee.departmentId) ?? null) : null,
    designationName: employee.designationId ? (desigMap.get(employee.designationId) ?? null) : null,
  }));
}

export async function getEmployeeById(id: number, companyId: number): Promise<any | undefined> {
  await ensureMongoReady();
  const [employee, depts, desigs, locations, managers] = await Promise.all([
    EmployeeModel.findOne({ id, companyId }).lean(),
    DepartmentModel.find({ companyId }).lean(),
    DesignationModel.find({ companyId }).lean(),
    LocationModel.find({ companyId }).lean(),
    EmployeeModel.find({ companyId }).lean(),
  ]);
  if (!employee) return undefined;
  const deptMap = new Map(depts.map((item: any) => [item.id, item.name]));
  const desigMap = new Map(desigs.map((item: any) => [item.id, item.name]));
  const locationMap = new Map(locations.map((item: any) => [item.id, item.name]));
  const managerMap = new Map(managers.map((item: any) => [item.id, `${item.firstName} ${item.lastName}`]));
  return {
    ...employee,
    departmentName: employee.departmentId ? (deptMap.get(employee.departmentId) ?? null) : null,
    designationName: employee.designationId ? (desigMap.get(employee.designationId) ?? null) : null,
    locationName: employee.locationId ? (locationMap.get(employee.locationId) ?? null) : null,
    reportsToName: employee.reportsToId ? (managerMap.get(employee.reportsToId) ?? null) : null,
  };
}

export async function createEmployee(data: InsertEmployee) {
  await ensureMongoReady();
  const id = await createWithNumericId(EmployeeModel, "employees", withDefaults(data, {
    employmentType: "full_time",
    status: "active",
  }));
  return { id };
}

export async function updateEmployee(id: number, companyId: number, data: Partial<InsertEmployee>) {
  await ensureMongoReady();
  await EmployeeModel.updateOne({ id, companyId }, { $set: data });
}

export async function getHeadcountStats(companyId: number) {
  await ensureMongoReady();
  const employees = await EmployeeModel.find({ companyId }).lean();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    total: employees.length,
    active: employees.filter((item: any) => item.status === "active").length,
    onLeave: employees.filter((item: any) => item.status === "on_leave").length,
    newThisMonth: employees.filter((item: any) => item.joinDate && new Date(item.joinDate) >= monthStart).length,
  };
}

export async function getWorkflowTemplates(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return WorkflowTemplateModel.find({ companyId, isActive: true }).sort({ name: 1 }).lean();
}

export async function createWorkflowTemplate(data: InsertWorkflowTemplate) {
  await ensureMongoReady();
  await createWithNumericId(WorkflowTemplateModel, "workflowTemplates", withDefaults(data, { isActive: true }));
}

export async function getWorkflowSteps(templateId: number, companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return WorkflowStepModel.find({ templateId, companyId }).sort({ stepOrder: 1 }).lean();
}

export async function createWorkflowStep(data: InsertWorkflowStep) {
  await ensureMongoReady();
  await createWithNumericId(WorkflowStepModel, "workflowSteps", withDefaults(data, { isOptional: false }));
}

export async function getWorkflowInstances(companyId: number, filters?: { requestedBy?: number; status?: string; requestType?: string }): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (filters?.requestedBy) query.requestedBy = filters.requestedBy;
  if (filters?.status) query.status = filters.status;
  if (filters?.requestType) query.requestType = filters.requestType;
  return WorkflowInstanceModel.find(query).sort({ createdAt: -1 }).lean();
}

export async function getWorkflowInstanceById(id: number, companyId: number): Promise<any | undefined> {
  await ensureMongoReady();
  return toPlain(await WorkflowInstanceModel.findOne({ id, companyId }).lean()) ?? undefined;
}

export async function createWorkflowInstance(data: InsertWorkflowInstance) {
  await ensureMongoReady();
  await createWithNumericId(WorkflowInstanceModel, "workflowInstances", withDefaults(data, {
    status: "draft",
    currentStepOrder: 1,
  }));
}

export async function updateWorkflowInstance(id: number, companyId: number, data: Partial<InsertWorkflowInstance>) {
  await ensureMongoReady();
  await WorkflowInstanceModel.updateOne({ id, companyId }, { $set: data });
}

export async function getWorkflowInstanceSteps(instanceId: number, companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return WorkflowInstanceStepModel.find({ instanceId, companyId }).sort({ stepOrder: 1 }).lean();
}

export async function createWorkflowInstanceStep(data: InsertWorkflowInstanceStep) {
  await ensureMongoReady();
  await createWithNumericId(WorkflowInstanceStepModel, "workflowInstanceSteps", withDefaults(data, { status: "pending" }));
}

export async function updateWorkflowInstanceStep(id: number, data: Partial<InsertWorkflowInstanceStep>) {
  await ensureMongoReady();
  await WorkflowInstanceStepModel.updateOne({ id }, { $set: data });
}

export async function getPendingApprovalsCount(companyId: number) {
  await ensureMongoReady();
  return WorkflowInstanceModel.countDocuments({ companyId, status: "pending" });
}

export async function getNotifications(recipientEmployeeId: number, companyId: number, limit = 20): Promise<any[]> {
  await ensureMongoReady();
  return NotificationModel.find({ recipientEmployeeId, companyId }).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function getUnreadNotificationCount(recipientEmployeeId: number, companyId: number) {
  await ensureMongoReady();
  return NotificationModel.countDocuments({ recipientEmployeeId, companyId, isRead: false });
}

export async function createNotification(data: InsertNotification) {
  await ensureMongoReady();
  await createWithNumericId(NotificationModel, "notifications", withDefaults(data, { isRead: false, type: "system" }));
}

export async function markNotificationRead(id: number, recipientEmployeeId: number) {
  await ensureMongoReady();
  await NotificationModel.updateOne({ id, recipientEmployeeId }, { $set: { isRead: true, readAt: new Date() } });
}

export async function markAllNotificationsRead(recipientEmployeeId: number, companyId: number) {
  await ensureMongoReady();
  await NotificationModel.updateMany({ recipientEmployeeId, companyId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
}

export async function createAuditLog(data: InsertAuditLog) {
  await ensureMongoReady();
  await createWithNumericId(AuditLogModel, "auditLogs", data);
}

export async function getAuditLogs(companyId: number, filters?: { module?: string; actorEmployeeId?: number; limit?: number }): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (filters?.module) query.module = filters.module;
  if (filters?.actorEmployeeId) query.actorEmployeeId = filters.actorEmployeeId;
  return AuditLogModel.find(query).sort({ createdAt: -1 }).limit(filters?.limit ?? 100).lean();
}

export async function getEmployeeDocuments(employeeId: number, companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return EmployeeDocumentModel.find({ employeeId, companyId }).sort({ createdAt: -1 }).lean();
}

export async function createEmployeeDocument(data: InsertEmployeeDocument) {
  await ensureMongoReady();
  return EmployeeDocumentModel.create({ id: await nextId("employeeDocuments"), ...data, isVerified: false });
}

export async function updateEmployeeDocument(id: number, companyId: number, data: Partial<InsertEmployeeDocument>) {
  await ensureMongoReady();
  await EmployeeDocumentModel.updateOne({ id, companyId }, { $set: data });
}

export async function deleteEmployeeDocument(id: number, companyId: number) {
  await ensureMongoReady();
  await EmployeeDocumentModel.deleteOne({ id, companyId });
}

export async function getExpiringDocuments(companyId: number, daysAhead = 30): Promise<any[]> {
  await ensureMongoReady();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  return EmployeeDocumentModel.find({
    companyId,
    expiryDate: { $gte: new Date(), $lte: cutoff },
  }).sort({ expiryDate: 1 }).lean();
}

export async function getEmployeeAssets(employeeId: number, companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return EmployeeAssetModel.find({ employeeId, companyId }).sort({ assignedDate: -1 }).lean();
}

export async function getAllAssets(companyId: number, status?: string): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (status) query.status = status;
  return EmployeeAssetModel.find(query).sort({ assignedDate: -1 }).lean();
}

export async function createEmployeeAsset(data: InsertEmployeeAsset) {
  await ensureMongoReady();
  return EmployeeAssetModel.create({ id: await nextId("employeeAssets"), ...data, status: data.status ?? "assigned" });
}

export async function updateEmployeeAsset(id: number, companyId: number, data: Partial<InsertEmployeeAsset>) {
  await ensureMongoReady();
  await EmployeeAssetModel.updateOne({ id, companyId }, { $set: data });
}

export async function createBulkUploadJob(data: InsertBulkUploadJob) {
  await ensureMongoReady();
  return BulkUploadJobModel.create({
    id: await nextId("bulkUploadJobs"),
    ...data,
    totalRows: data.totalRows ?? 0,
    successRows: data.successRows ?? 0,
    errorRows: data.errorRows ?? 0,
    status: data.status ?? "pending",
  });
}

export async function updateBulkUploadJob(id: number, data: Partial<InsertBulkUploadJob>) {
  await ensureMongoReady();
  await BulkUploadJobModel.updateOne({ id }, { $set: data });
}

export async function getBulkUploadJobs(companyId: number, limit = 20): Promise<any[]> {
  await ensureMongoReady();
  return BulkUploadJobModel.find({ companyId }).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function getBulkUploadJobById(id: number, companyId: number): Promise<any | undefined> {
  await ensureMongoReady();
  return toPlain(await BulkUploadJobModel.findOne({ id, companyId }).lean()) ?? undefined;
}

export async function getEmployeeTransfers(companyId: number, employeeId?: number): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (employeeId) query.employeeId = employeeId;
  return EmployeeTransferModel.find(query).sort({ createdAt: -1 }).lean();
}

export async function createEmployeeTransfer(data: InsertEmployeeTransfer) {
  await ensureMongoReady();
  return EmployeeTransferModel.create({ id: await nextId("employeeTransfers"), ...data, status: data.status ?? "draft" });
}

export async function updateEmployeeTransfer(id: number, companyId: number, data: Partial<InsertEmployeeTransfer>) {
  await ensureMongoReady();
  await EmployeeTransferModel.updateOne({ id, companyId }, { $set: data });
}

export async function getEmployeeExits(companyId: number, employeeId?: number): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (employeeId) query.employeeId = employeeId;
  return EmployeeExitModel.find(query).sort({ createdAt: -1 }).lean();
}

export async function createEmployeeExit(data: InsertEmployeeExit) {
  await ensureMongoReady();
  return EmployeeExitModel.create({ id: await nextId("employeeExits"), ...data, status: data.status ?? "initiated" });
}

export async function updateEmployeeExit(id: number, companyId: number, data: Partial<InsertEmployeeExit>) {
  await ensureMongoReady();
  await EmployeeExitModel.updateOne({ id, companyId }, { $set: data });
}

export async function getEmploymentHistory(employeeId: number, companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return EmploymentHistoryModel.find({ employeeId, companyId }).sort({ effectiveDate: -1 }).lean();
}

export async function createEmploymentHistory(data: InsertEmploymentHistory) {
  await ensureMongoReady();
  return EmploymentHistoryModel.create({ id: await nextId("employmentHistory"), ...data });
}

export async function getEmployeeReportData(companyId: number, filters?: {
  departmentId?: number;
  locationId?: number;
  status?: string;
  employmentType?: string;
}): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (filters?.departmentId) query.departmentId = filters.departmentId;
  if (filters?.locationId) query.locationId = filters.locationId;
  if (filters?.status) query.status = filters.status;
  if (filters?.employmentType) query.employmentType = filters.employmentType;
  return EmployeeModel.find(query).sort({ firstName: 1, lastName: 1 }).lean();
}

export async function getTurnoverStats(companyId: number, year: number) {
  await ensureMongoReady();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const [exits, joiners] = await Promise.all([
    EmployeeExitModel.find({ companyId, lastWorkingDay: { $gte: yearStart, $lte: yearEnd } }).lean(),
    EmployeeModel.find({ companyId, joinDate: { $gte: yearStart, $lte: yearEnd } }).lean(),
  ]);
  return { exits: exits.length, newJoiners: joiners.length };
}

export async function getUpcomingBirthdays(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return EmployeeModel.find({ companyId, status: "active" }).lean();
}

export async function getUpcomingAnniversaries(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return EmployeeModel.find({ companyId, status: "active" }).lean();
}

export async function listGeoFences(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return GeoFenceModel.find({ companyId }).sort({ name: 1 }).lean();
}

export async function createGeoFence(data: InsertGeoFence) {
  await ensureMongoReady();
  return createWithNumericId(GeoFenceModel, "geoFences", withDefaults(data, { isActive: true }));
}

export async function updateGeoFence(id: number, data: Partial<InsertGeoFence>) {
  await ensureMongoReady();
  await GeoFenceModel.updateOne({ id }, { $set: data });
}

export async function deleteGeoFence(id: number) {
  await ensureMongoReady();
  await GeoFenceModel.updateOne({ id }, { $set: { isActive: false } });
}

export async function listShifts(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return ShiftModel.find({ companyId, isActive: true }).sort({ name: 1 }).lean();
}

export async function createShift(data: InsertShift) {
  await ensureMongoReady();
  return createWithNumericId(ShiftModel, "shifts", withDefaults(data, {
    graceMinutes: 0,
    breakMinutes: 0,
    isFlexible: false,
    isOvernight: false,
    isActive: true,
  }));
}

export async function updateShift(id: number, data: Partial<InsertShift>) {
  await ensureMongoReady();
  await ShiftModel.updateOne({ id }, { $set: data });
}

export async function deleteShift(id: number) {
  await ensureMongoReady();
  await ShiftModel.updateOne({ id }, { $set: { isActive: false } });
}

export async function getRosterForDateRange(companyId: number, startDate: Date, endDate: Date): Promise<any[]> {
  await ensureMongoReady();
  return ShiftRosterModel.find({
    companyId,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: 1 }).lean();
}

export async function upsertRosterEntry(data: InsertShiftRoster) {
  await ensureMongoReady();
  await ShiftRosterModel.updateOne(
    { companyId: data.companyId, employeeId: data.employeeId, date: data.date },
    { $set: data },
    { upsert: true }
  );
}

export async function bulkAssignRoster(entries: InsertShiftRoster[]) {
  await ensureMongoReady();
  for (const entry of entries) {
    await upsertRosterEntry(entry);
  }
}

export async function getAttendanceRecord(employeeId: number, date: Date): Promise<any | undefined> {
  await ensureMongoReady();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return (await AttendanceRecordModel.findOne({
    employeeId,
    date: { $gte: dayStart, $lte: dayEnd },
  }).lean()) ?? undefined;
}

export async function clockIn(data: InsertAttendanceRecord) {
  await ensureMongoReady();
  return createWithNumericId(AttendanceRecordModel, "attendanceRecords", withDefaults(data, {
    status: "absent",
    source: "web",
    workMinutes: 0,
    overtimeMinutes: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    geoFenceStatus: "unknown",
  }));
}

export async function clockOut(
  id: number,
  clockOut: Date,
  lat: string | null,
  lng: string | null,
  workMinutes: number,
  overtimeMinutes: number,
  earlyLeaveMinutes: number,
  status: string,
) {
  await ensureMongoReady();
  await AttendanceRecordModel.updateOne({ id }, {
    $set: {
      clockOut,
      clockOutLat: lat,
      clockOutLng: lng,
      workMinutes,
      overtimeMinutes,
      earlyLeaveMinutes,
      status,
      updatedAt: new Date(),
    },
  });
}

export async function listAttendanceRecords(
  companyId: number,
  opts: {
    employeeId?: number;
    departmentId?: number;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (opts.employeeId) query.employeeId = opts.employeeId;
  if (opts.status) query.status = opts.status;
  if (opts.startDate || opts.endDate) {
    query.date = {};
    if (opts.startDate) (query.date as Record<string, unknown>).$gte = opts.startDate;
    if (opts.endDate) (query.date as Record<string, unknown>).$lte = opts.endDate;
  }
  if (opts.departmentId) {
    const employees = await EmployeeModel.find({ companyId, departmentId: opts.departmentId }).select({ id: 1 }).lean();
    query.employeeId = { $in: employees.map((employee: any) => employee.id) };
  }
  return AttendanceRecordModel.find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip(opts.offset ?? 0)
    .limit(opts.limit ?? 500)
    .lean();
}

export async function updateAttendanceRecord(id: number, data: Partial<InsertAttendanceRecord>) {
  await ensureMongoReady();
  await AttendanceRecordModel.updateOne({ id }, { $set: { ...data, updatedAt: new Date() } });
}

export async function getTodayAttendanceSummary(companyId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const rows = await listAttendanceRecords(companyId, { startDate: today, endDate: tomorrow, limit: 10000 });
  const summary = { present: 0, late: 0, absent: 0, onLeave: 0, total: rows.length };
  for (const row of rows) {
    if (row.status === "present") summary.present++;
    else if (row.status === "late") summary.late++;
    else if (row.status === "absent") summary.absent++;
    else if (row.status === "on_leave") summary.onLeave++;
  }
  return summary;
}

export async function createOvertimeRequest(data: InsertOvertimeRequest) {
  await ensureMongoReady();
  return createWithNumericId(OvertimeRequestModel, "overtimeRequests", withDefaults(data, { status: "pending" }));
}

export async function listOvertimeRequests(
  companyId: number,
  opts: { employeeId?: number; status?: string; startDate?: Date; endDate?: Date } = {}
): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (opts.employeeId) query.employeeId = opts.employeeId;
  if (opts.status) query.status = opts.status;
  if (opts.startDate || opts.endDate) {
    query.date = {};
    if (opts.startDate) (query.date as Record<string, unknown>).$gte = opts.startDate;
    if (opts.endDate) (query.date as Record<string, unknown>).$lte = opts.endDate;
  }
  return OvertimeRequestModel.find(query).sort({ date: -1 }).lean();
}

export async function updateOvertimeRequest(id: number, data: Partial<InsertOvertimeRequest>) {
  await ensureMongoReady();
  await OvertimeRequestModel.updateOne({ id }, { $set: { ...data, updatedAt: new Date() } });
}

export async function createPunchImportJob(data: InsertPunchImportJob) {
  await ensureMongoReady();
  return createWithNumericId(PunchImportJobModel, "punchImportJobs", withDefaults(data, {
    totalRows: 0,
    successRows: 0,
    errorRows: 0,
    status: "pending",
    source: "csv",
  }));
}

export async function updatePunchImportJob(id: number, data: Partial<InsertPunchImportJob>) {
  await ensureMongoReady();
  await PunchImportJobModel.updateOne({ id }, { $set: { ...data, updatedAt: new Date() } });
}

export async function listPunchImportJobs(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return PunchImportJobModel.find({ companyId }).sort({ createdAt: -1 }).limit(100).lean();
}

export async function createAnomalyFlag(data: InsertAttendanceAnomalyFlag) {
  await ensureMongoReady();
  return createWithNumericId(AttendanceAnomalyFlagModel, "attendanceAnomalyFlags", withDefaults(data, { status: "pending_review" }));
}

export async function listAnomalyFlags(companyId: number, opts: { status?: string; employeeId?: number } = {}): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (opts.status) query.status = opts.status;
  if (opts.employeeId) query.employeeId = opts.employeeId;
  return AttendanceAnomalyFlagModel.find(query).sort({ createdAt: -1 }).lean();
}

export async function reviewAnomalyFlag(id: number, status: string, reviewedBy: number, reviewNotes?: string) {
  await ensureMongoReady();
  await AttendanceAnomalyFlagModel.updateOne({ id }, {
    $set: {
      status,
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function upsertAbsenteeismPrediction(data: any) {
  await ensureMongoReady();
  await AbsenteeismPredictionModel.deleteMany({
    companyId: data.companyId,
    employeeId: data.employeeId,
    targetPeriodStart: data.targetPeriodStart,
    targetPeriodEnd: data.targetPeriodEnd,
  });
  await createWithNumericId(AbsenteeismPredictionModel, "absenteeismPredictions", withDefaults(data, {
    predictionDate: new Date(),
    generatedAt: new Date(),
  }));
}

export async function listAbsenteeismPredictions(companyId: number, opts: { riskLevel?: string } = {}): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (opts.riskLevel) query.riskLevel = opts.riskLevel;
  return AbsenteeismPredictionModel.find(query).sort({ riskScore: -1, generatedAt: -1 }).lean();
}

export async function getAttendanceReportData(
  companyId: number,
  startDate: Date,
  endDate: Date,
  opts: { employeeId?: number; departmentId?: number } = {}
): Promise<any[]> {
  return listAttendanceRecords(companyId, { ...opts, startDate, endDate, limit: 10000 });
}

export async function getAttendanceStatsByStatus(companyId: number, startDate: Date, endDate: Date): Promise<{ status: string; count: number }[]> {
  const rows = await listAttendanceRecords(companyId, { startDate, endDate, limit: 10000 });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.status ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
}

export async function getTopLateEmployees(companyId: number, startDate: Date, endDate: Date, limit = 10) {
  const rows = await listAttendanceRecords(companyId, { startDate, endDate, status: "late", limit: 10000 });
  const counts = new Map<number, { lateCount: number; totalLateMinutes: number }>();
  for (const row of rows) {
    const item = counts.get(row.employeeId) ?? { lateCount: 0, totalLateMinutes: 0 };
    item.lateCount += 1;
    item.totalLateMinutes += row.lateMinutes ?? 0;
    counts.set(row.employeeId, item);
  }
  return Array.from(counts.entries())
    .map(([employeeId, item]) => ({ employeeId, lateCount: item.lateCount, totalLateMinutes: item.totalLateMinutes }))
    .sort((a, b) => b.lateCount - a.lateCount)
    .slice(0, limit);
}

export async function getGeoFenceViolations(companyId: number, startDate: Date, endDate: Date): Promise<any[]> {
  await ensureMongoReady();
  return AttendanceRecordModel.find({
    companyId,
    geoFenceStatus: "outside",
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: -1 }).lean();
}

export async function getOvertimeSummary(companyId: number, startDate: Date, endDate: Date) {
  const rows = await listAttendanceRecords(companyId, { startDate, endDate, limit: 10000 });
  const counts = new Map<number, { totalOvertimeMinutes: number; count: number }>();
  for (const row of rows) {
    if ((row.overtimeMinutes ?? 0) <= 0) continue;
    const item = counts.get(row.employeeId) ?? { totalOvertimeMinutes: 0, count: 0 };
    item.totalOvertimeMinutes += row.overtimeMinutes ?? 0;
    item.count += 1;
    counts.set(row.employeeId, item);
  }
  return Array.from(counts.entries())
    .map(([employeeId, item]) => ({ employeeId, totalOvertimeMinutes: item.totalOvertimeMinutes, count: item.count }))
    .sort((a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes);
}

export async function listLeaveTypes(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return LeaveTypeModel.find({ companyId }).sort({ name: 1 }).lean();
}

export async function getLeaveType(id: number): Promise<any | undefined> {
  await ensureMongoReady();
  return (await LeaveTypeModel.findOne({ id }).lean()) ?? undefined;
}

export async function createLeaveType(data: InsertLeaveType) {
  await ensureMongoReady();
  return createWithNumericId(LeaveTypeModel, "leaveTypes", withDefaults(data, {
    isPaid: true,
    isCarryForward: false,
    maxCarryDays: 0,
    accrualType: "none",
    accrualRate: "0.00",
    maxBalance: "0.00",
    applicableGender: "all",
    requiresApproval: true,
    requiresDocument: false,
    minDaysNotice: 0,
    maxConsecutiveDays: 0,
    colorCode: "#6366f1",
    isActive: true,
  }));
}

export async function updateLeaveType(id: number, data: Partial<InsertLeaveType>) {
  await ensureMongoReady();
  await LeaveTypeModel.updateOne({ id }, { $set: data });
}

export async function deleteLeaveType(id: number) {
  await ensureMongoReady();
  await LeaveTypeModel.updateOne({ id }, { $set: { isActive: false } });
}

export async function listLeavePolicies(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  return LeavePolicyModel.find({ companyId }).sort({ name: 1 }).lean();
}

export async function getLeavePoliciesForType(companyId: number, leaveTypeId: number): Promise<any[]> {
  await ensureMongoReady();
  return LeavePolicyModel.find({ companyId, leaveTypeId }).sort({ name: 1 }).lean();
}

export async function createLeavePolicy(data: InsertLeavePolicy) {
  await ensureMongoReady();
  return createWithNumericId(LeavePolicyModel, "leavePolicies", withDefaults(data, {
    applicableTo: "all",
    gender: "all",
    prorateOnJoining: true,
    prorateOnExit: true,
    isActive: true,
  }));
}

export async function updateLeavePolicy(id: number, data: Partial<InsertLeavePolicy>) {
  await ensureMongoReady();
  await LeavePolicyModel.updateOne({ id }, { $set: data });
}

export async function deleteLeavePolicy(id: number) {
  await ensureMongoReady();
  await LeavePolicyModel.updateOne({ id }, { $set: { isActive: false } });
}

export async function getLeaveBalance(employeeId: number, leaveTypeId: number, year: number): Promise<any | undefined> {
  await ensureMongoReady();
  return (await LeaveBalanceModel.findOne({ employeeId, leaveTypeId, year }).lean()) ?? undefined;
}

export async function listLeaveBalances(companyId: number, year: number, employeeId?: number): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId, year };
  if (employeeId) query.employeeId = employeeId;
  return LeaveBalanceModel.find(query).sort({ employeeId: 1, leaveTypeId: 1 }).lean();
}

export async function upsertLeaveBalance(data: InsertLeaveBalance) {
  await ensureMongoReady();
  const existing = await LeaveBalanceModel.findOne({
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    year: data.year,
  }).lean();
  if (existing) {
    await LeaveBalanceModel.updateOne({ id: existing.id }, { $set: data });
    return;
  }
  await createWithNumericId(LeaveBalanceModel, "leaveBalances", withDefaults(data, {
    entitled: "0.00",
    used: "0.00",
    pending: "0.00",
    carryForward: "0.00",
    compensatory: "0.00",
    balance: "0.00",
  }));
}

export async function adjustLeaveBalance(
  employeeId: number,
  leaveTypeId: number,
  year: number,
  delta: { used?: number; pending?: number; balance?: number; carryForward?: number; compensatory?: number }
) {
  const balance = await getLeaveBalance(employeeId, leaveTypeId, year);
  if (!balance) return;
  const nextValues: Record<string, string> = {};
  if (delta.used !== undefined) nextValues.used = String(parseFloat(balance.used ?? "0") + delta.used);
  if (delta.pending !== undefined) nextValues.pending = String(parseFloat(balance.pending ?? "0") + delta.pending);
  if (delta.balance !== undefined) nextValues.balance = String(parseFloat(balance.balance ?? "0") + delta.balance);
  if (delta.carryForward !== undefined) nextValues.carryForward = String(parseFloat(balance.carryForward ?? "0") + delta.carryForward);
  if (delta.compensatory !== undefined) nextValues.compensatory = String(parseFloat(balance.compensatory ?? "0") + delta.compensatory);
  await LeaveBalanceModel.updateOne({ id: balance.id }, { $set: nextValues });
}

export async function createLeaveRequest(data: InsertLeaveRequest) {
  await ensureMongoReady();
  return createWithNumericId(LeaveRequestModel, "leaveRequests", withDefaults(data, {
    isHalfDay: false,
    aiDraftUsed: false,
    status: "pending",
    appliedAt: new Date(),
  }));
}

export async function getLeaveRequest(id: number): Promise<any | undefined> {
  await ensureMongoReady();
  return (await LeaveRequestModel.findOne({ id }).lean()) ?? undefined;
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
): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (opts.employeeId) query.employeeId = opts.employeeId;
  if (opts.status) query.status = opts.status;
  if (opts.leaveTypeId) query.leaveTypeId = opts.leaveTypeId;
  if (opts.startDate || opts.endDate) {
    const rangeConditions: Record<string, unknown>[] = [];
    if (opts.startDate) rangeConditions.push({ endDate: { $gte: opts.startDate } });
    if (opts.endDate) rangeConditions.push({ startDate: { $lte: opts.endDate } });
    if (rangeConditions.length > 0) {
      query.$and = rangeConditions;
    }
  }
  return LeaveRequestModel.find(query)
    .sort({ appliedAt: -1, createdAt: -1 })
    .limit(opts.limit ?? 1000)
    .lean();
}

export async function updateLeaveRequest(id: number, data: Partial<InsertLeaveRequest>) {
  await ensureMongoReady();
  await LeaveRequestModel.updateOne({ id }, { $set: data });
}

export async function getOverlappingLeaveRequests(
  companyId: number,
  employeeId: number,
  startDate: Date,
  endDate: Date,
  excludeId?: number
): Promise<any[]> {
  await ensureMongoReady();
  const rows = await LeaveRequestModel.find({
    companyId,
    employeeId,
    $or: [
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } },
      { startDate: { $lte: startDate }, endDate: { $gte: endDate } },
    ],
  }).lean();
  return excludeId ? rows.filter((row: any) => row.id !== excludeId) : rows;
}

export async function createLeaveApproval(data: InsertLeaveApproval) {
  await ensureMongoReady();
  return createWithNumericId(LeaveApprovalModel, "leaveApprovals", withDefaults(data, { step: 1, status: "pending" }));
}

export async function listLeaveApprovals(leaveRequestId: number): Promise<any[]> {
  await ensureMongoReady();
  return LeaveApprovalModel.find({ leaveRequestId }).sort({ step: 1 }).lean();
}

export async function getPendingApprovalsForApprover(approverId: number): Promise<any[]> {
  await ensureMongoReady();
  return LeaveApprovalModel.find({ approverId, status: "pending" }).sort({ createdAt: -1 }).lean();
}

export async function updateLeaveApproval(id: number, data: Partial<InsertLeaveApproval>) {
  await ensureMongoReady();
  await LeaveApprovalModel.updateOne({ id }, { $set: data });
}

export async function createAccrualLog(data: InsertLeaveAccrualLog) {
  await ensureMongoReady();
  return createWithNumericId(LeaveAccrualLogModel, "leaveAccrualLogs", withDefaults(data, { runAt: new Date() }));
}

export async function listAccrualLogs(companyId: number, employeeId?: number, year?: number): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (employeeId) query.employeeId = employeeId;
  if (year) query.year = year;
  return LeaveAccrualLogModel.find(query).sort({ runAt: -1 }).lean();
}

export async function createCarryForwardLog(data: InsertLeaveCarryForwardLog) {
  await ensureMongoReady();
  return createWithNumericId(LeaveCarryForwardLogModel, "leaveCarryForwardLogs", withDefaults(data, { processedAt: new Date() }));
}

export async function listCarryForwardLogs(companyId: number, employeeId?: number, fromYear?: number): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (employeeId) query.employeeId = employeeId;
  if (fromYear) query.fromYear = fromYear;
  return LeaveCarryForwardLogModel.find(query).sort({ processedAt: -1 }).lean();
}

export async function createCompensatoryLeave(data: InsertCompensatoryLeave) {
  await ensureMongoReady();
  return createWithNumericId(CompensatoryLeaveModel, "compensatoryLeaves", withDefaults(data, {
    usedDays: "0.00",
    status: "active",
  }));
}

export async function getCompensatoryLeave(id: number): Promise<any | undefined> {
  await ensureMongoReady();
  return (await CompensatoryLeaveModel.findOne({ id }).lean()) ?? undefined;
}

export async function listCompensatoryLeaves(companyId: number, employeeId?: number, status?: string): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (employeeId) query.employeeId = employeeId;
  if (status) query.status = status;
  return CompensatoryLeaveModel.find(query).sort({ earnedDate: -1 }).lean();
}

export async function updateCompensatoryLeave(id: number, data: Partial<InsertCompensatoryLeave>) {
  await ensureMongoReady();
  await CompensatoryLeaveModel.updateOne({ id }, { $set: data });
}

export async function getPayslips(employeeId: number, limit = 12): Promise<any[]> {
  await ensureMongoReady();
  return PayslipModel.find({ employeeId }).sort({ year: -1, month: -1 }).limit(limit).lean();
}

export async function getPayslipById(id: number, employeeId: number): Promise<any | null> {
  await ensureMongoReady();
  return (await PayslipModel.findOne({ id, employeeId }).lean()) ?? null;
}

export async function createPayslip(data: InsertPayslip) {
  await ensureMongoReady();
  return createWithNumericId(PayslipModel, "payslips", withDefaults(data, {
    taxAmount: "0.00",
    pfEmployee: "0.00",
    pfEmployer: "0.00",
    loanDeductions: "0.00",
    advanceDeductions: "0.00",
    lateDeductions: "0.00",
    absentDeductions: "0.00",
    attendanceDays: 0,
    absentDays: 0,
    currency: "AED",
    status: "draft",
  }));
}

export async function getCompanyNewsFeed(companyId: number, opts: { category?: string; limit?: number } = {}): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId, isActive: true };
  if (opts.category) query.category = opts.category;
  return CompanyNewsModel.find(query)
    .sort({ isPinned: -1, publishedAt: -1, createdAt: -1 })
    .limit(opts.limit ?? 10)
    .lean();
}

export async function createCompanyNewsItem(data: InsertCompanyNews) {
  await ensureMongoReady();
  return createWithNumericId(CompanyNewsModel, "companyNews", withDefaults(data, {
    category: "general",
    isPinned: false,
    isActive: true,
    targetAudience: "all",
    publishedAt: new Date(),
  }));
}

export async function getPolicyDocs(companyId: number, category?: string): Promise<any[]> {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId, isActive: true };
  if (category) query.category = category;
  return HrPolicyDocModel.find(query).sort({ isMandatory: -1, createdAt: -1 }).lean();
}

export async function createPolicyDoc(data: InsertHrPolicyDoc) {
  await ensureMongoReady();
  return createWithNumericId(HrPolicyDocModel, "hrPolicyDocs", withDefaults(data, {
    category: "general",
    version: "1.0",
    isActive: true,
    isMandatory: false,
  }));
}

export async function listExpenseClaims(companyId: number, filters?: { employeeId?: number; status?: string }) {
  await ensureMongoReady();
  const query: Record<string, unknown> = { companyId };
  if (filters?.employeeId) query.employeeId = filters.employeeId;
  if (filters?.status) query.status = filters.status;
  return ExpenseClaimModel.find(query).sort({ createdAt: -1 }).lean();
}

export async function getExpenseClaim(id: number, companyId: number) {
  await ensureMongoReady();
  return (await ExpenseClaimModel.findOne({ id, companyId }).lean()) ?? null;
}

export async function createExpenseClaim(data: InsertExpenseClaim) {
  await ensureMongoReady();
  return createWithNumericId(ExpenseClaimModel, "expenseClaims", withDefaults(data, {
    currency: "AED",
    status: "draft",
  }));
}

export async function updateExpenseClaim(id: number, companyId: number, data: Partial<InsertExpenseClaim>) {
  await ensureMongoReady();
  await ExpenseClaimModel.updateOne({ id, companyId }, { $set: data });
}

export async function listUserProfiles(companyId: number): Promise<any[]> {
  await ensureMongoReady();
  const [profiles, users] = await Promise.all([
    UserProfileModel.find({ companyId }).lean(),
    UserModel.find({}).lean(),
  ]);
  const userMap = new Map<number, any>(users.map((item: any) => [item.id, item]));
  return profiles.map((profile: any) => ({
    ...profile,
    userName: userMap.get(profile.userId)?.name ?? null,
    userEmail: userMap.get(profile.userId)?.email ?? null,
    userOpenId: userMap.get(profile.userId)?.openId ?? null,
  }));
}

export async function getUserProfile(userId: number, companyId: number): Promise<any | null> {
  await ensureMongoReady();
  return toPlain(await UserProfileModel.findOne({ userId, companyId }).lean());
}

export async function getUserProfileByUserId(userId: number): Promise<any | null> {
  await ensureMongoReady();
  return toPlain(await UserProfileModel.findOne({ userId }).lean());
}

export async function createUserProfile(data: InsertUserProfile) {
  await ensureMongoReady();
  await createWithNumericId(UserProfileModel, "userProfiles", withDefaults(data, { isActive: true }));
}

export async function updateUserProfile(id: number, data: Partial<InsertUserProfile>) {
  await ensureMongoReady();
  await UserProfileModel.updateOne({ id }, { $set: data });
}

export async function deactivateUserProfile(userId: number, companyId: number) {
  await ensureMongoReady();
  await UserProfileModel.updateOne({ userId, companyId }, { $set: { isActive: false } });
}

export async function getUserRoles(userId: number, companyId: number): Promise<any[]> {
  await ensureMongoReady();
  const [assignments, roles] = await Promise.all([
    UserRoleModel.find({ userId, companyId, isActive: true }).lean(),
    HcmRoleModel.find({ companyId }).lean(),
  ]);
  const roleMap = new Map<number, any>(roles.map((item: any) => [item.id, item]));
  return assignments.map((assignment: any) => ({
    ...assignment,
    roleName: roleMap.get(assignment.hcmRoleId)?.name ?? null,
    roleSlug: roleMap.get(assignment.hcmRoleId)?.slug ?? null,
  }));
}

export async function assignUserRole(data: InsertUserRole) {
  await ensureMongoReady();
  await UserRoleModel.updateMany(
    { userId: data.userId, hcmRoleId: data.hcmRoleId, companyId: data.companyId },
    { $set: { isActive: false } }
  );
  await createWithNumericId(UserRoleModel, "userRoles", withDefaults(data, { isActive: true, assignedAt: new Date() }));
}

export async function revokeUserRole(userId: number, hcmRoleId: number, companyId: number) {
  await ensureMongoReady();
  await UserRoleModel.updateMany({ userId, hcmRoleId, companyId }, { $set: { isActive: false } });
}

export async function setUserRoles(userId: number, companyId: number, roleIds: number[], assignedBy: number) {
  await ensureMongoReady();
  await UserRoleModel.updateMany({ userId, companyId }, { $set: { isActive: false } });
  for (const roleId of roleIds) {
    await createWithNumericId(UserRoleModel, "userRoles", {
      userId,
      hcmRoleId: roleId,
      companyId,
      assignedBy,
      assignedAt: new Date(),
      isActive: true,
    });
  }
}

export async function getUserPermissionOverrides(userId: number, companyId: number): Promise<any[]> {
  await ensureMongoReady();
  const now = new Date();
  return UserPermissionOverrideModel.find({
    userId,
    companyId,
    $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
  }).lean();
}

export async function upsertUserPermissionOverride(data: InsertUserPermissionOverride) {
  await ensureMongoReady();
  await UserPermissionOverrideModel.deleteMany({
    userId: data.userId,
    companyId: data.companyId,
    module: data.module,
    action: data.action,
  });
  await createWithNumericId(UserPermissionOverrideModel, "userPermissionOverrides", { ...data, grantedAt: data.grantedAt ?? new Date() });
}

export async function deleteUserPermissionOverride(id: number) {
  await ensureMongoReady();
  await UserPermissionOverrideModel.deleteOne({ id });
}

export async function getUserAccessProfile(userId: number, companyId: number, hcmRoleId: number): Promise<any | null> {
  await ensureMongoReady();
  return toPlain(await UserAccessProfileModel.findOne({ userId, companyId, hcmRoleId }).lean());
}

export async function upsertUserAccessProfile(data: InsertUserAccessProfile) {
  await ensureMongoReady();
  const existing = await UserAccessProfileModel.findOne({
    userId: data.userId,
    companyId: data.companyId,
    hcmRoleId: data.hcmRoleId,
  }).lean();
  if (existing) {
    await UserAccessProfileModel.updateOne({ id: existing.id }, { $set: { dataScope: data.dataScope, scopeConfig: data.scopeConfig } });
    return;
  }
  await createWithNumericId(UserAccessProfileModel, "userAccessProfiles", data);
}

export async function listHcmRoles(companyId: number): Promise<any[]> {
  return getHcmRoles(companyId);
}

export async function getHcmRole(id: number): Promise<any | null> {
  await ensureMongoReady();
  return toPlain(await HcmRoleModel.findOne({ id }).lean());
}

export async function createHcmRoleExtended(data: InsertHcmRole) {
  await ensureMongoReady();
  const id = await createWithNumericId(HcmRoleModel, "hcmRoles", withDefaults(data, { isActive: true, isPredefined: false }));
  return { id };
}

export async function updateHcmRole(id: number, data: Partial<InsertHcmRole>) {
  await ensureMongoReady();
  await HcmRoleModel.updateOne({ id }, { $set: data });
}

export async function cloneHcmRole(sourceRoleId: number, newName: string, newSlug: string, companyId: number) {
  await ensureMongoReady();
  const sourcePerms = await RolePermissionModel.find({ hcmRoleId: sourceRoleId, companyId }).lean();
  const newRoleId = await createWithNumericId(HcmRoleModel, "hcmRoles", {
    companyId,
    name: newName,
    slug: newSlug,
    isPredefined: false,
    description: `Cloned from role ${sourceRoleId}`,
    isActive: true,
  });
  for (const permission of sourcePerms) {
    await createWithNumericId(RolePermissionModel, "rolePermissions", {
      hcmRoleId: newRoleId,
      companyId,
      module: permission.module,
      canView: permission.canView,
      canCreate: permission.canCreate,
      canEdit: permission.canEdit,
      canDelete: permission.canDelete,
      canApprove: permission.canApprove,
      canExport: permission.canExport,
    });
  }
  return { id: newRoleId };
}

export async function deleteHcmRole(id: number) {
  await ensureMongoReady();
  await HcmRoleModel.updateOne({ id }, { $set: { isActive: false } });
}

export async function getRolePermissionMatrix(hcmRoleId: number, companyId: number): Promise<any[]> {
  return getRolePermissions(hcmRoleId, companyId);
}

export async function setRolePermission(data: {
  hcmRoleId: number;
  companyId: number;
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
}) {
  return upsertRolePermission(data);
}

export async function getEffectivePermissions(userId: number, companyId: number) {
  await ensureMongoReady();
  const roles = await getUserRoles(userId, companyId);
  const effective: Record<string, Record<string, boolean>> = {};
  for (const role of roles as any[]) {
    const permissions = await getRolePermissionMatrix(role.hcmRoleId, companyId);
    for (const permission of permissions as any[]) {
      if (!effective[permission.module]) {
        effective[permission.module] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
      }
      if (permission.canView) effective[permission.module].view = true;
      if (permission.canCreate) effective[permission.module].create = true;
      if (permission.canEdit) effective[permission.module].edit = true;
      if (permission.canDelete) effective[permission.module].delete = true;
      if (permission.canApprove) effective[permission.module].approve = true;
      if (permission.canExport) effective[permission.module].export = true;
    }
  }
  const overrides = await getUserPermissionOverrides(userId, companyId);
  for (const override of overrides as any[]) {
    if (!effective[override.module]) {
      effective[override.module] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
    }
    effective[override.module][override.action] = override.granted;
  }
  return effective;
}

export type DataScopeType = "self" | "reports" | "department" | "company" | "custom";

export async function getUserDataScope(userId: number, companyId: number): Promise<DataScopeType> {
  const roles = await getUserRoles(userId, companyId);
  if (roles.length === 0) return "self";
  const scopeOrder: DataScopeType[] = ["self", "reports", "department", "company", "custom"];
  let broadest: DataScopeType = "self";
  for (const role of roles as any[]) {
    if (role.roleSlug === "super_admin" || role.roleSlug === "hr_admin") {
      return "company";
    }
    const profile = await getUserAccessProfile(userId, companyId, role.hcmRoleId);
    const scope = ((profile as any)?.dataScope ?? "self") as DataScopeType;
    if (scopeOrder.indexOf(scope) > scopeOrder.indexOf(broadest)) {
      broadest = scope;
    }
  }
  return broadest;
}

export async function writeAccessAuditLog(data: {
  companyId: number;
  actorUserId: number;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: number;
  entityLabel?: string;
  before?: unknown;
  after?: unknown;
}) {
  await createAuditLog({
    companyId: data.companyId,
    actorUserId: data.actorUserId,
    actorName: data.actorName,
    action: data.action,
    module: "settings",
    entityType: data.entityType,
    entityId: data.entityId,
    entityLabel: data.entityLabel,
    before: data.before as Record<string, unknown>,
    after: data.after as Record<string, unknown>,
  });
}
