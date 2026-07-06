/**
 * server/ai/functions/hcmTools.ts
 *
 * Built-in FunctionTool implementations that give the AI model read/write
 * access to the CORE HR platform's existing module APIs.
 *
 * Each tool:
 *   1. Declares a name, description, and JSON-Schema parameters block
 *   2. Implements an execute() function that calls the existing DB helpers
 *
 * Add new tools here as modules are built.
 */

import {
  getEmployeeById,
  getEmployees,
  getDepartments,
  getWorkflowInstanceById,
  getWorkflowInstances,
  createNotification,
  getAuditLogs,
} from "../../mongoDb";
import type { FunctionTool } from "../types";

// ─── Tool: get_employee ───────────────────────────────────────────────────────

const getEmployeeTool: FunctionTool = {
  name: "get_employee",
  description:
    "Retrieve a single employee record by their numeric ID and company ID. Returns name, email, job title, department, location, employment status, and reporting manager.",
  parameters: {
    type: "object",
    properties: {
      employeeId: {
        type: "integer",
        description: "The numeric ID of the employee to retrieve",
      },
      companyId: {
        type: "integer",
        description: "The company the employee belongs to",
      },
    },
    required: ["employeeId", "companyId"],
  },
  async execute(args) {
    const id = Number(args.employeeId);
    const companyId = Number(args.companyId);
    if (!id || isNaN(id)) throw new Error("employeeId must be a positive integer");
    if (!companyId) throw new Error("companyId is required");
    const emp = await getEmployeeById(id, companyId);
    if (!emp) return { found: false, employeeId: id };
    return { found: true, employee: emp };
  },
};

// ─── Tool: list_employees ─────────────────────────────────────────────────────

const listEmployeesTool: FunctionTool = {
  name: "list_employees",
  description:
    "List employees for a company, optionally filtered by department or employment status. Returns a summary list (id, name, jobTitle, department, status).",
  parameters: {
    type: "object",
    properties: {
      companyId: {
        type: "integer",
        description: "The company to query",
      },
      departmentId: {
        type: "integer",
        description: "Optional: filter by department ID",
      },
      status: {
        type: "string",
        enum: ["active", "inactive", "on_leave", "terminated"],
        description: "Optional: filter by employment status",
      },
    },
    required: ["companyId"],
  },
  async execute(args) {
    const companyId = Number(args.companyId);
    if (!companyId) throw new Error("companyId is required");
    const employees = await getEmployees(companyId, {
      departmentId: args.departmentId ? Number(args.departmentId) : undefined,
      status: args.status as string | undefined,
    });
    return { count: employees.length, employees };
  },
};

// ─── Tool: list_departments ───────────────────────────────────────────────────

const listDepartmentsTool: FunctionTool = {
  name: "list_departments",
  description:
    "List all departments for a company. Returns id, name, code, parentId, and headEmployeeId.",
  parameters: {
    type: "object",
    properties: {
      companyId: {
        type: "integer",
        description: "The company to query",
      },
    },
    required: ["companyId"],
  },
  async execute(args) {
    const companyId = Number(args.companyId);
    if (!companyId) throw new Error("companyId is required");
    const departments = await getDepartments(companyId);
    return { count: departments.length, departments };
  },
};

// ─── Tool: get_workflow_status ────────────────────────────────────────────────

const getWorkflowStatusTool: FunctionTool = {
  name: "get_workflow_status",
  description:
    "Get the current status of an approval workflow instance. Returns the request type, current step, overall status, and step-level details.",
  parameters: {
    type: "object",
    properties: {
      instanceId: {
        type: "integer",
        description: "The numeric ID of the workflow instance",
      },
      companyId: {
        type: "integer",
        description: "The company context for the workflow",
      },
    },
    required: ["instanceId", "companyId"],
  },
  async execute(args) {
    const id = Number(args.instanceId);
    const companyId = Number(args.companyId);
    if (!id || isNaN(id)) throw new Error("instanceId must be a positive integer");
    if (!companyId) throw new Error("companyId is required");
    const instance = await getWorkflowInstanceById(id, companyId);
    if (!instance) return { found: false, instanceId: id };
    return { found: true, workflow: instance };
  },
};

// ─── Tool: list_pending_approvals ─────────────────────────────────────────────

const listPendingApprovalsTool: FunctionTool = {
  name: "list_pending_approvals",
  description:
    "List pending workflow approval requests for a company, optionally filtered by request type.",
  parameters: {
    type: "object",
    properties: {
      companyId: {
        type: "integer",
        description: "The company to query",
      },
      requestType: {
        type: "string",
        description: "Optional: filter by request type (e.g. leave_request, expense_claim)",
      },
    },
    required: ["companyId"],
  },
  async execute(args) {
    const companyId = Number(args.companyId);
    if (!companyId) throw new Error("companyId is required");
    const instances = await getWorkflowInstances(companyId, {
      status: "pending",
      requestType: args.requestType as string | undefined,
    });
    return { count: instances.length, approvals: instances };
  },
};

// ─── Tool: create_notification ────────────────────────────────────────────────

const createNotificationTool: FunctionTool = {
  name: "create_notification",
  description:
    "Send an in-app notification to a specific employee. Use this when the user asks the AI to notify someone about an event or action.",
  parameters: {
    type: "object",
    properties: {
      companyId: {
        type: "integer",
        description: "The company context",
      },
      recipientEmployeeId: {
        type: "integer",
        description: "The employee who should receive the notification",
      },
      title: {
        type: "string",
        description: "Short notification title (max 120 chars)",
      },
      body: {
        type: "string",
        description: "Full notification body",
      },
      type: {
        type: "string",
        enum: ["workflow", "system", "reminder", "announcement"],
        description: "Notification category",
      },
    },
    required: ["companyId", "recipientEmployeeId", "title"],
  },
  async execute(args) {
    const companyId = Number(args.companyId);
    const recipientEmployeeId = Number(args.recipientEmployeeId);
    if (!companyId || !recipientEmployeeId) {
      throw new Error("companyId and recipientEmployeeId are required");
    }
    const title = String(args.title ?? "").slice(0, 120);
    const body = args.body ? String(args.body) : undefined;
    const validTypes = ["workflow", "system", "reminder", "announcement"] as const;
    type NotifType = typeof validTypes[number];
    const type: NotifType = validTypes.includes(args.type as NotifType)
      ? (args.type as NotifType)
      : "system";

    await createNotification({
      companyId,
      recipientEmployeeId,
      title,
      body,
      type,
    });

    return { sent: true, recipientEmployeeId, title };
  },
};

// ─── Tool: get_recent_audit_events ────────────────────────────────────────────

const getRecentAuditEventsTool: FunctionTool = {
  name: "get_recent_audit_events",
  description:
    "Retrieve recent audit log entries for a company. Useful for answering 'what changed recently?' or 'who updated the payroll settings?'",
  parameters: {
    type: "object",
    properties: {
      companyId: {
        type: "integer",
        description: "The company to query",
      },
      module: {
        type: "string",
        description: "Optional: filter by CORE HR module name (e.g. employees, roles, workflow)",
      },
      limit: {
        type: "integer",
        description: "Maximum results (default 10, max 50)",
      },
    },
    required: ["companyId"],
  },
  async execute(args) {
    const companyId = Number(args.companyId);
    if (!companyId) throw new Error("companyId is required");
    const logs = await getAuditLogs(companyId, {
      module: args.module as string | undefined,
      limit: Math.min(Number(args.limit ?? 10), 50),
    });
    return { count: logs.length, events: logs };
  },
};

// ─── Tool registry ────────────────────────────────────────────────────────────

/**
 * All built-in CORE HR tools, keyed by name.
 * Import `HCM_TOOLS` or individual tools from this module.
 */
export const HCM_TOOLS: Record<string, FunctionTool> = {
  get_employee: getEmployeeTool,
  list_employees: listEmployeesTool,
  list_departments: listDepartmentsTool,
  get_workflow_status: getWorkflowStatusTool,
  list_pending_approvals: listPendingApprovalsTool,
  create_notification: createNotificationTool,
  get_recent_audit_events: getRecentAuditEventsTool,
};

/** Convenience array of all registered tools */
export const ALL_HCM_TOOLS: FunctionTool[] = Object.values(HCM_TOOLS);

export {
  getEmployeeTool,
  listEmployeesTool,
  listDepartmentsTool,
  getWorkflowStatusTool,
  listPendingApprovalsTool,
  createNotificationTool,
  getRecentAuditEventsTool,
};
