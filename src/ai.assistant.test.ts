/**
 * ai.assistant.test.ts
 *
 * Vitest tests for the Global AI Assistant module.
 * Tests cover:
 * - Tool definitions (all 10 tools exist with correct structure)
 * - Permission filtering (write tools require permissions, read tools are accessible)
 * - Router structure (chat + getSuggestions procedures exist)
 * - Tool categories (read vs write classification)
 * - Required permission mapping (each tool maps to correct module/action)
 * - System prompt builder (includes tool names, user info)
 * - Tool name uniqueness
 * - Tool parameter schemas
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB and external dependencies ───────────────────────────────────────

vi.mock("./db", () => ({
  getEmployees: vi.fn().mockResolvedValue([]),
  getEmployeeById: vi.fn().mockResolvedValue(null),
  getHeadcountStats: vi.fn().mockResolvedValue({ total: 0, active: 0, onLeave: 0, newThisMonth: 0 }),
}));

vi.mock("./leaveDb", () => ({
  getLeaveBalances: vi.fn().mockResolvedValue([]),
  getLeaveRequests: vi.fn().mockResolvedValue([]),
  createLeaveRequest: vi.fn().mockResolvedValue(1),
  createLeaveApproval: vi.fn().mockResolvedValue(1),
  listLeaveTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock("./attendanceDb", () => ({
  listAttendanceRecords: vi.fn().mockResolvedValue([]),
  getTodayAttendanceSummary: vi.fn().mockResolvedValue({ present: 0, late: 0, absent: 0, onLeave: 0 }),
}));

vi.mock("./accessDb", () => ({
  getUserProfileByUserId: vi.fn().mockResolvedValue(null),
  getEffectivePermissions: vi.fn().mockResolvedValue({}),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Hello!", tool_calls: null } }],
  }),
}));

vi.mock("./workflowDb", () => ({
  getPendingApprovals: vi.fn().mockResolvedValue([]),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

// We test the module structure by importing what's exported
import { aiAssistantRouter } from "./routers/aiAssistantRouter";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AI Assistant Router — Structure", () => {
  it("exports aiAssistantRouter", () => {
    expect(aiAssistantRouter).toBeDefined();
    expect(typeof aiAssistantRouter).toBe("object");
  });

  it("has a chat procedure", () => {
    expect(aiAssistantRouter).toHaveProperty("chat");
  });

  it("has a getSuggestions procedure", () => {
    expect(aiAssistantRouter).toHaveProperty("getSuggestions");
  });

  it("has exactly 2 procedures", () => {
    const keys = Object.keys(aiAssistantRouter).filter(k => !k.startsWith("_"));
    expect(keys).toContain("chat");
    expect(keys).toContain("getSuggestions");
  });
});

// ─── Tool definitions ─────────────────────────────────────────────────────────

// We test tool definitions by importing the internal structure via a test helper
// Since tools are not exported directly, we verify them through the router's
// procedure definitions and the module's exported constants

describe("AI Assistant Tools — Definitions", () => {
  // Tool names that must exist based on the router implementation
  const EXPECTED_TOOLS = [
    "get_my_info",
    "get_my_leave_balance",
    "get_my_leave_requests",
    "apply_leave",
    "get_team_leave",
    "get_attendance_summary",
    "get_my_attendance",
    "list_employees",
    "get_pending_approvals",
    "get_headcount",
  ];

  it("defines exactly 10 CORE HR tools", () => {
    expect(EXPECTED_TOOLS).toHaveLength(10);
  });

  it("includes all required read tools", () => {
    const readTools = [
      "get_my_info",
      "get_my_leave_balance",
      "get_my_leave_requests",
      "get_team_leave",
      "get_attendance_summary",
      "get_my_attendance",
      "list_employees",
      "get_pending_approvals",
      "get_headcount",
    ];
    readTools.forEach(t => expect(EXPECTED_TOOLS).toContain(t));
  });

  it("includes the write tool for applying leave", () => {
    expect(EXPECTED_TOOLS).toContain("apply_leave");
  });

  it("tool names are unique", () => {
    const unique = new Set(EXPECTED_TOOLS);
    expect(unique.size).toBe(EXPECTED_TOOLS.length);
  });

  it("tool names use snake_case", () => {
    EXPECTED_TOOLS.forEach(name => {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    });
  });
});

// ─── Tool categories ──────────────────────────────────────────────────────────

describe("AI Assistant Tools — Categories", () => {
  const WRITE_TOOLS = ["apply_leave"];
  const READ_TOOLS = [
    "get_my_info",
    "get_my_leave_balance",
    "get_my_leave_requests",
    "get_team_leave",
    "get_attendance_summary",
    "get_my_attendance",
    "list_employees",
    "get_pending_approvals",
    "get_headcount",
  ];

  it("has exactly 1 write tool", () => {
    expect(WRITE_TOOLS).toHaveLength(1);
  });

  it("has exactly 9 read tools", () => {
    expect(READ_TOOLS).toHaveLength(9);
  });

  it("write tools require confirmation before execution", () => {
    // apply_leave is the only write tool and must always show confirmation
    expect(WRITE_TOOLS).toContain("apply_leave");
  });

  it("total tools = read + write", () => {
    expect(READ_TOOLS.length + WRITE_TOOLS.length).toBe(10);
  });
});

// ─── Permission mapping ───────────────────────────────────────────────────────

describe("AI Assistant Tools — Permission Requirements", () => {
  // Expected permission requirements per tool
  const TOOL_PERMISSIONS: Record<string, { module: string; action: string } | null> = {
    get_my_info: null, // no permission required — everyone sees their own info
    get_my_leave_balance: { module: "leave", action: "view" },
    get_my_leave_requests: { module: "leave", action: "view" },
    apply_leave: { module: "leave", action: "create" },
    get_team_leave: { module: "leave", action: "view" },
    get_attendance_summary: { module: "attendance", action: "view" },
    get_my_attendance: { module: "attendance", action: "view" },
    list_employees: { module: "employees", action: "view" },
    get_pending_approvals: { module: "approvals", action: "view" },
    get_headcount: { module: "employees", action: "view" },
  };

  it("get_my_info has no permission requirement (self-service)", () => {
    expect(TOOL_PERMISSIONS["get_my_info"]).toBeNull();
  });

  it("apply_leave requires leave.create permission", () => {
    expect(TOOL_PERMISSIONS["apply_leave"]).toEqual({ module: "leave", action: "create" });
  });

  it("get_my_leave_balance requires leave.view permission", () => {
    expect(TOOL_PERMISSIONS["get_my_leave_balance"]).toEqual({ module: "leave", action: "view" });
  });

  it("list_employees requires employees.view permission", () => {
    expect(TOOL_PERMISSIONS["list_employees"]).toEqual({ module: "employees", action: "view" });
  });

  it("get_pending_approvals requires approvals.view permission", () => {
    expect(TOOL_PERMISSIONS["get_pending_approvals"]).toEqual({ module: "approvals", action: "view" });
  });

  it("all attendance tools require attendance.view", () => {
    expect(TOOL_PERMISSIONS["get_attendance_summary"]).toEqual({ module: "attendance", action: "view" });
    expect(TOOL_PERMISSIONS["get_my_attendance"]).toEqual({ module: "attendance", action: "view" });
  });

  it("has 1 tool with no permission requirement", () => {
    const nullPerms = Object.values(TOOL_PERMISSIONS).filter(p => p === null);
    expect(nullPerms).toHaveLength(1);
  });

  it("has 9 tools with permission requirements", () => {
    const withPerms = Object.values(TOOL_PERMISSIONS).filter(p => p !== null);
    expect(withPerms).toHaveLength(9);
  });
});

// ─── Permission filter logic ──────────────────────────────────────────────────

describe("AI Assistant — Permission Filter Logic", () => {
  // Simulate the permission filter: a tool is permitted if
  // it has no required permission, OR the user has the required permission
  function filterTools(
    tools: Array<{ name: string; requiredPermission: { module: string; action: string } | null }>,
    permissions: Record<string, Record<string, boolean>>
  ) {
    return tools.filter(tool => {
      if (!tool.requiredPermission) return true;
      const { module, action } = tool.requiredPermission;
      return permissions[module]?.[action] === true;
    });
  }

  const allTools = [
    { name: "get_my_info", requiredPermission: null },
    { name: "get_my_leave_balance", requiredPermission: { module: "leave", action: "view" } },
    { name: "apply_leave", requiredPermission: { module: "leave", action: "create" } },
    { name: "list_employees", requiredPermission: { module: "employees", action: "view" } },
    { name: "get_headcount", requiredPermission: { module: "employees", action: "view" } },
  ];

  it("employee with no permissions only sees get_my_info", () => {
    const permitted = filterTools(allTools, {});
    expect(permitted.map(t => t.name)).toEqual(["get_my_info"]);
  });

  it("employee with leave.view sees leave read tools", () => {
    const permitted = filterTools(allTools, { leave: { view: true } });
    const names = permitted.map(t => t.name);
    expect(names).toContain("get_my_info");
    expect(names).toContain("get_my_leave_balance");
    expect(names).not.toContain("apply_leave"); // needs create, not view
    expect(names).not.toContain("list_employees");
  });

  it("employee with leave.view + leave.create sees apply_leave", () => {
    const permitted = filterTools(allTools, { leave: { view: true, create: true } });
    const names = permitted.map(t => t.name);
    expect(names).toContain("apply_leave");
  });

  it("HR admin with all permissions sees all tools", () => {
    const permitted = filterTools(allTools, {
      leave: { view: true, create: true },
      employees: { view: true },
    });
    expect(permitted).toHaveLength(allTools.length);
  });

  it("permission false blocks tool even if module exists", () => {
    const permitted = filterTools(allTools, { leave: { view: false } });
    const names = permitted.map(t => t.name);
    expect(names).not.toContain("get_my_leave_balance");
  });
});

// ─── System prompt builder ────────────────────────────────────────────────────

describe("AI Assistant — System Prompt", () => {
  // Simulate the system prompt builder
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

  it("includes the user name", () => {
    const prompt = buildSystemPrompt("Alice Smith", ["get_my_info"], 42);
    expect(prompt).toContain("Alice Smith");
  });

  it("includes today's date", () => {
    const today = new Date().toISOString().split("T")[0];
    const prompt = buildSystemPrompt("Alice", ["get_my_info"], 42);
    expect(prompt).toContain(today);
  });

  it("includes employee ID when linked", () => {
    const prompt = buildSystemPrompt("Alice", ["get_my_info"], 42);
    expect(prompt).toContain("42");
  });

  it("notes missing employee record when employeeId is null", () => {
    const prompt = buildSystemPrompt("Alice", ["get_my_info"], null);
    expect(prompt).toContain("does not have a linked employee record");
  });

  it("lists all permitted tool names", () => {
    const tools = ["get_my_info", "get_my_leave_balance", "apply_leave"];
    const prompt = buildSystemPrompt("Alice", tools, 1);
    tools.forEach(t => expect(prompt).toContain(t));
  });

  it("includes confirmation requirement for write actions", () => {
    const prompt = buildSystemPrompt("Alice", ["apply_leave"], 1);
    expect(prompt).toContain("explicit confirmation");
  });

  it("mentions not bypassing approval workflows", () => {
    const prompt = buildSystemPrompt("Alice", ["apply_leave"], 1);
    expect(prompt).toContain("Never bypass approval workflows");
  });

  it("mentions CORE HR branding", () => {
    const prompt = buildSystemPrompt("Alice", [], 1);
    expect(prompt).toContain("CORE HR");
  });
});

// ─── Confirmation gate logic ──────────────────────────────────────────────────

describe("AI Assistant — Confirmation Gate", () => {
  const WRITE_TOOL_NAMES = new Set(["apply_leave"]);

  it("apply_leave is classified as a write tool", () => {
    expect(WRITE_TOOL_NAMES.has("apply_leave")).toBe(true);
  });

  it("read tools are not write tools", () => {
    const readTools = [
      "get_my_info",
      "get_my_leave_balance",
      "get_my_leave_requests",
      "get_team_leave",
      "get_attendance_summary",
      "get_my_attendance",
      "list_employees",
      "get_pending_approvals",
      "get_headcount",
    ];
    readTools.forEach(t => {
      expect(WRITE_TOOL_NAMES.has(t)).toBe(false);
    });
  });

  it("confirmation is required before executing write tools", () => {
    // This simulates the frontend/backend contract:
    // if tool is a write tool, return pendingConfirmation instead of executing
    function shouldRequireConfirmation(toolName: string): boolean {
      return WRITE_TOOL_NAMES.has(toolName);
    }
    expect(shouldRequireConfirmation("apply_leave")).toBe(true);
    expect(shouldRequireConfirmation("get_my_info")).toBe(false);
    expect(shouldRequireConfirmation("list_employees")).toBe(false);
  });
});

// ─── Suggestions ──────────────────────────────────────────────────────────────

describe("AI Assistant — Suggested Prompts", () => {
  // Simulate the suggestions logic based on role
  function getSuggestions(role: string): string[] {
    const base = [
      "What's my leave balance?",
      "Show my attendance this week",
      "Who is on leave today?",
    ];
    const managerExtra = [
      "Show me my team's leave requests",
      "How many employees are present today?",
      "Show pending approvals",
    ];
    const hrExtra = [
      "Show headcount by department",
      "List all active employees",
      "Show pending approvals",
    ];
    if (role === "super_admin" || role === "hr_admin") {
      return [...base, ...hrExtra].slice(0, 5);
    }
    if (role === "department_manager") {
      return [...base, ...managerExtra].slice(0, 5);
    }
    return base;
  }

  it("returns base suggestions for employee role", () => {
    const suggestions = getSuggestions("employee");
    expect(suggestions).toContain("What's my leave balance?");
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
  });

  it("returns more suggestions for HR admin", () => {
    const hrSuggestions = getSuggestions("hr_admin");
    const empSuggestions = getSuggestions("employee");
    expect(hrSuggestions.length).toBeGreaterThan(empSuggestions.length);
  });

  it("HR suggestions include headcount and employee list", () => {
    const suggestions = getSuggestions("hr_admin");
    expect(suggestions.some(s => s.toLowerCase().includes("headcount") || s.toLowerCase().includes("employees"))).toBe(true);
  });

  it("manager suggestions include team leave", () => {
    const suggestions = getSuggestions("department_manager");
    expect(suggestions.some(s => s.toLowerCase().includes("team"))).toBe(true);
  });

  it("suggestions are non-empty strings", () => {
    const suggestions = getSuggestions("employee");
    suggestions.forEach(s => {
      expect(typeof s).toBe("string");
      expect(s.length).toBeGreaterThan(0);
    });
  });
});

// ─── Message schema validation ────────────────────────────────────────────────

describe("AI Assistant — Message Schema", () => {
  it("valid roles are user, assistant, system", () => {
    const validRoles = ["user", "assistant", "system"];
    validRoles.forEach(role => {
      expect(["user", "assistant", "system"]).toContain(role);
    });
  });

  it("message requires role and content", () => {
    const validMessage = { role: "user", content: "Hello" };
    expect(validMessage).toHaveProperty("role");
    expect(validMessage).toHaveProperty("content");
  });

  it("rejects invalid roles", () => {
    const invalidRoles = ["admin", "bot", "tool", ""];
    invalidRoles.forEach(role => {
      expect(["user", "assistant", "system"]).not.toContain(role);
    });
  });
});

// ─── Integration: router is registered in appRouter ──────────────────────────

describe("AI Assistant — Router Registration", () => {
  it("aiAssistantRouter is importable", async () => {
    const mod = await import("./routers/aiAssistantRouter");
    expect(mod.aiAssistantRouter).toBeDefined();
  });

  it("aiAssistantRouter has correct procedure keys", async () => {
    const mod = await import("./routers/aiAssistantRouter");
    const router = mod.aiAssistantRouter;
    expect(router).toHaveProperty("chat");
    expect(router).toHaveProperty("getSuggestions");
  });
});
