/**
 * Flow HCM — Seed Script
 *
 * Creates a demo company with locations, departments, designations,
 * predefined roles, and a sample workflow template.
 *
 * Usage:
 *   pnpm seed
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Aborting seed.");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

console.log("🌱  Starting Flow HCM seed...\n");

// ─── Helper ────────────────────────────────────────────────────────────────────

async function run(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✓  ${label}`);
    return result;
  } catch (err) {
    // Ignore duplicate key errors (idempotent seed)
    if (err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate entry")) {
      console.log(`  ⚠  ${label} — already exists, skipping`);
      return null;
    }
    console.error(`  ✗  ${label}`, err.message);
    throw err;
  }
}

// ─── 1. Company ────────────────────────────────────────────────────────────────

const [companyRow] = await connection.execute(
  `INSERT IGNORE INTO companies (name, slug, industry, country, currency, timezone, isActive, createdAt, updatedAt)
   VALUES ('Rad Technologies', 'rad-technologies', 'Technology', 'AE', 'AED', 'Asia/Dubai', 1, NOW(), NOW())`
);
const companyId = companyRow.insertId || 1;
console.log(`  ✓  Company — Rad Technologies (id: ${companyId})`);

// ─── 2. Locations ──────────────────────────────────────────────────────────────

const locations = [
  { name: "Dubai HQ", code: "DXB-HQ", city: "Dubai", country: "AE" },
  { name: "Abu Dhabi Office", code: "AUH-01", city: "Abu Dhabi", country: "AE" },
];

for (const loc of locations) {
  await run(`Location — ${loc.name}`, () =>
    connection.execute(
      `INSERT IGNORE INTO locations (companyId, name, code, city, country, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [companyId, loc.name, loc.code, loc.city, loc.country]
    )
  );
}

// ─── 3. Departments ────────────────────────────────────────────────────────────

const departments = [
  { name: "Engineering", code: "ENG" },
  { name: "Human Resources", code: "HR" },
  { name: "Finance", code: "FIN" },
  { name: "Operations", code: "OPS" },
  { name: "Sales & Marketing", code: "SALES" },
];

for (const dept of departments) {
  await run(`Department — ${dept.name}`, () =>
    connection.execute(
      `INSERT IGNORE INTO departments (companyId, name, code, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, NOW(), NOW())`,
      [companyId, dept.name, dept.code]
    )
  );
}

// ─── Check if code column exists in departments ────────────────────────────────

// ─── 4. Designations ──────────────────────────────────────────────────────────

const designations = [
  { name: "Chief Executive Officer", grade: "L10", level: 10 },
  { name: "Chief Operating Officer", grade: "L9", level: 9 },
  { name: "Senior Manager", grade: "L7", level: 7 },
  { name: "Manager", grade: "L6", level: 6 },
  { name: "Senior Engineer", grade: "L5", level: 5 },
  { name: "Engineer", grade: "L4", level: 4 },
  { name: "Analyst", grade: "L3", level: 3 },
  { name: "Associate", grade: "L2", level: 2 },
  { name: "Intern", grade: "L1", level: 1 },
];

for (const desig of designations) {
  await run(`Designation — ${desig.name}`, () =>
    connection.execute(
      `INSERT IGNORE INTO designations (companyId, name, grade, level, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
      [companyId, desig.name, desig.grade, desig.level]
    )
  );
}

// ─── 5. HCM Roles ─────────────────────────────────────────────────────────────

const roles = [
  { name: "Super Admin", slug: "super_admin", description: "Full system access across all tenants" },
  { name: "HR Admin", slug: "hr_admin", description: "Full HR module access within the company" },
  { name: "HR Manager", slug: "hr_manager", description: "Manage employees, leave, and payroll" },
  { name: "Line Manager", slug: "line_manager", description: "Manage direct reports and approve requests" },
  { name: "Employee", slug: "employee", description: "Self-service access to own data" },
  { name: "Payroll Admin", slug: "payroll_admin", description: "Full payroll module access" },
];

for (const role of roles) {
  await run(`Role — ${role.name}`, () =>
    connection.execute(
      `INSERT IGNORE INTO hcmRoles (companyId, name, slug, description, isPredefined, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, 1, NOW(), NOW())`,
      [companyId, role.name, role.slug, role.description]
    )
  );
}

// ─── 6. Workflow Template ─────────────────────────────────────────────────────

await run("Workflow Template — Leave Approval (2-step)", async () => {
  const [tmplRow] = await connection.execute(
    `INSERT IGNORE INTO workflowTemplates (companyId, name, requestType, description, isActive, createdAt, updatedAt)
     VALUES (?, 'Leave Approval', 'leave_request', 'Standard two-step leave approval workflow', 1, NOW(), NOW())`,
    [companyId]
  );
  const tmplId = tmplRow.insertId;
  if (!tmplId) return; // already exists

  // Step 1 — Reporting Manager
  await connection.execute(
    `INSERT INTO workflowSteps (templateId, companyId, stepOrder, stepName, approverType, isOptional, createdAt)
     VALUES (?, ?, 1, 'Line Manager Approval', 'reporting_manager', 0, NOW())`,
    [tmplId, companyId]
  );

  // Step 2 — HR Admin (role-based)
  await connection.execute(
    `INSERT INTO workflowSteps (templateId, companyId, stepOrder, stepName, approverType, isOptional, createdAt)
     VALUES (?, ?, 2, 'HR Admin Approval', 'role', 0, NOW())`,
    [tmplId, companyId]
  );
});

// ─── Done ──────────────────────────────────────────────────────────────────────

console.log("\n✅  Seed complete!\n");
await connection.end();
