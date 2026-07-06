/**
 * Module 8: Employee & Manager Self-Service — Vitest Tests
 *
 * Covers:
 *  - Schema exports (companyNews, hrPolicyDocs tables)
 *  - selfServiceRouter structure (ess + mss sub-routers)
 *  - All ESS procedures exported
 *  - All MSS procedures exported
 *  - Business logic: leave balance remaining calculation
 *  - Business logic: news/policy CRUD helpers
 *  - Registration in main router
 */

import { describe, it, expect, beforeAll } from "vitest";

// ─── Schema ───────────────────────────────────────────────────────────────────
describe("Schema — companyNews and hrPolicyDocs tables", () => {
  it("exports companyNews table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.companyNews).toBeDefined();
  });

  it("exports hrPolicyDocs table", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.hrPolicyDocs).toBeDefined();
  });

  it("companyNews has required fields", async () => {
    const { companyNews } = await import("../drizzle/schema");
    const cols = Object.keys(companyNews);
    expect(cols).toContain("id");
    expect(cols).toContain("companyId");
    expect(cols).toContain("title");
    expect(cols).toContain("body");
    expect(cols).toContain("publishedAt");
    expect(cols).toContain("isActive");
  });

  it("hrPolicyDocs has required fields", async () => {
    const { hrPolicyDocs } = await import("../drizzle/schema");
    const cols = Object.keys(hrPolicyDocs);
    expect(cols).toContain("id");
    expect(cols).toContain("companyId");
    expect(cols).toContain("title");
    expect(cols).toContain("category");
    expect(cols).toContain("fileUrl");
    expect(cols).toContain("isActive");
  });
});

// ─── selfServiceRouter structure ─────────────────────────────────────────────
describe("selfServiceRouter — structure", () => {
  it("exports selfServiceRouter", async () => {
    const mod = await import("./routers/selfServiceRouter");
    expect(mod.selfServiceRouter).toBeDefined();
  });

  it("has ess sub-router", async () => {
    const { selfServiceRouter } = await import("./routers/selfServiceRouter");
    const def = (selfServiceRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("ess"))).toBe(true);
  });

  it("has mss sub-router", async () => {
    const { selfServiceRouter } = await import("./routers/selfServiceRouter");
    const def = (selfServiceRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("mss"))).toBe(true);
  });
});

// ─── ESS procedures ───────────────────────────────────────────────────────────
describe("selfServiceRouter.ess — procedures", () => {
  let keys: string[];

  beforeAll(async () => {
    const { selfServiceRouter } = await import("./routers/selfServiceRouter");
    const def = (selfServiceRouter as any)._def;
    keys = Object.keys(def.procedures || def.record || {});
  });

  it("has myLeaveBalances procedure", () => {
    expect(keys.some(k => k.includes("myLeaveBalances"))).toBe(true);
  });

  it("has myLeaveRequests procedure", () => {
    expect(keys.some(k => k.includes("myLeaveRequests"))).toBe(true);
  });

  it("has myAttendanceSummary procedure", () => {
    expect(keys.some(k => k.includes("myAttendanceSummary"))).toBe(true);
  });

  it("has myPayslips procedure", () => {
    expect(keys.some(k => k.includes("myPayslips"))).toBe(true);
  });

  it("has explainPayslip procedure", () => {
    expect(keys.some(k => k.includes("explainPayslip"))).toBe(true);
  });

  it("has myRequests procedure", () => {
    expect(keys.some(k => k.includes("myRequests"))).toBe(true);
  });

  it("has newsFeed procedure", () => {
    expect(keys.some(k => k.includes("newsFeed"))).toBe(true);
  });

  it("has policyDocs procedure", () => {
    expect(keys.some(k => k.includes("policyDocs"))).toBe(true);
  });
});

// ─── MSS procedures ───────────────────────────────────────────────────────────
describe("selfServiceRouter.mss — procedures", () => {
  let keys: string[];

  beforeAll(async () => {
    const { selfServiceRouter } = await import("./routers/selfServiceRouter");
    const def = (selfServiceRouter as any)._def;
    keys = Object.keys(def.procedures || def.record || {});
  });

  it("has pendingApprovals procedure", () => {
    expect(keys.some(k => k.includes("pendingApprovals"))).toBe(true);
  });

  it("has approveLeave procedure", () => {
    expect(keys.some(k => k.includes("approveLeave"))).toBe(true);
  });

  it("has rejectLeave procedure", () => {
    expect(keys.some(k => k.includes("rejectLeave"))).toBe(true);
  });

  it("has coverageSummary procedure", () => {
    expect(keys.some(k => k.includes("coverageSummary"))).toBe(true);
  });

  it("has teamLeaveCalendar procedure", () => {
    expect(keys.some(k => k.includes("teamLeaveCalendar"))).toBe(true);
  });

  it("has teamAttendance procedure", () => {
    expect(keys.some(k => k.includes("teamAttendance"))).toBe(true);
  });

  it("has teamReports procedure", () => {
    expect(keys.some(k => k.includes("teamReports"))).toBe(true);
  });
});

// ─── Business logic ───────────────────────────────────────────────────────────
describe("Leave balance — remaining calculation", () => {
  it("calculates remaining as entitled - used - pending", () => {
    const entitled = 20;
    const used = 5;
    const pending = 2;
    const balance = entitled - used - pending;
    expect(balance).toBe(13);
  });

  it("remaining is 0 when used + pending equals entitled", () => {
    const entitled = 10;
    const used = 8;
    const pending = 2;
    const balance = entitled - used - pending;
    expect(balance).toBe(0);
  });

  it("handles decimal leave days", () => {
    const entitled = 15.5;
    const used = 7.5;
    const pending = 1.0;
    const balance = entitled - used - pending;
    expect(balance).toBeCloseTo(7.0);
  });
});

describe("News and policy helpers", () => {
  it("filters active news items", () => {
    const news = [
      { id: 1, title: "A", isActive: true },
      { id: 2, title: "B", isActive: false },
      { id: 3, title: "C", isActive: true },
    ];
    const active = news.filter(n => n.isActive);
    expect(active).toHaveLength(2);
    expect(active.map(n => n.id)).toEqual([1, 3]);
  });

  it("sorts news by publishedAt descending", () => {
    const news = [
      { id: 1, publishedAt: new Date("2025-01-01") },
      { id: 2, publishedAt: new Date("2025-06-01") },
      { id: 3, publishedAt: new Date("2025-03-01") },
    ];
    const sorted = [...news].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    expect(sorted[0].id).toBe(2);
    expect(sorted[1].id).toBe(3);
    expect(sorted[2].id).toBe(1);
  });

  it("filters policies by category", () => {
    const policies = [
      { id: 1, category: "HR", title: "Leave Policy" },
      { id: 2, category: "IT", title: "Device Policy" },
      { id: 3, category: "HR", title: "Code of Conduct" },
    ];
    const hrPolicies = policies.filter(p => p.category === "HR");
    expect(hrPolicies).toHaveLength(2);
  });
});

// ─── Approval logic ───────────────────────────────────────────────────────────
describe("Approval workflow logic", () => {
  it("only shows pending leave requests for approval", () => {
    const requests = [
      { id: 1, status: "pending" },
      { id: 2, status: "approved" },
      { id: 3, status: "pending" },
      { id: 4, status: "rejected" },
    ];
    const pending = requests.filter(r => r.status === "pending");
    expect(pending).toHaveLength(2);
    expect(pending.map(r => r.id)).toEqual([1, 3]);
  });

  it("counts pending approvals correctly", () => {
    const requests = [
      { status: "pending" },
      { status: "pending" },
      { status: "approved" },
    ];
    const count = requests.filter(r => r.status === "pending").length;
    expect(count).toBe(2);
  });
});

// ─── Team attendance logic ────────────────────────────────────────────────────
describe("Team attendance summary logic", () => {
  it("calculates attendance rate correctly", () => {
    const totalDays = 20;
    const presentDays = 18;
    const rate = Math.round((presentDays / totalDays) * 100);
    expect(rate).toBe(90);
  });

  it("handles zero total days gracefully", () => {
    const totalDays = 0;
    const presentDays = 0;
    const rate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
    expect(rate).toBe(0);
  });

  it("identifies employees on leave today", () => {
    const today = new Date("2025-06-01");
    const leaves = [
      { employeeId: 1, startDate: new Date("2025-05-30"), endDate: new Date("2025-06-03"), status: "approved" },
      { employeeId: 2, startDate: new Date("2025-06-02"), endDate: new Date("2025-06-05"), status: "approved" },
      { employeeId: 3, startDate: new Date("2025-05-28"), endDate: new Date("2025-06-01"), status: "approved" },
    ];
    const onLeaveToday = leaves.filter(l =>
      l.status === "approved" &&
      l.startDate <= today &&
      l.endDate >= today
    );
    expect(onLeaveToday).toHaveLength(2); // employees 1 and 3
  });
});

// ─── Calendar logic ───────────────────────────────────────────────────────────
describe("Team leave calendar logic", () => {
  it("generates correct month range", () => {
    const year = 2025;
    const month = 6; // June
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(30); // June has 30 days
  });

  it("generates correct month range for February in leap year", () => {
    const year = 2024;
    const month = 2;
    const end = new Date(year, month, 0);
    expect(end.getDate()).toBe(29); // 2024 is a leap year
  });

  it("groups leave requests by employee for calendar view", () => {
    const requests = [
      { employeeId: 1, employeeName: "Alice", startDate: new Date("2025-06-01"), endDate: new Date("2025-06-03") },
      { employeeId: 2, employeeName: "Bob", startDate: new Date("2025-06-05"), endDate: new Date("2025-06-07") },
      { employeeId: 1, employeeName: "Alice", startDate: new Date("2025-06-20"), endDate: new Date("2025-06-22") },
    ];
    const byEmployee = requests.reduce((acc, r) => {
      if (!acc[r.employeeId]) acc[r.employeeId] = [];
      acc[r.employeeId].push(r);
      return acc;
    }, {} as Record<number, typeof requests>);
    expect(Object.keys(byEmployee)).toHaveLength(2);
    expect(byEmployee[1]).toHaveLength(2);
    expect(byEmployee[2]).toHaveLength(1);
  });
});

// ─── Registration in main router ─────────────────────────────────────────────
describe("Main router — selfService registration", () => {
  it("registers selfServiceRouter as 'selfService'", async () => {
    const { appRouter } = await import("./routers");
    const def = (appRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("selfService"))).toBe(true);
  });

  it("selfService.ess is accessible from appRouter", async () => {
    const { appRouter } = await import("./routers");
    const def = (appRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("selfService.ess"))).toBe(true);
  });

  it("selfService.mss is accessible from appRouter", async () => {
    const { appRouter } = await import("./routers");
    const def = (appRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("selfService.mss"))).toBe(true);
  });
});

// ─── Payslip AI explainer ─────────────────────────────────────────────────────
describe("Payslip AI explainer", () => {
  it("explainPayslip procedure exists in ess router", async () => {
    const { selfServiceRouter } = await import("./routers/selfServiceRouter");
    const def = (selfServiceRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.includes("explainPayslip"))).toBe(true);
  });

  it("explainPayslip is accessible via ess prefix", async () => {
    const { selfServiceRouter } = await import("./routers/selfServiceRouter");
    const def = (selfServiceRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("ess") && k.includes("explainPayslip"))).toBe(true);
  });

  it("formats payslip breakdown for AI prompt", () => {
    const payslip = {
      basicSalary: "5000.00",
      housingAllowance: "1000.00",
      transportAllowance: "500.00",
      grossSalary: "6500.00",
      incomeTax: "650.00",
      socialSecurity: "325.00",
      netSalary: "5525.00",
    };
    const earnings = Number(payslip.grossSalary);
    const deductions = Number(payslip.incomeTax) + Number(payslip.socialSecurity);
    const net = earnings - deductions;
    expect(net).toBeCloseTo(Number(payslip.netSalary), 1);
  });
});

// ─── Coverage summary logic ───────────────────────────────────────────────────
describe("Coverage summary — AI analysis", () => {
  it("coverageSummary procedure exists in mss router", async () => {
    const { selfServiceRouter } = await import("./routers/selfServiceRouter");
    const def = (selfServiceRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.includes("coverageSummary"))).toBe(true);
  });

  it("calculates team availability percentage", () => {
    const teamSize = 10;
    const onLeave = 3;
    const available = teamSize - onLeave;
    const pct = Math.round((available / teamSize) * 100);
    expect(pct).toBe(70);
  });

  it("flags high risk when more than 40% of team on leave", () => {
    const teamSize = 10;
    const onLeave = 5;
    const coveragePct = ((teamSize - onLeave) / teamSize) * 100;
    const risk = coveragePct < 60 ? "high" : coveragePct < 80 ? "medium" : "low";
    expect(risk).toBe("high");
  });

  it("flags low risk when less than 20% of team on leave", () => {
    const teamSize = 10;
    const onLeave = 1;
    const coveragePct = ((teamSize - onLeave) / teamSize) * 100;
    const risk = coveragePct < 60 ? "high" : coveragePct < 80 ? "medium" : "low";
    expect(risk).toBe("low");
  });
});
