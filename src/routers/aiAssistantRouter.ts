/**
 * server/routers/aiAssistantRouter.ts
 *
 * Global AI Assistant — conversational, function-calling backed, permission-aware.
 *
 * Architecture:
 *   1. Frontend sends a conversation history (messages[]) + pending action confirmations
 *   2. Server resolves the caller's effective permissions and data scope
 *   3. Server builds a permission-filtered tool set (only tools the user can call)
 *   4. Server runs an agentic loop: LLM → tool calls → results → LLM until done
 *      BUT: write tools are NOT auto-executed — they return a "pending_confirmation"
 *      object that the frontend must confirm before calling the execute endpoint
 *   5. Server returns the assistant message + any pending confirmations
 *
 * Procedures:
 *   assistant.chat          — main conversational endpoint
 *   assistant.execute       — execute a confirmed write action
 *   assistant.getSuggestions — get context-aware suggested prompts
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import type { Message, Tool } from "../_core/llm";
import {
  getDepartments,
  getEffectivePermissions,
  getEmployeeById,
  getEmployees,
  getPendingApprovalsCount,
  getUserProfileByUserId,
  getWorkflowInstances,
} from "../mongoDb";
import {
  listLeaveTypes,
  listLeaveBalances,
  listLeaveRequests,
  createLeaveRequest,
  createLeaveApproval,
} from "../leaveDb";
import {
  listAttendanceRecords,
  getTodayAttendanceSummary,
} from "../attendanceDb";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_ID = 1; // TODO: derive from ctx when multi-tenant is wired

// ─── Tool categories ──────────────────────────────────────────────────────────

type ToolCategory = "read" | "write";

interface AssistantTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  category: ToolCategory;
  requiredPermission: { module: string; action: string } | null;
  execute: (args: Record<string, unknown>, userId: number, employeeId: number | null) => Promise<unknown>;
}

// ─── Tool: get_my_info ────────────────────────────────────────────────────────

const getMyInfoTool: AssistantTool = {
  name: "get_my_info",
  description: "Get the current user's own employee profile, including name, department, designation, manager, and employment details.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  category: "read",
  requiredPermission: null, // everyone can view their own info
  async execute(_args, _userId, employeeId) {
    if (!employeeId) return { found: false, message: "No linked employee record found for your account." };
    const emp = await getEmployeeById(employeeId, COMPANY_ID);
    if (!emp) return { found: false };
    return { found: true, employee: emp };
  },
};

// ─── Tool: get_my_leave_balance ───────────────────────────────────────────────

const getMyLeaveBalanceTool: AssistantTool = {
  name: "get_my_leave_balance",
  description: "Get the current user's leave balances for the current year, showing available, used, and total days for each leave type.",
  parameters: {
    type: "object",
    properties: {
      year: {
        type: "integer",
        description: "Year to check (defaults to current year if not specified)",
      },
    },
    required: [],
  },
  category: "read",
  requiredPermission: { module: "leave", action: "view" },
  async execute(args, _userId, employeeId) {
    if (!employeeId) return { error: "No linked employee record." };
    const year = Number(args.year) || new Date().getFullYear();
    const balances = await listLeaveBalances(COMPANY_ID, year, employeeId);
    const leaveTypes = await listLeaveTypes(COMPANY_ID);
    return {
      year,
      balances: balances.map(b => {
        const lt = leaveTypes.find(t => t.id === b.leaveTypeId);
        return {
          leaveType: lt?.name ?? `Type ${b.leaveTypeId}`,
          leaveTypeId: b.leaveTypeId,
          entitled: b.entitled,
          used: b.used,
          available: b.balance,
          carryForward: b.carryForward,
        };
      }),
    };
  },
};

// ─── Tool: get_my_leave_requests ─────────────────────────────────────────────

const getMyLeaveRequestsTool: AssistantTool = {
  name: "get_my_leave_requests",
  description: "Get the current user's leave requests, optionally filtered by status (pending/approved/rejected/cancelled).",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["pending", "approved", "rejected", "cancelled"],
        description: "Filter by status (optional)",
      },
      limit: {
        type: "integer",
        description: "Max number of records to return (default 10)",
      },
    },
    required: [],
  },
  category: "read",
  requiredPermission: { module: "leave", action: "view" },
  async execute(args, _userId, employeeId) {
    if (!employeeId) return { error: "No linked employee record." };
    const requests = await listLeaveRequests(COMPANY_ID, {
      employeeId,
      status: args.status as string | undefined,
      limit: Number(args.limit) || 10,
    });
    const leaveTypes = await listLeaveTypes(COMPANY_ID);
    return {
      requests: requests.map(r => ({
        id: r.id,
        leaveType: leaveTypes.find(t => t.id === r.leaveTypeId)?.name ?? `Type ${r.leaveTypeId}`,
        startDate: r.startDate,
        endDate: r.endDate,
        days: r.days,
        status: r.status,
        reason: r.reason,
        appliedAt: r.appliedAt,
      })),
    };
  },
};

// ─── Tool: apply_leave (WRITE — requires confirmation) ────────────────────────

const applyLeaveTool: AssistantTool = {
  name: "apply_leave",
  description: "Submit a leave request for the current user. Always show the user what will be submitted and ask for confirmation before calling this tool.",
  parameters: {
    type: "object",
    properties: {
      leaveTypeName: {
        type: "string",
        description: "Name of the leave type (e.g. 'Annual Leave', 'Sick Leave')",
      },
      startDate: {
        type: "string",
        description: "Start date in YYYY-MM-DD format",
      },
      endDate: {
        type: "string",
        description: "End date in YYYY-MM-DD format",
      },
      reason: {
        type: "string",
        description: "Reason for the leave request",
      },
      isHalfDay: {
        type: "boolean",
        description: "Whether this is a half-day request",
      },
    },
    required: ["leaveTypeName", "startDate", "endDate", "reason"],
  },
  category: "write",
  requiredPermission: { module: "leave", action: "create" },
  async execute(args, _userId, employeeId) {
    if (!employeeId) return { error: "No linked employee record." };
    const leaveTypes = await listLeaveTypes(COMPANY_ID);
    const leaveType = leaveTypes.find(t =>
      t.name.toLowerCase().includes((args.leaveTypeName as string).toLowerCase())
    );
    if (!leaveType) {
      return {
        error: `Leave type "${args.leaveTypeName}" not found. Available types: ${leaveTypes.map(t => t.name).join(", ")}`,
      };
    }
    const startDate = new Date(args.startDate as string);
    const endDate = new Date(args.endDate as string);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { error: "Invalid date format. Use YYYY-MM-DD." };
    }
    const isHalfDay = Boolean(args.isHalfDay);
    const days = isHalfDay ? 0.5 : Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const id = await createLeaveRequest({
      companyId: COMPANY_ID,
      employeeId,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      isHalfDay,
      days: String(days),
      reason: args.reason as string,
      status: "pending",
    });
    // Create pending approval record (approverId will be resolved by the workflow engine)
    await createLeaveApproval({
      leaveRequestId: id,
      approverId: employeeId, // placeholder — workflow engine will reassign
      step: 1,
    });
    return {
      success: true,
      requestId: id,
      message: `Leave request submitted successfully. Request ID: ${id}. It is now pending approval.`,
      days,
      leaveType: leaveType.name,
      startDate: args.startDate,
      endDate: args.endDate,
    };
  },
};

// ─── Tool: get_team_leave ─────────────────────────────────────────────────────

const getTeamLeaveTool: AssistantTool = {
  name: "get_team_leave",
  description: "Get who is currently on leave or has upcoming leave in the company or department. Useful for managers and HR to plan coverage.",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["pending", "approved"],
        description: "Filter by status (default: approved)",
      },
      limit: {
        type: "integer",
        description: "Max records to return (default 20)",
      },
    },
    required: [],
  },
  category: "read",
  requiredPermission: { module: "leave", action: "view" },
  async execute(args, _userId, _employeeId) {
    const today = new Date();
    const requests = await listLeaveRequests(COMPANY_ID, {
      status: (args.status as string) || "approved",
      startDate: today,
      limit: Number(args.limit) || 20,
    });
    const employees = await getEmployees(COMPANY_ID);
    const leaveTypes = await listLeaveTypes(COMPANY_ID);
    return {
      onLeave: requests.map(r => {
        const emp = employees.find(e => e.id === r.employeeId);
        const lt = leaveTypes.find(t => t.id === r.leaveTypeId);
        return {
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : `Employee ${r.employeeId}`,
          leaveType: lt?.name ?? "Leave",
          startDate: r.startDate,
          endDate: r.endDate,
          days: r.days,
          status: r.status,
        };
      }),
    };
  },
};

// ─── Tool: get_attendance_summary ─────────────────────────────────────────────

const getAttendanceSummaryTool: AssistantTool = {
  name: "get_attendance_summary",
  description: "Get today's attendance summary for the company: how many employees are present, late, absent, or on leave.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  category: "read",
  requiredPermission: { module: "attendance", action: "view" },
  async execute(_args, _userId, _employeeId) {
    const summary = await getTodayAttendanceSummary(COMPANY_ID);
    return {
      date: new Date().toISOString().split("T")[0],
      ...summary,
    };
  },
};

// ─── Tool: get_my_attendance ──────────────────────────────────────────────────

const getMyAttendanceTool: AssistantTool = {
  name: "get_my_attendance",
  description: "Get the current user's attendance records for a date range.",
  parameters: {
    type: "object",
    properties: {
      startDate: {
        type: "string",
        description: "Start date in YYYY-MM-DD format (default: 30 days ago)",
      },
      endDate: {
        type: "string",
        description: "End date in YYYY-MM-DD format (default: today)",
      },
    },
    required: [],
  },
  category: "read",
  requiredPermission: { module: "attendance", action: "view" },
  async execute(args, _userId, employeeId) {
    if (!employeeId) return { error: "No linked employee record." };
    const endDate = args.endDate ? new Date(args.endDate as string) : new Date();
    const startDate = args.startDate
      ? new Date(args.startDate as string)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const records = await listAttendanceRecords(COMPANY_ID, {
      employeeId,
      startDate,
      endDate,
      limit: 60,
    });
    return {
      records: records.map(r => ({
        date: r.date,
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        status: r.status,
        workMinutes: r.workMinutes,
        overtimeMinutes: r.overtimeMinutes,
      })),
    };
  },
};

// ─── Tool: list_employees ─────────────────────────────────────────────────────

const listEmployeesTool: AssistantTool = {
  name: "list_employees",
  description: "List employees in the company, optionally filtered by department or status. Returns name, job title, department, and status.",
  parameters: {
    type: "object",
    properties: {
      departmentName: {
        type: "string",
        description: "Filter by department name (partial match)",
      },
      status: {
        type: "string",
        enum: ["active", "inactive", "on_leave", "terminated"],
        description: "Filter by employment status",
      },
      limit: {
        type: "integer",
        description: "Max records to return (default 20)",
      },
    },
    required: [],
  },
  category: "read",
  requiredPermission: { module: "employees", action: "view" },
  async execute(args, _userId, _employeeId) {
    const departments = await getDepartments(COMPANY_ID);
    let departmentId: number | undefined;
    if (args.departmentName) {
      const dept = departments.find(d =>
        d.name.toLowerCase().includes((args.departmentName as string).toLowerCase())
      );
      departmentId = dept?.id;
    }
    const employees = await getEmployees(COMPANY_ID, {
      departmentId,
      status: args.status as string | undefined,
    });
    const limited = employees.slice(0, Number(args.limit) || 20);
    return {
      total: employees.length,
      employees: limited.map(e => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        designation: (e as Record<string, unknown>).designationName ?? null,
        department: (e as Record<string, unknown>).departmentName ?? null,
        status: e.status,
        email: e.workEmail,
      })),
    };
  },
};

// ─── Tool: get_pending_approvals ──────────────────────────────────────────────

const getPendingApprovalsTool: AssistantTool = {
  name: "get_pending_approvals",
  description: "Get the count and list of pending approval requests in the system.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "integer",
        description: "Max records to return (default 10)",
      },
    },
    required: [],
  },
  category: "read",
  requiredPermission: { module: "workflow", action: "view" },
  async execute(args, _userId, _employeeId) {
    const count = await getPendingApprovalsCount(COMPANY_ID);
    const instances = await getWorkflowInstances(COMPANY_ID, { status: "pending" });
    const limited = instances.slice(0, Number(args.limit) || 10);
    return {
      totalPending: count,
      approvals: limited.map(i => ({
        id: i.id,
        requestType: i.requestType,
        requestedBy: i.requestedBy,
        status: i.status,
        createdAt: i.createdAt,
      })),
    };
  },
};

// ─── Tool: get_headcount ──────────────────────────────────────────────────────

const getHeadcountTool: AssistantTool = {
  name: "get_headcount",
  description: "Get headcount statistics: total employees, active count, new joiners this month, and breakdown by department.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  category: "read",
  requiredPermission: { module: "reports", action: "view" },
  async execute(_args, _userId, _employeeId) {
    const employees = await getEmployees(COMPANY_ID);
    const departments = await getDepartments(COMPANY_ID);
    const active = employees.filter(e => e.status === "active").length;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const newJoiners = employees.filter(e => e.joinDate && new Date(e.joinDate) >= thisMonth).length;
    const byDept = departments.map(d => ({
      department: d.name,
      count: employees.filter(e => e.departmentId === d.id && e.status === "active").length,
    })).filter(d => d.count > 0);
    return {
      total: employees.length,
      active,
      newJoinersThisMonth: newJoiners,
      byDepartment: byDept,
    };
  },
};

// ─── All tools registry ───────────────────────────────────────────────────────

const ALL_ASSISTANT_TOOLS: AssistantTool[] = [
  getMyInfoTool,
  getMyLeaveBalanceTool,
  getMyLeaveRequestsTool,
  applyLeaveTool,
  getTeamLeaveTool,
  getAttendanceSummaryTool,
  getMyAttendanceTool,
  listEmployeesTool,
  getPendingApprovalsTool,
  getHeadcountTool,
];

// ─── Permission filter ────────────────────────────────────────────────────────

async function getPermittedTools(
  userId: number,
  permissions: Record<string, Record<string, boolean>>
): Promise<AssistantTool[]> {
  return ALL_ASSISTANT_TOOLS.filter(tool => {
    if (!tool.requiredPermission) return true; // no permission required
    const { module, action } = tool.requiredPermission;
    return permissions[module]?.[action] === true;
  });
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(
  userName: string,
  permittedToolNames: string[],
  employeeId: number | null
): string {
  const today = new Date().toISOString().split("T")[0];
  return `You are Flow, the AI Assistant embedded in CORE HR — a Human Resources Management platform.
You are helping ${userName} today (${today}).
${employeeId ? `Their employee ID is ${employeeId}.` : "Note: this user does not have a linked employee record."}

Your role:
- Answer HR-related questions conversationally and helpfully
- Use the available tools to fetch real data when needed
- For WRITE actions (apply_leave, etc.): ALWAYS describe what you are about to do and ask for explicit confirmation BEFORE calling the tool. Say something like "I'm about to submit a leave request for X days from [date] to [date] for [reason]. Shall I proceed?"
- Never bypass approval workflows — leave requests go through the normal approval process
- Respect the user's data scope — only show data they are permitted to see
- If asked to do something outside your permitted tools, politely explain you don't have access to that

Available tools: ${permittedToolNames.join(", ")}

Keep responses concise and friendly. Use bullet points for lists. Format dates as human-readable.`;
}

// ─── Message schema ───────────────────────────────────────────────────────────

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const aiAssistantRouter = router({
  /**
   * Main conversational endpoint.
   * Sends the conversation history to the LLM with permission-filtered tools.
   * Write tools are flagged as "pending_confirmation" and NOT auto-executed.
   */
  chat: protectedProcedure
    .input(z.object({
      messages: z.array(messageSchema).min(1).max(50),
      // If the user confirmed a pending write action, pass it here to execute
      confirmedAction: z.object({
        toolName: z.string(),
        args: z.record(z.string(), z.unknown()),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user!.id;
      const userName = ctx.user!.name ?? "User";

      // Resolve linked employee
      const profile = await getUserProfileByUserId(userId);
      const employeeId = profile?.employeeId ?? null;

      // Resolve effective permissions
      const permissions = await getEffectivePermissions(userId, COMPANY_ID);

      // If a confirmed write action is being executed, run it now
      if (input.confirmedAction) {
        const { toolName, args } = input.confirmedAction;
        const tool = ALL_ASSISTANT_TOOLS.find(t => t.name === toolName);
        if (!tool) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown tool: ${toolName}` });
        }
        if (tool.category !== "write") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only write actions require confirmation." });
        }
        // Re-check permission
        if (tool.requiredPermission) {
          const { module, action } = tool.requiredPermission;
          if (!permissions[module]?.[action]) {
            throw new TRPCError({ code: "FORBIDDEN", message: `You don't have permission to ${action} ${module}.` });
          }
        }
        try {
          const result = await tool.execute(args, userId, employeeId);
          return {
            type: "action_result" as const,
            toolName,
            result,
            message: `Action completed: ${toolName.replace(/_/g, " ")}`,
          };
        } catch (err) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Action failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      // Get permitted tools for this user
      const permittedTools = await getPermittedTools(userId, permissions);
      const permittedToolNames = permittedTools.map(t => t.name);

      // Build system prompt
      const systemPrompt = buildSystemPrompt(userName, permittedToolNames, employeeId);

      // Build LLM messages
      const llmMessages: Message[] = [
        { role: "system", content: systemPrompt },
        ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      // Build tool definitions for the LLM (only permitted tools)
      const llmTools: Tool[] = permittedTools.map(t => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

      // Agentic loop: run until no more tool calls or max 5 iterations
      let currentMessages = [...llmMessages];
      const toolCallsMade: Array<{ toolName: string; args: Record<string, unknown>; result: unknown }> = [];
      let pendingConfirmation: { toolName: string; args: Record<string, unknown>; description: string } | null = null;
      let finalContent = "";
      let iterations = 0;
      const MAX_ITERATIONS = 5;

      while (iterations < MAX_ITERATIONS) {
        iterations++;

        const response = await invokeLLM({
          messages: currentMessages,
          tools: llmTools.length > 0 ? llmTools : undefined,
          maxTokens: 1024,
        });

        const choice = response.choices[0];
        if (!choice) break;

        const assistantMessage = choice.message;
        const toolCalls = assistantMessage.tool_calls;

        // No tool calls — we have the final response
        if (!toolCalls || toolCalls.length === 0) {
          finalContent = typeof assistantMessage.content === "string"
            ? assistantMessage.content
            : "";
          break;
        }

        // Process tool calls
        const toolResults: Message[] = [];
        let shouldPause = false;

        for (const call of toolCalls) {
          const toolName = call.function.name;
          const tool = permittedTools.find(t => t.name === toolName);

          if (!tool) {
            toolResults.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: `Tool "${toolName}" not available.` }),
            });
            continue;
          }

          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            toolResults.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: "Failed to parse tool arguments." }),
            });
            continue;
          }

          // WRITE tools — do NOT auto-execute, pause for confirmation
          if (tool.category === "write") {
            pendingConfirmation = {
              toolName,
              args,
              description: buildActionDescription(toolName, args),
            };
            shouldPause = true;
            // Tell the model we're pausing for confirmation
            toolResults.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({
                status: "awaiting_confirmation",
                message: "This action requires explicit user confirmation before proceeding.",
              }),
            });
            break; // Stop processing further tool calls
          }

          // READ tools — execute immediately
          try {
            const result = await tool.execute(args, userId, employeeId);
            toolCallsMade.push({ toolName, args, result });
            toolResults.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            toolResults.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
            });
          }
        }

        // Add assistant message and tool results to conversation
        currentMessages.push({
          role: "assistant",
          content: typeof assistantMessage.content === "string" ? assistantMessage.content : "",
          tool_calls: toolCalls,
        } as Message);
        currentMessages.push(...toolResults);

        if (shouldPause) {
          // Get the model to generate a confirmation prompt message
          const confirmResponse = await invokeLLM({
            messages: [
              ...currentMessages,
              {
                role: "user",
                content: "Please describe what action you're about to take and ask the user to confirm.",
              },
            ],
            maxTokens: 512,
          });
          finalContent = typeof confirmResponse.choices[0]?.message.content === "string"
            ? confirmResponse.choices[0].message.content
            : `I'm about to ${buildActionDescription(pendingConfirmation!.toolName, pendingConfirmation!.args)}. Shall I proceed?`;
          break;
        }

        if (choice.finish_reason === "stop") {
          finalContent = typeof assistantMessage.content === "string"
            ? assistantMessage.content
            : "";
          break;
        }
      }

      return {
        type: "chat_response" as const,
        content: finalContent,
        toolCallsMade,
        pendingConfirmation,
      };
    }),

  /**
   * Get context-aware suggested prompts based on the user's role and current state.
   */
  getSuggestions: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user!.id;
      const profile = await getUserProfileByUserId(userId);
      const employeeId = profile?.employeeId ?? null;
      const permissions = await getEffectivePermissions(userId, COMPANY_ID);

      const suggestions: string[] = [];

      // Everyone
      if (employeeId) {
        suggestions.push("What's my leave balance?");
        suggestions.push("Show my recent attendance");
        suggestions.push("Apply for annual leave next week");
      }

      // Leave viewers
      if (permissions.leave?.view) {
        suggestions.push("Who is on leave today?");
        suggestions.push("Show my pending leave requests");
      }

      // Employee viewers (managers/HR)
      if (permissions.employees?.view) {
        suggestions.push("How many employees are in Engineering?");
        suggestions.push("List active employees");
      }

      // Report viewers (HR/managers)
      if (permissions.reports?.view) {
        suggestions.push("What's our current headcount?");
        suggestions.push("Show headcount by department");
      }

      // Workflow viewers
      if (permissions.workflow?.view) {
        suggestions.push("How many approvals are pending?");
      }

      return suggestions.slice(0, 6);
    }),
});

// ─── Helper: build human-readable action description ─────────────────────────

function buildActionDescription(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "apply_leave":
      return `submit a ${args.leaveTypeName ?? "leave"} request from ${args.startDate} to ${args.endDate} (reason: ${args.reason ?? "not specified"})`;
    default:
      return `${toolName.replace(/_/g, " ")} with the provided parameters`;
  }
}
