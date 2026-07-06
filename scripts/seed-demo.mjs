/**
 * Flow HCM — Comprehensive Demo Seed Script
 *
 * Creates a fully populated demo company with:
 *   • 1 company (Rad Technologies) + 2 locations
 *   • 4 departments + 9 designations + 6 HCM roles
 *   • 25 employees spread across departments
 *   • 5 leave types + leave policies + leave balances + sample requests
 *   • 1 month of attendance records (May 2025) for all employees
 *   • 3 salary structures + salary components + employee salary assignments
 *   • 1 open job posting + 5 candidates with applications
 *   • 1 appraisal template + 1 active appraisal cycle + cycle participants
 *
 * Usage:
 *   pnpm seed:demo
 *   — or —
 *   node scripts/seed-demo.mjs
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

console.log("🌱  Starting Flow HCM comprehensive demo seed...\n");

// ─── Helper ────────────────────────────────────────────────────────────────────
async function run(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✓  ${label}`);
    return result;
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY" || err?.message?.includes("Duplicate entry")) {
      console.log(`  ⚠  ${label} — already exists, skipping`);
      return null;
    }
    console.error(`  ✗  ${label}`, err.message);
    throw err;
  }
}

async function query(sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

async function insert(sql, params = []) {
  const [result] = await connection.execute(sql, params);
  return result.insertId;
}

// ─── 1. Company ────────────────────────────────────────────────────────────────
console.log("1. Company & Locations");
await connection.execute(
  `INSERT IGNORE INTO companies (id, name, slug, industry, country, currency, timezone, isActive, createdAt, updatedAt)
   VALUES (1, 'Rad Technologies', 'rad-technologies', 'Technology', 'AE', 'AED', 'Asia/Dubai', 1, NOW(), NOW())`
);
const companyId = 1;
console.log(`  ✓  Company — Rad Technologies (id: ${companyId})`);

// ─── 2. Locations ──────────────────────────────────────────────────────────────
const locationData = [
  { name: "Dubai HQ", code: "DXB-HQ", city: "Dubai", country: "AE" },
  { name: "Abu Dhabi Office", code: "AUH-01", city: "Abu Dhabi", country: "AE" },
];
const locationIds = {};
for (const loc of locationData) {
  await connection.execute(
    `INSERT IGNORE INTO locations (companyId, name, code, city, country, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [companyId, loc.name, loc.code, loc.city, loc.country]
  );
  const [rows] = await connection.execute(`SELECT id FROM locations WHERE companyId=? AND code=?`, [companyId, loc.code]);
  locationIds[loc.code] = rows[0]?.id;
  console.log(`  ✓  Location — ${loc.name}`);
}

// ─── 3. Departments ────────────────────────────────────────────────────────────
console.log("\n2. Departments");
const departmentData = [
  { name: "Engineering", code: "ENG" },
  { name: "Human Resources", code: "HR" },
  { name: "Finance", code: "FIN" },
  { name: "Sales & Marketing", code: "SALES" },
];
const deptIds = {};
for (const dept of departmentData) {
  await connection.execute(
    `INSERT IGNORE INTO departments (companyId, name, code, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, NOW(), NOW())`,
    [companyId, dept.name, dept.code]
  );
  const [rows] = await connection.execute(`SELECT id FROM departments WHERE companyId=? AND code=?`, [companyId, dept.code]);
  deptIds[dept.code] = rows[0]?.id;
  console.log(`  ✓  Department — ${dept.name}`);
}

// ─── 4. Designations ──────────────────────────────────────────────────────────
console.log("\n3. Designations");
const designationData = [
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
const desigIds = {};
for (const d of designationData) {
  await connection.execute(
    `INSERT IGNORE INTO designations (companyId, name, grade, level, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
    [companyId, d.name, d.grade, d.level]
  );
  const [rows] = await connection.execute(`SELECT id FROM designations WHERE companyId=? AND grade=?`, [companyId, d.grade]);
  desigIds[d.grade] = rows[0]?.id;
  console.log(`  ✓  Designation — ${d.name}`);
}

// ─── 5. HCM Roles ─────────────────────────────────────────────────────────────
console.log("\n4. HCM Roles");
const roleData = [
  { name: "Super Admin", slug: "super_admin", description: "Full system access" },
  { name: "HR Admin", slug: "hr_admin", description: "Full HR module access" },
  { name: "HR Manager", slug: "hr_manager", description: "Manage employees, leave, payroll" },
  { name: "Line Manager", slug: "line_manager", description: "Manage direct reports" },
  { name: "Employee", slug: "employee", description: "Self-service access" },
  { name: "Payroll Admin", slug: "payroll_admin", description: "Full payroll access" },
];
const roleIds = {};
for (const role of roleData) {
  await connection.execute(
    `INSERT IGNORE INTO hcmRoles (companyId, name, slug, description, isPredefined, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 1, 1, NOW(), NOW())`,
    [companyId, role.name, role.slug, role.description]
  );
  const [rows] = await connection.execute(`SELECT id FROM hcmRoles WHERE companyId=? AND slug=?`, [companyId, role.slug]);
  roleIds[role.slug] = rows[0]?.id;
  console.log(`  ✓  Role — ${role.name}`);
}

// ─── 6. Employees (25) ────────────────────────────────────────────────────────
console.log("\n5. Employees (25)");

const employeeData = [
  // Engineering (10)
  { first: "Khalid", last: "Al-Rashidi", email: "khalid.alrashidi@rad.ae", dept: "ENG", grade: "L7", role: "line_manager", type: "full_time", gender: "male", nationality: "AE", joinDate: "2021-03-15", loc: "DXB-HQ" },
  { first: "Sara", last: "Mahmoud", email: "sara.mahmoud@rad.ae", dept: "ENG", grade: "L5", role: "employee", type: "full_time", gender: "female", nationality: "EG", joinDate: "2022-01-10", loc: "DXB-HQ" },
  { first: "Ravi", last: "Sharma", email: "ravi.sharma@rad.ae", dept: "ENG", grade: "L5", role: "employee", type: "full_time", gender: "male", nationality: "IN", joinDate: "2022-06-01", loc: "DXB-HQ" },
  { first: "Priya", last: "Nair", email: "priya.nair@rad.ae", dept: "ENG", grade: "L4", role: "employee", type: "full_time", gender: "female", nationality: "IN", joinDate: "2023-02-20", loc: "DXB-HQ" },
  { first: "Mohammed", last: "Hassan", email: "mohammed.hassan@rad.ae", dept: "ENG", grade: "L4", role: "employee", type: "full_time", gender: "male", nationality: "AE", joinDate: "2023-05-01", loc: "DXB-HQ" },
  { first: "Lena", last: "Kowalski", email: "lena.kowalski@rad.ae", dept: "ENG", grade: "L4", role: "employee", type: "full_time", gender: "female", nationality: "PL", joinDate: "2023-08-15", loc: "DXB-HQ" },
  { first: "Tariq", last: "Bin Saeed", email: "tariq.binsaeed@rad.ae", dept: "ENG", grade: "L3", role: "employee", type: "full_time", gender: "male", nationality: "AE", joinDate: "2024-01-10", loc: "DXB-HQ" },
  { first: "Aisha", last: "Al-Farsi", email: "aisha.alfarsi@rad.ae", dept: "ENG", grade: "L3", role: "employee", type: "full_time", gender: "female", nationality: "AE", joinDate: "2024-03-01", loc: "DXB-HQ" },
  { first: "Vikram", last: "Patel", email: "vikram.patel@rad.ae", dept: "ENG", grade: "L2", role: "employee", type: "contract", gender: "male", nationality: "IN", joinDate: "2024-07-01", loc: "DXB-HQ" },
  { first: "Nour", last: "El-Sayed", email: "nour.elsayed@rad.ae", dept: "ENG", grade: "L1", role: "employee", type: "intern", gender: "female", nationality: "EG", joinDate: "2025-01-15", loc: "DXB-HQ" },
  // HR (5)
  { first: "Fatima", last: "Al-Zahra", email: "fatima.alzahra@rad.ae", dept: "HR", grade: "L6", role: "hr_manager", type: "full_time", gender: "female", nationality: "AE", joinDate: "2020-09-01", loc: "DXB-HQ" },
  { first: "Deepa", last: "Menon", email: "deepa.menon@rad.ae", dept: "HR", grade: "L4", role: "hr_admin", type: "full_time", gender: "female", nationality: "IN", joinDate: "2021-11-15", loc: "DXB-HQ" },
  { first: "Omar", last: "Al-Khatib", email: "omar.alkhatib@rad.ae", dept: "HR", grade: "L3", role: "employee", type: "full_time", gender: "male", nationality: "JO", joinDate: "2022-04-01", loc: "AUH-01" },
  { first: "Hana", last: "Yamamoto", email: "hana.yamamoto@rad.ae", dept: "HR", grade: "L3", role: "employee", type: "full_time", gender: "female", nationality: "JP", joinDate: "2023-09-01", loc: "DXB-HQ" },
  { first: "Bilal", last: "Qureshi", email: "bilal.qureshi@rad.ae", dept: "HR", grade: "L2", role: "employee", type: "full_time", gender: "male", nationality: "PK", joinDate: "2024-02-01", loc: "DXB-HQ" },
  // Finance (5)
  { first: "Ahmed", last: "Al-Mansouri", email: "ahmed.almansouri@rad.ae", dept: "FIN", grade: "L7", role: "line_manager", type: "full_time", gender: "male", nationality: "AE", joinDate: "2019-06-01", loc: "DXB-HQ" },
  { first: "Reena", last: "Thomas", email: "reena.thomas@rad.ae", dept: "FIN", grade: "L5", role: "payroll_admin", type: "full_time", gender: "female", nationality: "IN", joinDate: "2021-01-10", loc: "DXB-HQ" },
  { first: "Faisal", last: "Al-Otaibi", email: "faisal.alotaibi@rad.ae", dept: "FIN", grade: "L4", role: "employee", type: "full_time", gender: "male", nationality: "SA", joinDate: "2022-08-01", loc: "AUH-01" },
  { first: "Meera", last: "Krishnan", email: "meera.krishnan@rad.ae", dept: "FIN", grade: "L3", role: "employee", type: "full_time", gender: "female", nationality: "IN", joinDate: "2023-03-15", loc: "DXB-HQ" },
  { first: "Sami", last: "Haddad", email: "sami.haddad@rad.ae", dept: "FIN", grade: "L2", role: "employee", type: "full_time", gender: "male", nationality: "LB", joinDate: "2024-05-01", loc: "DXB-HQ" },
  // Sales & Marketing (5)
  { first: "Layla", last: "Al-Amiri", email: "layla.alamiri@rad.ae", dept: "SALES", grade: "L6", role: "line_manager", type: "full_time", gender: "female", nationality: "AE", joinDate: "2020-02-01", loc: "DXB-HQ" },
  { first: "Carlos", last: "Rivera", email: "carlos.rivera@rad.ae", dept: "SALES", grade: "L4", role: "employee", type: "full_time", gender: "male", nationality: "ES", joinDate: "2022-10-01", loc: "DXB-HQ" },
  { first: "Yasmin", last: "Khalil", email: "yasmin.khalil@rad.ae", dept: "SALES", grade: "L4", role: "employee", type: "full_time", gender: "female", nationality: "AE", joinDate: "2023-01-15", loc: "DXB-HQ" },
  { first: "Raj", last: "Kapoor", email: "raj.kapoor@rad.ae", dept: "SALES", grade: "L3", role: "employee", type: "full_time", gender: "male", nationality: "IN", joinDate: "2023-11-01", loc: "AUH-01" },
  { first: "Nadia", last: "Benali", email: "nadia.benali@rad.ae", dept: "SALES", grade: "L2", role: "employee", type: "full_time", gender: "female", nationality: "MA", joinDate: "2024-09-01", loc: "DXB-HQ" },
];

const empIds = [];
let empNum = 1;
for (const emp of employeeData) {
  const employeeNumber = `RAD-${String(empNum).padStart(4, "0")}`;
  empNum++;
  const joinDateTime = emp.joinDate ? emp.joinDate + " 00:00:00" : null;
  await connection.execute(
    `INSERT IGNORE INTO employees
      (companyId, employeeNumber, firstName, lastName, workEmail, departmentId, designationId, hcmRoleId,
       locationId, employmentType, status, gender, nationality, joinDate, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NOW(), NOW())`,
    [
      companyId, employeeNumber, emp.first, emp.last, emp.email,
      deptIds[emp.dept], desigIds[emp.grade], roleIds[emp.role],
      locationIds[emp.loc], emp.type, emp.gender, emp.nationality, joinDateTime,
    ]
  );
  const [rows] = await connection.execute(`SELECT id FROM employees WHERE companyId=? AND workEmail=?`, [companyId, emp.email]);
  if (rows[0]) {
    empIds.push(rows[0].id);
    console.log(`  ✓  Employee — ${emp.first} ${emp.last} (${employeeNumber})`);
  }
}

// ─── 7. Leave Types ───────────────────────────────────────────────────────────
console.log("\n6. Leave Types");
const leaveTypeData = [
  { name: "Annual Leave", code: "AL", isPaid: 1, isCarryForward: 1, maxCarryDays: 5, colorCode: "#10b981", maxBalance: 30 },
  { name: "Sick Leave", code: "SL", isPaid: 1, isCarryForward: 0, maxCarryDays: 0, colorCode: "#ef4444", maxBalance: 15 },
  { name: "Emergency Leave", code: "EL", isPaid: 1, isCarryForward: 0, maxCarryDays: 0, colorCode: "#f59e0b", maxBalance: 5 },
  { name: "Maternity Leave", code: "ML", isPaid: 1, isCarryForward: 0, maxCarryDays: 0, colorCode: "#8b5cf6", maxBalance: 90, applicableGender: "female" },
  { name: "Unpaid Leave", code: "UL", isPaid: 0, isCarryForward: 0, maxCarryDays: 0, colorCode: "#6b7280", maxBalance: 30 },
];
const leaveTypeIds = {};
for (const lt of leaveTypeData) {
  await connection.execute(
    `INSERT IGNORE INTO leaveTypes
      (companyId, name, code, isPaid, isCarryForward, maxCarryDays, colorCode, maxBalance,
       applicableGender, requiresApproval, accrualType, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'none', 1, NOW(), NOW())`,
    [companyId, lt.name, lt.code, lt.isPaid, lt.isCarryForward, lt.maxCarryDays, lt.colorCode, lt.maxBalance, lt.applicableGender ?? "all"]
  );
  const [rows] = await connection.execute(`SELECT id FROM leaveTypes WHERE companyId=? AND code=?`, [companyId, lt.code]);
  leaveTypeIds[lt.code] = rows[0]?.id;
  console.log(`  ✓  Leave Type — ${lt.name}`);
}

// ─── 8. Leave Policies ────────────────────────────────────────────────────────
console.log("\n7. Leave Policies");
const policyData = [
  { name: "Annual Leave Policy (All)", ltCode: "AL", entitlement: 30 },
  { name: "Sick Leave Policy (All)", ltCode: "SL", entitlement: 15 },
  { name: "Emergency Leave Policy (All)", ltCode: "EL", entitlement: 5 },
  { name: "Maternity Leave Policy (Female)", ltCode: "ML", entitlement: 90, gender: "female" },
  { name: "Unpaid Leave Policy (All)", ltCode: "UL", entitlement: 30 },
];
for (const p of policyData) {
  await run(`Leave Policy — ${p.name}`, () =>
    connection.execute(
      `INSERT IGNORE INTO leavePolicies
        (companyId, name, leaveTypeId, applicableTo, gender, entitlementDays, prorateOnJoining, prorateOnExit, effectiveFrom, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, 'all', ?, ?, 1, 1, '2025-01-01 00:00:00', 1, NOW(), NOW())`,
      [companyId, p.name, leaveTypeIds[p.ltCode], p.gender ?? "all", p.entitlement]
    )
  );
}

// ─── 9. Leave Balances ────────────────────────────────────────────────────────
console.log("\n8. Leave Balances (2025)");
const year = 2025;
let balanceCount = 0;
for (const empId of empIds) {
  for (const [code, ltId] of Object.entries(leaveTypeIds)) {
    const entitled = code === "AL" ? 30 : code === "SL" ? 15 : code === "EL" ? 5 : code === "ML" ? 90 : 30;
    const used = code === "AL" ? Math.floor(Math.random() * 8) : code === "SL" ? Math.floor(Math.random() * 3) : 0;
    const balance = entitled - used;
    try {
      await connection.execute(
        `INSERT IGNORE INTO leaveBalances (companyId, employeeId, leaveTypeId, year, entitled, used, pending, carryForward, compensatory, balance, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, NOW(), NOW())`,
        [companyId, empId, ltId, year, entitled, used, balance]
      );
      balanceCount++;
    } catch (e) { /* skip duplicates */ }
  }
}
console.log(`  ✓  Created ${balanceCount} leave balance records`);

// ─── 10. Sample Leave Requests ────────────────────────────────────────────────
console.log("\n9. Sample Leave Requests");
const leaveRequestData = [
  { empIdx: 1, ltCode: "AL", start: "2025-05-05", end: "2025-05-07", days: 3, status: "approved", reason: "Family vacation" },
  { empIdx: 2, ltCode: "SL", start: "2025-05-12", end: "2025-05-13", days: 2, status: "approved", reason: "Flu and fever" },
  { empIdx: 3, ltCode: "AL", start: "2025-05-19", end: "2025-05-21", days: 3, status: "pending", reason: "Personal travel" },
  { empIdx: 5, ltCode: "EL", start: "2025-05-08", end: "2025-05-08", days: 1, status: "approved", reason: "Family emergency" },
  { empIdx: 7, ltCode: "SL", start: "2025-05-15", end: "2025-05-16", days: 2, status: "rejected", reason: "Migraine", rejectedReason: "Insufficient medical documentation" },
  { empIdx: 10, ltCode: "AL", start: "2025-06-02", end: "2025-06-06", days: 5, status: "pending", reason: "Summer holiday" },
  { empIdx: 12, ltCode: "AL", start: "2025-05-26", end: "2025-05-28", days: 3, status: "approved", reason: "Eid holidays extension" },
  { empIdx: 15, ltCode: "SL", start: "2025-05-20", end: "2025-05-20", days: 1, status: "approved", reason: "Doctor appointment" },
];
for (const lr of leaveRequestData) {
  const empId = empIds[lr.empIdx];
  if (!empId) continue;
  await run(`Leave Request — ${employeeData[lr.empIdx]?.first} (${lr.ltCode})`, () =>
    connection.execute(
      `INSERT IGNORE INTO leaveRequests
        (companyId, employeeId, leaveTypeId, startDate, endDate, days, reason, status, rejectedReason, isHalfDay, aiDraftUsed, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [companyId, empId, leaveTypeIds[lr.ltCode], lr.start + " 00:00:00", lr.end + " 00:00:00", lr.days, lr.reason, lr.status, lr.rejectedReason ?? null]
    )
  );
}

// ─── 11. Attendance Records (May 2025) ────────────────────────────────────────
console.log("\n10. Attendance Records (May 2025)");
const MAY_2025_DAYS = 31;
const MAY_START = new Date("2025-05-01");
let attendanceCount = 0;

for (const empId of empIds) {
  for (let d = 1; d <= MAY_2025_DAYS; d++) {
    const date = new Date(2025, 4, d); // Month is 0-indexed
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

    // Friday-Saturday weekend (UAE)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      try {
        await connection.execute(
          `INSERT IGNORE INTO attendanceRecords (companyId, employeeId, date, status, source, workMinutes, createdAt, updatedAt)
           VALUES (?, ?, ?, 'weekend', 'manual', 0, NOW(), NOW())`,
          [companyId, empId, date.toISOString().split("T")[0] + " 00:00:00"]
        );
        attendanceCount++;
      } catch (e) { /* skip */ }
      continue;
    }

    // Random attendance status weighted towards present
    const rand = Math.random();
    let status, clockIn, clockOut, workMinutes, lateMinutes;

    if (rand < 0.75) {
      // Present (on time)
      status = "present";
      const inHour = 8 + Math.floor(Math.random() * 1); // 8:00-8:59
      const inMin = Math.floor(Math.random() * 30);
      clockIn = `2025-05-${String(d).padStart(2,"0")} ${String(inHour).padStart(2,"0")}:${String(inMin).padStart(2,"0")}:00`;
      clockOut = `2025-05-${String(d).padStart(2,"0")} 17:${String(Math.floor(Math.random()*30)).padStart(2,"0")}:00`;
      workMinutes = 480 + Math.floor(Math.random() * 30);
      lateMinutes = 0;
    } else if (rand < 0.87) {
      // Late
      status = "late";
      const inHour = 9 + Math.floor(Math.random() * 2); // 9:00-10:59
      const inMin = Math.floor(Math.random() * 60);
      clockIn = `2025-05-${String(d).padStart(2,"0")} ${String(inHour).padStart(2,"0")}:${String(inMin).padStart(2,"0")}:00`;
      clockOut = `2025-05-${String(d).padStart(2,"0")} 18:${String(Math.floor(Math.random()*30)).padStart(2,"0")}:00`;
      lateMinutes = (inHour - 9) * 60 + inMin + 60;
      workMinutes = 480 - lateMinutes + 60;
    } else if (rand < 0.93) {
      // On leave
      status = "on_leave";
      clockIn = null; clockOut = null; workMinutes = 0; lateMinutes = 0;
    } else {
      // Absent
      status = "absent";
      clockIn = null; clockOut = null; workMinutes = 0; lateMinutes = 0;
    }

    try {
      await connection.execute(
        `INSERT IGNORE INTO attendanceRecords
          (companyId, employeeId, date, clockIn, clockOut, status, source, workMinutes, lateMinutes, geoFenceStatus, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'web', ?, ?, 'inside', NOW(), NOW())`,
        [companyId, empId, date.toISOString().split("T")[0] + " 00:00:00", clockIn, clockOut, status, workMinutes ?? 0, lateMinutes ?? 0]
      );
      attendanceCount++;
    } catch (e) { /* skip duplicates */ }
  }
}
console.log(`  ✓  Created ${attendanceCount} attendance records for May 2025`);

// ─── 12. Salary Structures ────────────────────────────────────────────────────
console.log("\n11. Salary Structures");
const salaryStructureData = [
  { name: "Standard UAE Package", currency: "AED", description: "Standard package with housing and transport allowances" },
  { name: "Senior Package", currency: "AED", description: "Senior-level package with enhanced allowances" },
  { name: "Intern Package", currency: "AED", description: "Internship stipend package" },
];
const structureIds = {};
for (const ss of salaryStructureData) {
  await connection.execute(
    `INSERT IGNORE INTO salaryStructures (companyId, name, currency, description, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
    [companyId, ss.name, ss.currency, ss.description]
  );
  const [rows] = await connection.execute(`SELECT id FROM salaryStructures WHERE companyId=? AND name=?`, [companyId, ss.name]);
  structureIds[ss.name] = rows[0]?.id;
  console.log(`  ✓  Salary Structure — ${ss.name}`);
}

// ─── 13. Salary Components ────────────────────────────────────────────────────
console.log("\n12. Salary Components");
const componentData = [
  { name: "Basic Salary", code: "BASIC", type: "earning", calcType: "fixed", value: 0, sortOrder: 1 },
  { name: "Housing Allowance", code: "HRA", type: "earning", calcType: "percentage_of_basic", value: 25, sortOrder: 2 },
  { name: "Transport Allowance", code: "TRANS", type: "earning", calcType: "fixed", value: 1500, sortOrder: 3 },
  { name: "Mobile Allowance", code: "MOB", type: "earning", calcType: "fixed", value: 300, sortOrder: 4 },
  { name: "Overtime Pay", code: "OT", type: "earning", calcType: "fixed", value: 0, sortOrder: 5 },
  { name: "Absence Deduction", code: "ABS_DED", type: "deduction", calcType: "fixed", value: 0, sortOrder: 10 },
  { name: "Loan Deduction", code: "LOAN_DED", type: "deduction", calcType: "fixed", value: 0, sortOrder: 11 },
];
const componentIds = {};
for (const comp of componentData) {
  await connection.execute(
    `INSERT IGNORE INTO salaryComponents
      (companyId, name, code, type, calculationType, value, isTaxable, isPFApplicable, isActive, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?, NOW(), NOW())`,
    [companyId, comp.name, comp.code, comp.type, comp.calcType, comp.value, comp.sortOrder]
  );
  const [rows] = await connection.execute(`SELECT id FROM salaryComponents WHERE companyId=? AND code=?`, [companyId, comp.code]);
  componentIds[comp.code] = rows[0]?.id;
  console.log(`  ✓  Salary Component — ${comp.name}`);
}

// ─── 14. Link Components to Structures ────────────────────────────────────────
console.log("\n13. Linking Components to Structures");
const structureComponentLinks = [
  // Standard package
  { structName: "Standard UAE Package", compCode: "BASIC" },
  { structName: "Standard UAE Package", compCode: "HRA" },
  { structName: "Standard UAE Package", compCode: "TRANS" },
  { structName: "Standard UAE Package", compCode: "MOB" },
  // Senior package
  { structName: "Senior Package", compCode: "BASIC" },
  { structName: "Senior Package", compCode: "HRA" },
  { structName: "Senior Package", compCode: "TRANS", overrideValue: 2000 },
  { structName: "Senior Package", compCode: "MOB", overrideValue: 500 },
  // Intern package
  { structName: "Intern Package", compCode: "BASIC" },
  { structName: "Intern Package", compCode: "TRANS", overrideValue: 500 },
];
for (const link of structureComponentLinks) {
  const structId = structureIds[link.structName];
  const compId = componentIds[link.compCode];
  if (!structId || !compId) continue;
  await run(`Link ${link.compCode} → ${link.structName}`, () =>
    connection.execute(
      `INSERT IGNORE INTO salaryStructureComponents (structureId, componentId, overrideValue, isActive)
       VALUES (?, ?, ?, 1)`,
      [structId, compId, link.overrideValue ?? null]
    )
  );
}

// ─── 15. Employee Salary Assignments ─────────────────────────────────────────
console.log("\n14. Employee Salary Assignments");
const salaryAssignments = [
  // Engineering
  { empIdx: 0, structName: "Senior Package", basic: 22000 },
  { empIdx: 1, structName: "Senior Package", basic: 18000 },
  { empIdx: 2, structName: "Senior Package", basic: 17500 },
  { empIdx: 3, structName: "Standard UAE Package", basic: 12000 },
  { empIdx: 4, structName: "Standard UAE Package", basic: 11500 },
  { empIdx: 5, structName: "Standard UAE Package", basic: 11000 },
  { empIdx: 6, structName: "Standard UAE Package", basic: 8500 },
  { empIdx: 7, structName: "Standard UAE Package", basic: 8000 },
  { empIdx: 8, structName: "Standard UAE Package", basic: 7000 },
  { empIdx: 9, structName: "Intern Package", basic: 3500 },
  // HR
  { empIdx: 10, structName: "Senior Package", basic: 16000 },
  { empIdx: 11, structName: "Standard UAE Package", basic: 12000 },
  { empIdx: 12, structName: "Standard UAE Package", basic: 9000 },
  { empIdx: 13, structName: "Standard UAE Package", basic: 8500 },
  { empIdx: 14, structName: "Standard UAE Package", basic: 7500 },
  // Finance
  { empIdx: 15, structName: "Senior Package", basic: 21000 },
  { empIdx: 16, structName: "Senior Package", basic: 17000 },
  { empIdx: 17, structName: "Standard UAE Package", basic: 13000 },
  { empIdx: 18, structName: "Standard UAE Package", basic: 9500 },
  { empIdx: 19, structName: "Standard UAE Package", basic: 7000 },
  // Sales
  { empIdx: 20, structName: "Senior Package", basic: 15000 },
  { empIdx: 21, structName: "Standard UAE Package", basic: 11000 },
  { empIdx: 22, structName: "Standard UAE Package", basic: 10500 },
  { empIdx: 23, structName: "Standard UAE Package", basic: 8000 },
  { empIdx: 24, structName: "Standard UAE Package", basic: 6500 },
];
for (const sa of salaryAssignments) {
  const empId = empIds[sa.empIdx];
  const structId = structureIds[sa.structName];
  if (!empId || !structId) continue;
  await run(`Salary Assignment — ${employeeData[sa.empIdx]?.first} (${sa.basic} AED)`, () =>
    connection.execute(
      `INSERT IGNORE INTO employeeSalaryAssignments (employeeId, structureId, basicSalary, currency, effectiveDate, createdAt, updatedAt)
       VALUES (?, ?, ?, 'AED', '2025-01-01 00:00:00', NOW(), NOW())`,
      [empId, structId, sa.basic]
    )
  );
}

// ─── 16. Job Posting ──────────────────────────────────────────────────────────
console.log("\n15. Job Posting");
let jobPostingId;
await run("Job Posting — Senior Full-Stack Engineer", async () => {
  const [result] = await connection.execute(
    `INSERT IGNORE INTO jobPostings
      (companyId, title, description, requirements, responsibilities, location, type,
       salaryMin, salaryMax, currency, experienceMin, experienceMax,
       skills, isPublic, status, publishedAt, closingDate, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 'full_time', ?, ?, 'AED', 3, 7, ?, 1, 'published', NOW(), ?, NOW(), NOW())`,
    [
      companyId,
      "Senior Full-Stack Engineer",
      "We are looking for an experienced Full-Stack Engineer to join our growing Engineering team at Rad Technologies. You will design, build, and maintain scalable web applications that power our HCM platform.",
      "• 3+ years of experience with React and Node.js\n• Strong TypeScript skills\n• Experience with relational databases (MySQL/PostgreSQL)\n• Familiarity with REST APIs and tRPC\n• Experience with cloud platforms (AWS/GCP/Azure)\n• Strong problem-solving and communication skills",
      "• Design and implement new features across the full stack\n• Collaborate with product and design teams\n• Write clean, maintainable, and well-tested code\n• Participate in code reviews\n• Mentor junior engineers",
      "Dubai, UAE",
      18000, 25000,
      JSON.stringify(["React", "Node.js", "TypeScript", "MySQL", "AWS", "tRPC"]),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] + " 00:00:00",
    ]
  );
  jobPostingId = result.insertId;
});
if (!jobPostingId) {
  const [rows] = await connection.execute(`SELECT id FROM jobPostings WHERE companyId=? AND title=?`, [companyId, "Senior Full-Stack Engineer"]);
  jobPostingId = rows[0]?.id;
}

// ─── 17. Candidates & Applications ───────────────────────────────────────────
console.log("\n16. Candidates & Applications");
const candidateData = [
  { first: "James", last: "Wilson", email: "james.wilson@gmail.com", title: "Full-Stack Developer", company: "TechCorp Dubai", exp: 5, skills: ["React", "Node.js", "TypeScript"], source: "linkedin", stage: "interview", score: 82 },
  { first: "Amira", last: "Hassan", email: "amira.hassan@outlook.com", title: "Senior Engineer", company: "StartupXYZ", exp: 4, skills: ["React", "TypeScript", "AWS"], source: "career_portal", stage: "shortlisted", score: 75 },
  { first: "David", last: "Chen", email: "david.chen@yahoo.com", title: "Software Engineer", company: "Freelance", exp: 6, skills: ["Node.js", "MySQL", "Docker"], source: "referral", stage: "screening", score: 68 },
  { first: "Zara", last: "Ahmed", email: "zara.ahmed@proton.me", title: "Frontend Developer", company: "AgencyABC", exp: 3, skills: ["React", "TypeScript"], source: "job_board", stage: "applied", score: 55 },
  { first: "Marco", last: "Rossi", email: "marco.rossi@gmail.com", title: "Backend Engineer", company: "FinTech Ltd", exp: 7, skills: ["Node.js", "TypeScript", "AWS", "MySQL"], source: "direct", stage: "evaluation", score: 90 },
];
const candidateIds = [];
for (const cand of candidateData) {
  await connection.execute(
    `INSERT IGNORE INTO candidates
      (companyId, firstName, lastName, email, currentTitle, currentCompany, totalExperience, skills, source, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
    [companyId, cand.first, cand.last, cand.email, cand.title, cand.company, cand.exp, JSON.stringify(cand.skills), cand.source]
  );
  const [rows] = await connection.execute(`SELECT id FROM candidates WHERE companyId=? AND email=?`, [companyId, cand.email]);
  if (rows[0]) {
    candidateIds.push({ id: rows[0].id, ...cand });
    console.log(`  ✓  Candidate — ${cand.first} ${cand.last}`);
  }
}

// Create applications
if (jobPostingId) {
  for (const cand of candidateIds) {
    await run(`Application — ${cand.first} ${cand.last} → Senior Full-Stack Engineer`, () =>
      connection.execute(
        `INSERT IGNORE INTO applications
          (companyId, jobPostingId, candidateId, stage, status, aiScreeningScore, aiMatchScore, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'active', ?, ?, NOW(), NOW())`,
        [companyId, jobPostingId, cand.id, cand.stage, cand.score, cand.score]
      )
    );
  }
}

// ─── 18. Appraisal Template ───────────────────────────────────────────────────
console.log("\n17. Appraisal Template & Cycle");
let appraisalTemplateId;
await run("Appraisal Template — Annual Performance Review", async () => {
  const [result] = await connection.execute(
    `INSERT IGNORE INTO appraisalTemplates
      (companyId, name, description, templateType, scoringPolicy, incrementPolicy, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, 'universal', ?, ?, 1, NOW(), NOW())`,
    [
      companyId,
      "Annual Performance Review",
      "Standard annual performance review template covering KPIs, competencies, and development goals",
      JSON.stringify({ scale: 5, labels: { 1: "Unsatisfactory", 2: "Needs Improvement", 3: "Meets Expectations", 4: "Exceeds Expectations", 5: "Outstanding" }, passingScore: 3 }),
      JSON.stringify({ bands: [{ minScore: 4.5, maxScore: 5, incrementPct: 15 }, { minScore: 4.0, maxScore: 4.49, incrementPct: 10 }, { minScore: 3.5, maxScore: 3.99, incrementPct: 7 }, { minScore: 3.0, maxScore: 3.49, incrementPct: 5 }, { minScore: 0, maxScore: 2.99, incrementPct: 0 }] }),
    ]
  );
  appraisalTemplateId = result.insertId;
});
if (!appraisalTemplateId) {
  const [rows] = await connection.execute(`SELECT id FROM appraisalTemplates WHERE companyId=? AND name=?`, [companyId, "Annual Performance Review"]);
  appraisalTemplateId = rows[0]?.id;
}

// Appraisal Sections
if (appraisalTemplateId) {
  const sections = [
    { title: "Key Performance Indicators", type: "kpi", weight: 50, order: 1 },
    { title: "Core Competencies", type: "competency", weight: 30, order: 2 },
    { title: "Development Goals", type: "development", weight: 20, order: 3 },
  ];
  for (const sec of sections) {
    await run(`Appraisal Section — ${sec.title}`, () =>
      connection.execute(
        `INSERT IGNORE INTO appraisalSections (templateId, title, sectionType, weight, displayOrder, isRequired)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [appraisalTemplateId, sec.title, sec.type, sec.weight, sec.order]
      )
    );
  }
}

// ─── 19. Appraisal Cycle ──────────────────────────────────────────────────────
let appraisalCycleId;
await run("Appraisal Cycle — Annual Review 2025", async () => {
  const [result] = await connection.execute(
    `INSERT IGNORE INTO appraisalCycles
      (companyId, name, periodLabel, cycleType, templateId, startDate, endDate,
       selfReviewDeadline, managerReviewDeadline, calibrationDeadline, status, createdAt, updatedAt)
     VALUES (?, ?, ?, 'annual', ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
    [
      companyId,
      "Annual Performance Review 2025",
      "FY 2025",
      appraisalTemplateId,
      "2025-01-01 00:00:00",
      "2025-12-31 00:00:00",
      "2025-11-30 00:00:00",
      "2025-12-15 00:00:00",
      "2025-12-22 00:00:00",
    ]
  );
  appraisalCycleId = result.insertId;
});
if (!appraisalCycleId) {
  const [rows] = await connection.execute(`SELECT id FROM appraisalCycles WHERE companyId=? AND name=?`, [companyId, "Annual Performance Review 2025"]);
  appraisalCycleId = rows[0]?.id;
}

// ─── 20. Cycle Participants ───────────────────────────────────────────────────
if (appraisalCycleId) {
  console.log("\n18. Cycle Participants");
  // Assign all full-time employees to the cycle
  const fullTimeEmps = employeeData
    .map((e, i) => ({ ...e, empId: empIds[i] }))
    .filter(e => e.type === "full_time" && e.empId);

  // Build manager map: line managers are indices 0 (ENG), 10 (HR), 15 (FIN), 20 (SALES)
  const managerMap = {
    ENG: empIds[0],
    HR: empIds[10],
    FIN: empIds[15],
    SALES: empIds[20],
  };

  let participantCount = 0;
  for (const emp of fullTimeEmps) {
    const managerId = managerMap[emp.dept] !== emp.empId ? managerMap[emp.dept] : null;
    const selfScore = (3 + Math.random() * 2).toFixed(2);
    const managerScore = (3 + Math.random() * 2).toFixed(2);
    const finalScore = ((parseFloat(selfScore) + parseFloat(managerScore)) / 2).toFixed(2);
    const status = parseFloat(finalScore) >= 4 ? "calibrated" : "manager_submitted";

    try {
      await connection.execute(
        `INSERT IGNORE INTO cycleParticipants
          (cycleId, employeeId, managerId, status, selfScore, managerScore, finalScore, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [appraisalCycleId, emp.empId, managerId, status, selfScore, managerScore, finalScore]
      );
      participantCount++;
    } catch (e) { /* skip */ }
  }
  console.log(`  ✓  Added ${participantCount} cycle participants`);
}

// ─── 21. KPI Groups & Definitions ────────────────────────────────────────────
console.log("\n19. KPI Groups & Definitions");
const kpiGroupData = [
  { name: "Engineering KPIs", deptCode: "ENG" },
  { name: "HR KPIs", deptCode: "HR" },
  { name: "Finance KPIs", deptCode: "FIN" },
  { name: "Sales KPIs", deptCode: "SALES" },
];
const kpiGroupIds = {};
for (const kg of kpiGroupData) {
  await connection.execute(
    `INSERT IGNORE INTO kpiGroups (companyId, name, departmentId, isActive, createdAt)
     VALUES (?, ?, ?, 1, NOW())`,
    [companyId, kg.name, deptIds[kg.deptCode]]
  );
  const [rows] = await connection.execute(`SELECT id FROM kpiGroups WHERE companyId=? AND name=?`, [companyId, kg.name]);
  kpiGroupIds[kg.deptCode] = rows[0]?.id;
  console.log(`  ✓  KPI Group — ${kg.name}`);
}

const kpiDefinitionData = [
  // Engineering
  { group: "ENG", title: "Code Quality Score", unit: "%", targetType: "percentage", target: "90", weight: 25 },
  { group: "ENG", title: "Sprint Velocity", unit: "story points", targetType: "numeric", target: "40", weight: 25 },
  { group: "ENG", title: "Bug Resolution Rate", unit: "%", targetType: "percentage", target: "95", weight: 25 },
  { group: "ENG", title: "On-time Delivery", unit: "%", targetType: "percentage", target: "90", weight: 25 },
  // HR
  { group: "HR", title: "Time-to-Hire", unit: "days", targetType: "numeric", target: "30", weight: 30 },
  { group: "HR", title: "Employee Satisfaction Score", unit: "%", targetType: "percentage", target: "85", weight: 35 },
  { group: "HR", title: "Training Completion Rate", unit: "%", targetType: "percentage", target: "90", weight: 35 },
  // Finance
  { group: "FIN", title: "Payroll Accuracy", unit: "%", targetType: "percentage", target: "99.9", weight: 40 },
  { group: "FIN", title: "Budget Variance", unit: "%", targetType: "percentage", target: "5", weight: 30 },
  { group: "FIN", title: "Report Timeliness", unit: "%", targetType: "percentage", target: "100", weight: 30 },
  // Sales
  { group: "SALES", title: "Revenue Target Achievement", unit: "%", targetType: "percentage", target: "100", weight: 40 },
  { group: "SALES", title: "New Clients Acquired", unit: "count", targetType: "numeric", target: "10", weight: 30 },
  { group: "SALES", title: "Customer Satisfaction (NPS)", unit: "score", targetType: "numeric", target: "70", weight: 30 },
];
for (const kpi of kpiDefinitionData) {
  const groupId = kpiGroupIds[kpi.group];
  if (!groupId) continue;
  await run(`KPI — ${kpi.title}`, () =>
    connection.execute(
      `INSERT IGNORE INTO kpiDefinitions
        (groupId, companyId, title, measurementUnit, targetType, defaultTarget, weight, isActive, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [groupId, companyId, kpi.title, kpi.unit, kpi.targetType, kpi.target, kpi.weight]
    )
  );
}

// ─── Done ──────────────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(60));
console.log("✅  Flow HCM Demo Seed Complete!\n");
console.log("📊  Summary:");
console.log(`   • 1 company: Rad Technologies`);
console.log(`   • 2 locations (Dubai HQ, Abu Dhabi Office)`);
console.log(`   • 4 departments: Engineering, HR, Finance, Sales`);
console.log(`   • 25 employees across all departments`);
console.log(`   • 5 leave types + policies + balances`);
console.log(`   • ${MAY_2025_DAYS * empIds.length} attendance records (May 2025)`);
console.log(`   • 3 salary structures + components + assignments`);
console.log(`   • 1 open job posting (Senior Full-Stack Engineer)`);
console.log(`   • 5 candidates with applications at various stages`);
console.log(`   • 1 appraisal template + active 2025 cycle`);
console.log(`   • ${kpiDefinitionData.length} KPI definitions across 4 departments`);
console.log("═".repeat(60) + "\n");

await connection.end();
