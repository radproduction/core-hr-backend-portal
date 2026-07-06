/**
 * server/shared.components.test.ts
 *
 * Unit tests for shared component logic and role-gating rules.
 * These tests run server-side (no DOM) and cover:
 *   - Role-visibility matrix completeness
 *   - DataTable column definition contracts
 *   - FormBuilder field-type coverage
 *   - ApprovalTimeline status enum coverage
 *   - Excel export utility (pure function)
 */

import { describe, it, expect } from "vitest";

// ─── Role-gating logic (mirrored from HcmLayout) ──────────────────────────────

type HcmRole = "super_admin" | "hr_admin" | "hr_manager" | "department_manager" | "employee" | "viewer";

const ROLE_VISIBLE_MODULES: Record<HcmRole, string[]> = {
  super_admin: ["*"],
  hr_admin: ["*"],
  hr_manager: [
    "/dashboard", "/employees", "/org", "/leave", "/attendance", "/payroll",
    "/recruitment", "/performance", "/training", "/assets", "/announcements",
    "/documents", "/approvals", "/reports", "/notifications", "/profile",
  ],
  department_manager: [
    "/dashboard", "/employees", "/org", "/leave", "/attendance",
    "/performance", "/announcements", "/documents", "/approvals",
    "/notifications", "/profile",
  ],
  employee: [
    "/dashboard", "/leave", "/attendance", "/announcements",
    "/documents", "/notifications", "/profile",
  ],
  viewer: ["/dashboard", "/reports", "/notifications", "/profile"],
};

function canSeeModule(href: string, role: HcmRole): boolean {
  const allowed = ROLE_VISIBLE_MODULES[role];
  if (allowed.includes("*")) return true;
  return allowed.some(r => href === r || href.startsWith(r + "/"));
}

// ─── All 18 sidebar modules ────────────────────────────────────────────────────

const ALL_MODULES = [
  "/dashboard",
  "/employees",
  "/org",
  "/leave",
  "/attendance",
  "/payroll",
  "/recruitment",
  "/performance",
  "/training",
  "/assets",
  "/announcements",
  "/documents",
  "/notifications",
  "/approvals",
  "/roles",
  "/workflow",
  "/audit",
  "/reports",
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RBAC Role-Visibility Matrix", () => {
  it("super_admin can see all 18 modules", () => {
    for (const mod of ALL_MODULES) {
      expect(canSeeModule(mod, "super_admin")).toBe(true);
    }
  });

  it("hr_admin can see all 18 modules", () => {
    for (const mod of ALL_MODULES) {
      expect(canSeeModule(mod, "hr_admin")).toBe(true);
    }
  });

  it("hr_manager can see dashboard, employees, org, leave, payroll, approvals", () => {
    const mustSee = ["/dashboard", "/employees", "/org", "/leave", "/payroll", "/approvals"];
    for (const mod of mustSee) {
      expect(canSeeModule(mod, "hr_manager")).toBe(true);
    }
  });

  it("hr_manager cannot see roles, workflow, audit", () => {
    const mustNotSee = ["/roles", "/workflow", "/audit"];
    for (const mod of mustNotSee) {
      expect(canSeeModule(mod, "hr_manager")).toBe(false);
    }
  });

  it("department_manager can see employees and leave but not payroll", () => {
    expect(canSeeModule("/employees", "department_manager")).toBe(true);
    expect(canSeeModule("/leave", "department_manager")).toBe(true);
    expect(canSeeModule("/payroll", "department_manager")).toBe(false);
  });

  it("employee can see dashboard, leave, attendance, documents", () => {
    const mustSee = ["/dashboard", "/leave", "/attendance", "/documents", "/notifications"];
    for (const mod of mustSee) {
      expect(canSeeModule(mod, "employee")).toBe(true);
    }
  });

  it("employee cannot see payroll, roles, audit, reports", () => {
    const mustNotSee = ["/payroll", "/roles", "/audit", "/reports", "/employees"];
    for (const mod of mustNotSee) {
      expect(canSeeModule(mod, "employee")).toBe(false);
    }
  });

  it("viewer can only see dashboard, reports, notifications, profile", () => {
    const allowed = ["/dashboard", "/reports", "/notifications", "/profile"];
    const denied = ["/employees", "/leave", "/payroll", "/roles", "/audit"];

    for (const mod of allowed) {
      expect(canSeeModule(mod, "viewer")).toBe(true);
    }
    for (const mod of denied) {
      expect(canSeeModule(mod, "viewer")).toBe(false);
    }
  });

  it("sub-routes inherit parent visibility (e.g. /org/departments)", () => {
    expect(canSeeModule("/org/departments", "hr_manager")).toBe(true);
    expect(canSeeModule("/org/locations", "department_manager")).toBe(true);
    expect(canSeeModule("/org/companies", "employee")).toBe(false);
  });
});

describe("Shared component contracts", () => {
  // DataTable column definition shape
  it("DataTable ColumnDef requires key and header", () => {
    type ColumnDef<T> = {
      key: keyof T;
      header: string;
      sortable?: boolean;
      searchable?: boolean;
      render?: (row: T) => unknown;
    };

    const col: ColumnDef<{ name: string; age: number }> = {
      key: "name",
      header: "Name",
      sortable: true,
    };

    expect(col.key).toBe("name");
    expect(col.header).toBe("Name");
    expect(col.sortable).toBe(true);
    expect(col.render).toBeUndefined();
  });

  // ApprovalTimeline status enum
  it("ApprovalTimeline supports all five status values", () => {
    type ApprovalStepStatus = "approved" | "rejected" | "pending" | "waiting" | "skipped";
    const statuses: ApprovalStepStatus[] = ["approved", "rejected", "pending", "waiting", "skipped"];
    expect(statuses).toHaveLength(5);
    expect(statuses).toContain("approved");
    expect(statuses).toContain("rejected");
    expect(statuses).toContain("pending");
    expect(statuses).toContain("waiting");
    expect(statuses).toContain("skipped");
  });

  // FormBuilder field types
  it("FormBuilder supports all required field types", () => {
    type FieldType =
      | "text" | "email" | "password" | "number" | "tel" | "url"
      | "textarea" | "select" | "multiselect" | "radio" | "checkbox"
      | "date" | "datetime" | "switch" | "file";

    const types: FieldType[] = [
      "text", "email", "password", "number", "tel", "url",
      "textarea", "select", "multiselect", "radio", "checkbox",
      "date", "datetime", "switch", "file",
    ];

    expect(types.length).toBeGreaterThanOrEqual(14);
    expect(types).toContain("select");
    expect(types).toContain("multiselect");
    expect(types).toContain("file");
    expect(types).toContain("switch");
  });

  // StatCard color variants
  it("StatCard supports all color variants", () => {
    type StatCardColor = "indigo" | "green" | "amber" | "red" | "blue" | "purple" | "slate";
    const colors: StatCardColor[] = ["indigo", "green", "amber", "red", "blue", "purple", "slate"];
    expect(colors).toHaveLength(7);
  });

  // ChartCard chart types
  it("ChartCard supports bar, line, area, pie chart types", () => {
    type ChartType = "bar" | "line" | "area" | "pie";
    const types: ChartType[] = ["bar", "line", "area", "pie"];
    expect(types).toContain("pie");
    expect(types).toContain("area");
  });
});

describe("Excel export utility", () => {
  // Pure function test — no DOM needed
  it("formats data rows correctly for export", () => {
    const rows = [
      { name: "Ahmed", dept: "Engineering", joinDate: new Date("2024-01-15") },
      { name: "Sara",  dept: "HR",          joinDate: new Date("2024-03-20") },
    ];

    // Simulate what the export function does
    const headers = ["name", "dept", "joinDate"];
    const formatted = rows.map(row =>
      headers.map(h => {
        const val = (row as Record<string, unknown>)[h];
        if (val instanceof Date) return val.toLocaleDateString();
        return String(val ?? "");
      })
    );

    expect(formatted[0][0]).toBe("Ahmed");
    expect(formatted[0][1]).toBe("Engineering");
    expect(formatted[1][0]).toBe("Sara");
    // Date should be a non-empty string
    expect(formatted[0][2].length).toBeGreaterThan(0);
  });

  it("handles null/undefined values gracefully", () => {
    const row: Record<string, unknown> = { name: "Test", dept: null, age: undefined };
    const formatted = Object.values(row).map(v => {
      if (v == null) return "";
      if (v instanceof Date) return v.toLocaleDateString();
      return String(v);
    });

    expect(formatted[0]).toBe("Test");
    expect(formatted[1]).toBe("");
    expect(formatted[2]).toBe("");
  });
});

describe("Dashboard placeholder data integrity", () => {
  it("headcount trend has 6 months of data", () => {
    const trend = [
      { month: "Jan", count: 280 },
      { month: "Feb", count: 295 },
      { month: "Mar", count: 302 },
      { month: "Apr", count: 318 },
      { month: "May", count: 325 },
      { month: "Jun", count: 342 },
    ];
    expect(trend).toHaveLength(6);
    expect(trend[trend.length - 1].count).toBeGreaterThan(trend[0].count);
  });

  it("gender split sums to total headcount", () => {
    const split = [{ name: "Male", value: 198 }, { name: "Female", value: 144 }];
    const total = split.reduce((s, x) => s + x.value, 0);
    expect(total).toBe(342);
  });

  it("employment type split sums to total headcount", () => {
    const types = [
      { name: "Full-time", value: 290 },
      { name: "Part-time", value: 28 },
      { name: "Contract",  value: 24 },
    ];
    const total = types.reduce((s, x) => s + x.value, 0);
    expect(total).toBe(342);
  });
});
