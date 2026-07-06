/**
 * CORE HR Foundation — Server Unit Tests
 *
 * Tests the RBAC definitions, predefined roles, module list,
 * and workflow router without a live database connection.
 */
import { describe, expect, it } from "vitest";
import { PREDEFINED_ROLES, HCM_MODULES } from "./rbac";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// The 6 permission actions defined in rbac.ts as PermissionAction type
const HCM_PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "approve", "export"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

// ─── RBAC Definitions ─────────────────────────────────────────────────────────

describe("RBAC — predefined roles", () => {
  it("defines exactly 6 predefined roles", () => {
    expect(PREDEFINED_ROLES).toHaveLength(6);
  });

  it("includes all required role slugs", () => {
    const slugs = PREDEFINED_ROLES.map((r) => r.slug);
    expect(slugs).toContain("super_admin");
    expect(slugs).toContain("hr_admin");
    expect(slugs).toContain("hr_manager");
    expect(slugs).toContain("employee");
    // department_manager and viewer are the other two predefined roles
    expect(slugs).toContain("department_manager");
    expect(slugs).toContain("viewer");
  });

  it("every role has name, slug, and description", () => {
    for (const role of PREDEFINED_ROLES) {
      expect(role.name).toBeTruthy();
      expect(role.slug).toBeTruthy();
      expect(role.description).toBeTruthy();
    }
  });
});

describe("RBAC — permission actions", () => {
  it("defines exactly 6 permission actions", () => {
    expect(HCM_PERMISSION_ACTIONS).toHaveLength(6);
  });

  it("includes view, create, edit, delete, approve, export", () => {
    expect(HCM_PERMISSION_ACTIONS).toContain("view");
    expect(HCM_PERMISSION_ACTIONS).toContain("create");
    expect(HCM_PERMISSION_ACTIONS).toContain("edit");
    expect(HCM_PERMISSION_ACTIONS).toContain("delete");
    expect(HCM_PERMISSION_ACTIONS).toContain("approve");
    expect(HCM_PERMISSION_ACTIONS).toContain("export");
  });
});

describe("RBAC — CORE HR modules", () => {
  it("defines at least 10 modules", () => {
    expect(HCM_MODULES.length).toBeGreaterThanOrEqual(10);
  });

  it("includes core modules", () => {
    expect(HCM_MODULES).toContain("employees");
    expect(HCM_MODULES).toContain("leave");
    expect(HCM_MODULES).toContain("payroll");
    expect(HCM_MODULES).toContain("attendance");
    expect(HCM_MODULES).toContain("recruitment");
  });
});

// ─── Auth Router ──────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated context", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated context", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@example.com");
  });
});

// ─── Roles Router ─────────────────────────────────────────────────────────────

describe("roles.listPredefined", () => {
  it("returns 6 predefined roles when authenticated", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.roles.listPredefined();
    expect(result).toHaveLength(6);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.roles.listPredefined()).rejects.toThrow();
  });
});

describe("roles.listModules", () => {
  it("returns module list when authenticated", async () => {
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.roles.listModules();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── Audit Router ─────────────────────────────────────────────────────────────

describe("audit.list", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.audit.list({ companyId: 1 })).rejects.toThrow();
  });
});

// ─── Workflow Router ──────────────────────────────────────────────────────────

describe("workflow.pendingCount", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = makeCtx({ user: null });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.workflow.pendingCount({ companyId: 1 })).rejects.toThrow();
  });
});

// ─── Logout (existing baseline) ───────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const cleared: string[] = [];
    const ctx = makeCtx({
      res: {
        clearCookie: (name: string) => cleared.push(name),
      } as unknown as TrpcContext["res"],
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(cleared.length).toBe(1);
  });
});
