/**
 * accessDb.ts — DB helpers for User & Access Management
 * Covers: userProfiles, userRoles, userPermissionOverrides, userAccessProfiles, hcmRoles, rolePermissions
 */
import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  auditLogs,
  hcmRoles,
  InsertHcmRole,
  InsertUserAccessProfile,
  InsertUserPermissionOverride,
  InsertUserProfile,
  InsertUserRole,
  rolePermissions,
  userAccessProfiles,
  userPermissionOverrides,
  userProfiles,
  userRoles,
  users,
} from "../drizzle/schema";
import { getDb } from "./db";

// ─── User Profiles ────────────────────────────────────────────────────────────

export async function listUserProfiles(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: userProfiles.id,
      userId: userProfiles.userId,
      companyId: userProfiles.companyId,
      employeeId: userProfiles.employeeId,
      isActive: userProfiles.isActive,
      inviteSentAt: userProfiles.inviteSentAt,
      lastLoginAt: userProfiles.lastLoginAt,
      createdAt: userProfiles.createdAt,
      userName: users.name,
      userEmail: users.email,
      userOpenId: users.openId,
    })
    .from(userProfiles)
    .leftJoin(users, eq(users.id, userProfiles.userId))
    .where(eq(userProfiles.companyId, companyId));
}

export async function getUserProfile(userId: number, companyId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.companyId, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createUserProfile(data: InsertUserProfile) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(userProfiles).values(data);
}

export async function updateUserProfile(id: number, data: Partial<InsertUserProfile>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(userProfiles).set(data).where(eq(userProfiles.id, id));
}

export async function deactivateUserProfile(userId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(userProfiles)
    .set({ isActive: false })
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.companyId, companyId)));
}

// ─── User Roles ───────────────────────────────────────────────────────────────

export async function getUserRoles(userId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: userRoles.id,
      userId: userRoles.userId,
      hcmRoleId: userRoles.hcmRoleId,
      companyId: userRoles.companyId,
      assignedAt: userRoles.assignedAt,
      assignedBy: userRoles.assignedBy,
      isActive: userRoles.isActive,
      roleName: hcmRoles.name,
      roleSlug: hcmRoles.slug,
    })
    .from(userRoles)
    .leftJoin(hcmRoles, eq(hcmRoles.id, userRoles.hcmRoleId))
    .where(and(eq(userRoles.userId, userId), eq(userRoles.companyId, companyId), eq(userRoles.isActive, true)));
}

export async function assignUserRole(data: InsertUserRole) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Remove existing active assignments for this user+role combo
  await db
    .update(userRoles)
    .set({ isActive: false })
    .where(
      and(
        eq(userRoles.userId, data.userId),
        eq(userRoles.hcmRoleId, data.hcmRoleId),
        eq(userRoles.companyId, data.companyId)
      )
    );
  await db.insert(userRoles).values({ ...data, isActive: true });
}

export async function revokeUserRole(userId: number, hcmRoleId: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(userRoles)
    .set({ isActive: false })
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.hcmRoleId, hcmRoleId),
        eq(userRoles.companyId, companyId)
      )
    );
}

export async function setUserRoles(userId: number, companyId: number, roleIds: number[], assignedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Deactivate all current roles
  await db
    .update(userRoles)
    .set({ isActive: false })
    .where(and(eq(userRoles.userId, userId), eq(userRoles.companyId, companyId)));
  // Insert new roles
  if (roleIds.length > 0) {
    await db.insert(userRoles).values(
      roleIds.map((hcmRoleId) => ({ userId, hcmRoleId, companyId, assignedBy, isActive: true }))
    );
  }
}

// ─── User Permission Overrides ────────────────────────────────────────────────

export async function getUserPermissionOverrides(userId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(userPermissionOverrides)
    .where(
      and(
        eq(userPermissionOverrides.userId, userId),
        eq(userPermissionOverrides.companyId, companyId),
        or(isNull(userPermissionOverrides.expiresAt), sql`${userPermissionOverrides.expiresAt} > ${now}`)
      )
    );
}

export async function upsertUserPermissionOverride(data: InsertUserPermissionOverride) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Remove existing override for same user+module+action
  await db
    .delete(userPermissionOverrides)
    .where(
      and(
        eq(userPermissionOverrides.userId, data.userId),
        eq(userPermissionOverrides.companyId, data.companyId),
        eq(userPermissionOverrides.module, data.module),
        eq(userPermissionOverrides.action, data.action)
      )
    );
  await db.insert(userPermissionOverrides).values(data);
}

export async function deleteUserPermissionOverride(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(userPermissionOverrides).where(eq(userPermissionOverrides.id, id));
}

// ─── User Access Profiles (Data Scope) ───────────────────────────────────────

export async function getUserAccessProfile(userId: number, companyId: number, hcmRoleId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(userAccessProfiles)
    .where(
      and(
        eq(userAccessProfiles.userId, userId),
        eq(userAccessProfiles.companyId, companyId),
        eq(userAccessProfiles.hcmRoleId, hcmRoleId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertUserAccessProfile(data: InsertUserAccessProfile) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(userAccessProfiles)
    .values(data)
    .onDuplicateKeyUpdate({
      set: { dataScope: data.dataScope, scopeConfig: data.scopeConfig },
    });
}

// ─── CORE HR Roles (extended) ─────────────────────────────────────────────────────

export async function listHcmRoles(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(hcmRoles).where(eq(hcmRoles.companyId, companyId));
}

export async function getHcmRole(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(hcmRoles).where(eq(hcmRoles.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createHcmRoleExtended(data: InsertHcmRole) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(hcmRoles).values(data);
  return { id: (result as unknown as { insertId: number }).insertId };
}

export async function updateHcmRole(id: number, data: Partial<InsertHcmRole>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(hcmRoles).set(data).where(eq(hcmRoles.id, id));
}

export async function cloneHcmRole(sourceRoleId: number, newName: string, newSlug: string, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Get source role permissions
  const sourcePerms = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.hcmRoleId, sourceRoleId), eq(rolePermissions.companyId, companyId)));
  // Create new role
  const result = await db.insert(hcmRoles).values({
    companyId,
    name: newName,
    slug: newSlug,
    isPredefined: false,
    description: `Cloned from role ${sourceRoleId}`,
    isActive: true,
  });
  const newRoleId = (result as unknown as { insertId: number }).insertId;
  // Copy permissions
  if (sourcePerms.length > 0) {
    await db.insert(rolePermissions).values(
      sourcePerms.map((p) => ({
        hcmRoleId: newRoleId,
        companyId,
        module: p.module,
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canApprove: p.canApprove,
        canExport: p.canExport,
      }))
    );
  }
  return { id: newRoleId };
}

export async function deleteHcmRole(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Deactivate instead of hard delete
  await db.update(hcmRoles).set({ isActive: false }).where(eq(hcmRoles.id, id));
}

// ─── Role Permissions (full matrix) ──────────────────────────────────────────

export async function getRolePermissionMatrix(hcmRoleId: number, companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.hcmRoleId, hcmRoleId), eq(rolePermissions.companyId, companyId)));
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
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(rolePermissions)
    .values(data)
    .onDuplicateKeyUpdate({
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

// ─── Effective Permissions (role + overrides) ─────────────────────────────────

export async function getEffectivePermissions(userId: number, companyId: number) {
  const db = await getDb();
  if (!db) return {};
  // Get user's active roles
  const roles = await getUserRoles(userId, companyId);
  // Collect all role permissions
  const allRolePerms: Record<string, Record<string, boolean>> = {};
  for (const role of roles) {
    const perms = await getRolePermissionMatrix(role.hcmRoleId, companyId);
    for (const p of perms) {
      if (!allRolePerms[p.module]) {
        allRolePerms[p.module] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
      }
      // OR across roles — if any role grants, it's granted
      if (p.canView) allRolePerms[p.module].view = true;
      if (p.canCreate) allRolePerms[p.module].create = true;
      if (p.canEdit) allRolePerms[p.module].edit = true;
      if (p.canDelete) allRolePerms[p.module].delete = true;
      if (p.canApprove) allRolePerms[p.module].approve = true;
      if (p.canExport) allRolePerms[p.module].export = true;
    }
  }
  // Apply user-level overrides
  const overrides = await getUserPermissionOverrides(userId, companyId);
  for (const o of overrides) {
    if (!allRolePerms[o.module]) {
      allRolePerms[o.module] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
    }
    allRolePerms[o.module][o.action] = o.granted;
  }
  return allRolePerms;
}

// ─── Data Scope Filter ────────────────────────────────────────────────────────

export type DataScopeType = "self" | "reports" | "department" | "company" | "custom";

export async function getUserDataScope(userId: number, companyId: number): Promise<DataScopeType> {
  const db = await getDb();
  if (!db) return "self";
  // Get the broadest scope across all active roles
  const roles = await getUserRoles(userId, companyId);
  if (roles.length === 0) return "self";
  const scopeOrder: DataScopeType[] = ["self", "reports", "department", "company", "custom"];
  let broadest: DataScopeType = "self";
  for (const role of roles) {
    const profile = await getUserAccessProfile(userId, companyId, role.hcmRoleId);
    const scope = (profile?.dataScope as DataScopeType) ?? "self";
    if (scopeOrder.indexOf(scope) > scopeOrder.indexOf(broadest)) {
      broadest = scope;
    }
    // super_admin / hr_admin always get company scope
    if (role.roleSlug === "super_admin" || role.roleSlug === "hr_admin") {
      return "company";
    }
  }
  return broadest;
}

// ─── Audit Log Writer ─────────────────────────────────────────────────────────

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
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({
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
