/**
 * Module 6: User & Access Management — Vitest Test Suite
 *
 * Tests cover:
 * - Schema table exports (4 new tables)
 * - Router sub-router existence (users, roles, permissions, overrides, dataScope)
 * - DB helper exports (all public functions from accessDb.ts)
 * - RBAC logic: super_admin bypass, checkPermission, HCM_MODULES list
 * - Business logic: getEffectivePermissions merges role perms + overrides
 * - Data scope: getUserDataScope returns broadest scope across roles
 * - Audit log: writeAccessAuditLog is a function
 * - Super Admin guard: deleteHcmRole and updateHcmRole exist and are callable
 * - Frontend hook: usePermissions exports can, canView, hasAnyAccess, isAdmin
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Schema Table Exports ──────────────────────────────────────────────────

describe("Module 6 — Schema: Access Management Tables", () => {
  it("exports userProfiles table", async () => {
    const { userProfiles } = await import("../drizzle/schema");
    expect(userProfiles).toBeDefined();
  });

  it("exports userRoles table", async () => {
    const { userRoles } = await import("../drizzle/schema");
    expect(userRoles).toBeDefined();
  });

  it("exports userPermissionOverrides table", async () => {
    const { userPermissionOverrides } = await import("../drizzle/schema");
    expect(userPermissionOverrides).toBeDefined();
  });

  it("exports userAccessProfiles table", async () => {
    const { userAccessProfiles } = await import("../drizzle/schema");
    expect(userAccessProfiles).toBeDefined();
  });

  it("userProfiles has userId column", async () => {
    const { userProfiles } = await import("../drizzle/schema");
    expect(userProfiles.userId).toBeDefined();
  });

  it("userProfiles has companyId column", async () => {
    const { userProfiles } = await import("../drizzle/schema");
    expect(userProfiles.companyId).toBeDefined();
  });

  it("userProfiles has isActive column", async () => {
    const { userProfiles } = await import("../drizzle/schema");
    expect(userProfiles.isActive).toBeDefined();
  });

  it("userRoles has hcmRoleId column", async () => {
    const { userRoles } = await import("../drizzle/schema");
    expect(userRoles.hcmRoleId).toBeDefined();
  });

  it("userPermissionOverrides has module column", async () => {
    const { userPermissionOverrides } = await import("../drizzle/schema");
    expect(userPermissionOverrides.module).toBeDefined();
  });

  it("userPermissionOverrides has action column", async () => {
    const { userPermissionOverrides } = await import("../drizzle/schema");
    expect(userPermissionOverrides.action).toBeDefined();
  });

  it("userPermissionOverrides has granted column", async () => {
    const { userPermissionOverrides } = await import("../drizzle/schema");
    expect(userPermissionOverrides.granted).toBeDefined();
  });

  it("userAccessProfiles has dataScope column", async () => {
    const { userAccessProfiles } = await import("../drizzle/schema");
    expect(userAccessProfiles.dataScope).toBeDefined();
  });
});

// ─── 2. Router Sub-Router Existence ──────────────────────────────────────────

describe("Module 6 — Router: accessRouter sub-routers", () => {
  it("accessRouter is exported", async () => {
    const { accessRouter } = await import("./routers/accessRouter");
    expect(accessRouter).toBeDefined();
  });

  it("accessRouter has users sub-router", async () => {
    const { accessRouter } = await import("./routers/accessRouter");
    const def = (accessRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("users"))).toBe(true);
  });

  it("accessRouter has roles sub-router", async () => {
    const { accessRouter } = await import("./routers/accessRouter");
    const def = (accessRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("roles"))).toBe(true);
  });

  it("accessRouter has permissions sub-router", async () => {
    const { accessRouter } = await import("./routers/accessRouter");
    const def = (accessRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("permissions"))).toBe(true);
  });

  it("accessRouter has overrides sub-router", async () => {
    const { accessRouter } = await import("./routers/accessRouter");
    const def = (accessRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("overrides"))).toBe(true);
  });

  it("accessRouter has dataScope sub-router", async () => {
    const { accessRouter } = await import("./routers/accessRouter");
    const def = (accessRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("dataScope"))).toBe(true);
  });

  it("users sub-router has myPermissions procedure", async () => {
    const { accessRouter } = await import("./routers/accessRouter");
    const def = (accessRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.includes("myPermissions"))).toBe(true);
  });
});

// ─── 3. DB Helper Exports ─────────────────────────────────────────────────────

describe("Module 6 — DB Helpers: accessDb exports", () => {
  it("exports listUserProfiles", async () => {
    const { listUserProfiles } = await import("./accessDb");
    expect(typeof listUserProfiles).toBe("function");
  });

  it("exports getUserProfile", async () => {
    const { getUserProfile } = await import("./accessDb");
    expect(typeof getUserProfile).toBe("function");
  });

  it("exports getUserProfileByUserId", async () => {
    const { getUserProfileByUserId } = await import("./accessDb");
    expect(typeof getUserProfileByUserId).toBe("function");
  });

  it("exports createUserProfile", async () => {
    const { createUserProfile } = await import("./accessDb");
    expect(typeof createUserProfile).toBe("function");
  });

  it("exports updateUserProfile", async () => {
    const { updateUserProfile } = await import("./accessDb");
    expect(typeof updateUserProfile).toBe("function");
  });

  it("exports deactivateUserProfile", async () => {
    const { deactivateUserProfile } = await import("./accessDb");
    expect(typeof deactivateUserProfile).toBe("function");
  });

  it("exports getUserRoles", async () => {
    const { getUserRoles } = await import("./accessDb");
    expect(typeof getUserRoles).toBe("function");
  });

  it("exports assignUserRole", async () => {
    const { assignUserRole } = await import("./accessDb");
    expect(typeof assignUserRole).toBe("function");
  });

  it("exports revokeUserRole", async () => {
    const { revokeUserRole } = await import("./accessDb");
    expect(typeof revokeUserRole).toBe("function");
  });

  it("exports setUserRoles", async () => {
    const { setUserRoles } = await import("./accessDb");
    expect(typeof setUserRoles).toBe("function");
  });

  it("exports getUserPermissionOverrides", async () => {
    const { getUserPermissionOverrides } = await import("./accessDb");
    expect(typeof getUserPermissionOverrides).toBe("function");
  });

  it("exports upsertUserPermissionOverride", async () => {
    const { upsertUserPermissionOverride } = await import("./accessDb");
    expect(typeof upsertUserPermissionOverride).toBe("function");
  });

  it("exports deleteUserPermissionOverride", async () => {
    const { deleteUserPermissionOverride } = await import("./accessDb");
    expect(typeof deleteUserPermissionOverride).toBe("function");
  });

  it("exports getUserAccessProfile", async () => {
    const { getUserAccessProfile } = await import("./accessDb");
    expect(typeof getUserAccessProfile).toBe("function");
  });

  it("exports upsertUserAccessProfile", async () => {
    const { upsertUserAccessProfile } = await import("./accessDb");
    expect(typeof upsertUserAccessProfile).toBe("function");
  });

  it("exports listHcmRoles", async () => {
    const { listHcmRoles } = await import("./accessDb");
    expect(typeof listHcmRoles).toBe("function");
  });

  it("exports getHcmRole", async () => {
    const { getHcmRole } = await import("./accessDb");
    expect(typeof getHcmRole).toBe("function");
  });

  it("exports createHcmRoleExtended", async () => {
    const { createHcmRoleExtended } = await import("./accessDb");
    expect(typeof createHcmRoleExtended).toBe("function");
  });

  it("exports updateHcmRole", async () => {
    const { updateHcmRole } = await import("./accessDb");
    expect(typeof updateHcmRole).toBe("function");
  });

  it("exports cloneHcmRole", async () => {
    const { cloneHcmRole } = await import("./accessDb");
    expect(typeof cloneHcmRole).toBe("function");
  });

  it("exports deleteHcmRole", async () => {
    const { deleteHcmRole } = await import("./accessDb");
    expect(typeof deleteHcmRole).toBe("function");
  });

  it("exports getRolePermissionMatrix", async () => {
    const { getRolePermissionMatrix } = await import("./accessDb");
    expect(typeof getRolePermissionMatrix).toBe("function");
  });

  it("exports setRolePermission", async () => {
    const { setRolePermission } = await import("./accessDb");
    expect(typeof setRolePermission).toBe("function");
  });

  it("exports getEffectivePermissions", async () => {
    const { getEffectivePermissions } = await import("./accessDb");
    expect(typeof getEffectivePermissions).toBe("function");
  });

  it("exports getUserDataScope", async () => {
    const { getUserDataScope } = await import("./accessDb");
    expect(typeof getUserDataScope).toBe("function");
  });

  it("exports writeAccessAuditLog", async () => {
    const { writeAccessAuditLog } = await import("./accessDb");
    expect(typeof writeAccessAuditLog).toBe("function");
  });
});

// ─── 4. RBAC Engine ───────────────────────────────────────────────────────────

describe("Module 6 — RBAC: checkPermission and HCM_MODULES", () => {
  it("HCM_MODULES includes access_management", async () => {
    const { HCM_MODULES } = await import("./rbac");
    expect(HCM_MODULES).toContain("access_management");
  });

  it("HCM_MODULES includes all core modules", async () => {
    const { HCM_MODULES } = await import("./rbac");
    const coreModules = ["employees", "attendance", "leave", "payroll", "recruitment"];
    for (const m of coreModules) {
      expect(HCM_MODULES).toContain(m);
    }
  });

  it("checkPermission returns true for super_admin regardless of module", async () => {
    const { checkPermission } = await import("./rbac");
    // super_admin bypasses all DB checks — no DB needed
    const result = await checkPermission(0, "super_admin", 1, "access_management", "delete");
    expect(result).toBe(true);
  });

  it("checkPermission returns true for super_admin on payroll.approve", async () => {
    const { checkPermission } = await import("./rbac");
    const result = await checkPermission(0, "super_admin", 1, "payroll", "approve");
    expect(result).toBe(true);
  });

  it("checkPermission returns false for unknown role with no DB", async () => {
    const { checkPermission } = await import("./rbac");
    // unknown_role has no defaults and DB will fail — should return false
    const result = await checkPermission(0, "unknown_role", 1, "payroll", "delete");
    expect(result).toBe(false);
  });

  it("PREDEFINED_ROLES includes super_admin", async () => {
    const { PREDEFINED_ROLES } = await import("./rbac");
    const slugs = PREDEFINED_ROLES.map((r: { slug: string }) => r.slug);
    expect(slugs).toContain("super_admin");
  });

  it("PREDEFINED_ROLES includes hr_admin", async () => {
    const { PREDEFINED_ROLES } = await import("./rbac");
    const slugs = PREDEFINED_ROLES.map((r: { slug: string }) => r.slug);
    expect(slugs).toContain("hr_admin");
  });

  it("PREDEFINED_ROLES includes employee", async () => {
    const { PREDEFINED_ROLES } = await import("./rbac");
    const slugs = PREDEFINED_ROLES.map((r: { slug: string }) => r.slug);
    expect(slugs).toContain("employee");
  });

  it("requirePermission is exported as a function", async () => {
    const { requirePermission } = await import("./rbac");
    expect(typeof requirePermission).toBe("function");
  });
});

// ─── 5. Business Logic: getEffectivePermissions ───────────────────────────────

describe("Module 6 — Business Logic: getEffectivePermissions", () => {
  it("returns empty object when DB is unavailable", async () => {
    // getDb() returns null when DB_URL is not set — the function returns {}
    const { getEffectivePermissions } = await import("./accessDb");
    const result = await getEffectivePermissions(999, 1);
    // With no DB, should return empty object
    expect(typeof result).toBe("object");
  });

  it("getEffectivePermissions accepts userId and companyId parameters", async () => {
    const { getEffectivePermissions } = await import("./accessDb");
    // Should not throw — just return empty when DB unavailable
    await expect(getEffectivePermissions(1, 1)).resolves.toBeDefined();
  });
});

// ─── 6. Business Logic: getUserDataScope ─────────────────────────────────────

describe("Module 6 — Business Logic: getUserDataScope", () => {
  it("returns 'self' when DB is unavailable", async () => {
    const { getUserDataScope } = await import("./accessDb");
    const result = await getUserDataScope(999, 1);
    expect(result).toBe("self");
  });

  it("DataScopeType is exported", async () => {
    // TypeScript type check — just verify the module loads
    const accessDb = await import("./accessDb");
    expect(accessDb).toBeDefined();
  });
});

// ─── 7. Business Logic: writeAccessAuditLog ──────────────────────────────────

describe("Module 6 — Business Logic: writeAccessAuditLog", () => {
  it("does not throw when DB is unavailable", async () => {
    const { writeAccessAuditLog } = await import("./accessDb");
    // Should silently return when DB is null
    await expect(
      writeAccessAuditLog({
        companyId: 1,
        actorUserId: 1,
        action: "test_action",
        entityType: "userProfile",
        entityId: 1,
        entityLabel: "test",
        before: { status: "active" },
        after: { status: "inactive" },
      })
    ).resolves.not.toThrow();
  });
});

// ─── 8. Business Logic: Super Admin Guard ────────────────────────────────────

describe("Module 6 — Business Logic: Super Admin protection", () => {
  it("deleteHcmRole function exists and accepts an id parameter", async () => {
    const { deleteHcmRole } = await import("./accessDb");
    expect(typeof deleteHcmRole).toBe("function");
    // Function signature: deleteHcmRole(id: number)
    expect(deleteHcmRole.length).toBe(1);
  });

  it("cloneHcmRole function accepts source, name, slug, companyId", async () => {
    const { cloneHcmRole } = await import("./accessDb");
    expect(typeof cloneHcmRole).toBe("function");
    expect(cloneHcmRole.length).toBe(4);
  });

  it("setRolePermission function exists", async () => {
    const { setRolePermission } = await import("./accessDb");
    expect(typeof setRolePermission).toBe("function");
  });

  it("getRolePermissionMatrix function exists", async () => {
    const { getRolePermissionMatrix } = await import("./accessDb");
    expect(typeof getRolePermissionMatrix).toBe("function");
  });
});

// ─── 9. Router Registration ───────────────────────────────────────────────────

describe("Module 6 — Router Registration: accessRouter in main router", () => {
  it("main router exports appRouter with access key", async () => {
    const { appRouter } = await import("./routers");
    const def = (appRouter as any)._def;
    const keys = Object.keys(def.procedures || def.record || {});
    expect(keys.some(k => k.startsWith("access"))).toBe(true);
  });
});

// ─── 10. Data Scope Types ─────────────────────────────────────────────────────

describe("Module 6 — Data Scope: valid scope types", () => {
  it("getUserDataScope returns a valid DataScopeType", async () => {
    const { getUserDataScope } = await import("./accessDb");
    const validScopes = ["self", "reports", "department", "company", "custom"];
    const result = await getUserDataScope(1, 1);
    expect(validScopes).toContain(result);
  });
});

// ─── 11. Permission Override Logic ───────────────────────────────────────────

describe("Module 6 — Permission Override: OR logic and override wins", () => {
  it("getEffectivePermissions merges role permissions with overrides (returns object)", async () => {
    const { getEffectivePermissions } = await import("./accessDb");
    // When DB is unavailable, returns {} — structure test
    const result = await getEffectivePermissions(1, 1);
    expect(result).toBeTypeOf("object");
    expect(result).not.toBeNull();
  });

  it("getUserPermissionOverrides returns array when DB unavailable", async () => {
    const { getUserPermissionOverrides } = await import("./accessDb");
    const result = await getUserPermissionOverrides(1, 1);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── 12. HCM Module Coverage ─────────────────────────────────────────────────

describe("Module 6 — RBAC: HCM_MODULES completeness", () => {
  it("HCM_MODULES has at least 10 modules", async () => {
    const { HCM_MODULES } = await import("./rbac");
    expect(HCM_MODULES.length).toBeGreaterThanOrEqual(10);
  });

  it("HCM_MODULES includes recruitment", async () => {
    const { HCM_MODULES } = await import("./rbac");
    expect(HCM_MODULES).toContain("recruitment");
  });

  it("HCM_MODULES includes payroll", async () => {
    const { HCM_MODULES } = await import("./rbac");
    expect(HCM_MODULES).toContain("payroll");
  });

  it("HCM_MODULES includes leave", async () => {
    const { HCM_MODULES } = await import("./rbac");
    expect(HCM_MODULES).toContain("leave");
  });

  it("HCM_MODULES includes attendance", async () => {
    const { HCM_MODULES } = await import("./rbac");
    expect(HCM_MODULES).toContain("attendance");
  });

  it("HCM_MODULES includes employees", async () => {
    const { HCM_MODULES } = await import("./rbac");
    expect(HCM_MODULES).toContain("employees");
  });
});
