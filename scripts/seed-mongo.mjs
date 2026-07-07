/**
 * Flow HCM — MongoDB Seed (foundation org + RBAC roles + test users)
 *
 * Seeds directly into the same MongoDB collections the app uses:
 *   • 1 company (Rad Technologies) -> companyId 1
 *   • 2 locations, 5 departments, 9 designations, 5 leave types, 6 employees
 *   • 7 predefined HCM roles (super_admin … viewer)
 *   • 1 owner admin + 6 role-based test users (one per role), each linked to
 *     an employee so self/team data scope can be tested.
 *
 * Fully idempotent — safe to re-run. Roles/users are upserted; existing
 * passwords are left unchanged.
 *
 * Usage:
 *   pnpm seed:mongo            (reads MONGODB_URI from .env)
 */

import mongoose, { Schema } from "mongoose";
import { randomBytes, scryptSync } from "node:crypto";
import dns from "node:dns";
import dotenv from "dotenv";

dotenv.config();

// Some networks/routers refuse SRV DNS lookups (mongodb+srv://). Force a public resolver.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  /* ignore — fall back to system DNS */
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI is not set. Aborting seed.");
  process.exit(1);
}

// ─── Credentials ─────────────────────────────────────────────────────────────
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "admin@corehr.app").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@CoreHR2026";
const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD || "Test@1234";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

// The 7 predefined roles — must match backend/src/rbac.ts PREDEFINED_ROLES.
const PREDEFINED_ROLES = [
  { slug: "super_admin", name: "Super Admin" },
  { slug: "hr_admin", name: "HR Admin" },
  { slug: "hr_manager", name: "HR Manager" },
  { slug: "payroll_admin", name: "Payroll Admin" },
  { slug: "department_manager", name: "Department Manager" },
  { slug: "employee", name: "Employee" },
  { slug: "viewer", name: "Viewer / Read-Only" },
];

// One test login per role (shared password), each linked to a seeded employee.
const TEST_USERS = [
  { email: "superadmin@corehr.app",  name: "Super Admin",        roleSlug: "super_admin",        userRole: "admin", empEmail: "zain.sheikh@radtech.example" },
  { email: "hradmin@corehr.app",     name: "HR Admin",           roleSlug: "hr_admin",           userRole: "user",  empEmail: "ayesha.khan@radtech.example" },
  { email: "hrmanager@corehr.app",   name: "HR Manager",         roleSlug: "hr_manager",         userRole: "user",  empEmail: "bilal.ahmed@radtech.example" },
  { email: "payroll@corehr.app",     name: "Payroll Admin",      roleSlug: "payroll_admin",      userRole: "user",  empEmail: "omar.farooq@radtech.example" },
  { email: "deptmanager@corehr.app", name: "Department Manager", roleSlug: "department_manager", userRole: "user",  empEmail: "sara.malik@radtech.example" },
  { email: "employee@corehr.app",    name: "Employee",           roleSlug: "employee",           userRole: "user",  empEmail: "hina.raza@radtech.example" },
];

// ─── Models (loose, model names match src/mongoDb.ts) ────────────────────────
const baseOptions = { versionKey: false, strict: false, timestamps: true };

const Counter =
  mongoose.models.Counter ||
  mongoose.model("Counter", new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } }, { versionKey: false }));

const model = (name) =>
  mongoose.models[name] || mongoose.model(name, new Schema({ id: { type: Number, index: true } }, baseOptions));

const CompanyModel = model("CompanyRecord");
const LocationModel = model("LocationRecord");
const DepartmentModel = model("DepartmentRecord");
const DesignationModel = model("DesignationRecord");
const LeaveTypeModel = model("LeaveTypeRecord");
const EmployeeModel = model("EmployeeRecord");
const UserModel = model("UserRecord");
const HcmRoleModel = model("HcmRoleRecord");
const UserRoleModel = model("UserRoleRecord");

async function nextId(key) {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return counter.seq;
}

async function createWithId(modelRef, key, data) {
  const id = await nextId(key);
  await modelRef.create({ id, ...data });
  return id;
}

// ─── Org (company + locations/departments/designations/leave types/employees) ─
async function seedOrg() {
  const companyId = await createWithId(CompanyModel, "companies", {
    name: "Rad Technologies", slug: "rad-technologies", industry: "Technology",
    country: "AE", currency: "AED", timezone: "Asia/Dubai", isActive: true,
  });
  console.log(`  ✓  Company — Rad Technologies (id: ${companyId})`);

  const locations = [
    { name: "Dubai HQ", code: "DXB-HQ", city: "Dubai", country: "AE" },
    { name: "Abu Dhabi Office", code: "AUH-01", city: "Abu Dhabi", country: "AE" },
  ];
  const locationIds = {};
  for (const loc of locations) {
    locationIds[loc.code] = await createWithId(LocationModel, "locations", { companyId, ...loc, isActive: true, geoFenceRadius: 200 });
  }

  const departments = [
    { name: "Engineering", code: "ENG" }, { name: "Human Resources", code: "HR" },
    { name: "Finance", code: "FIN" }, { name: "Operations", code: "OPS" },
    { name: "Sales & Marketing", code: "SALES" },
  ];
  const deptIds = {};
  for (const dept of departments) {
    deptIds[dept.code] = await createWithId(DepartmentModel, "departments", { companyId, ...dept, isActive: true });
  }

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
  const desigIds = {};
  for (const desig of designations) {
    desigIds[desig.name] = await createWithId(DesignationModel, "designations", { companyId, ...desig, isActive: true });
  }

  const leaveTypes = [
    { name: "Annual Leave", code: "AL", isPaid: true, colorCode: "#6366f1" },
    { name: "Sick Leave", code: "SL", isPaid: true, colorCode: "#ef4444" },
    { name: "Casual Leave", code: "CL", isPaid: true, colorCode: "#f59e0b" },
    { name: "Maternity Leave", code: "ML", isPaid: true, applicableGender: "female", colorCode: "#ec4899" },
    { name: "Unpaid Leave", code: "UL", isPaid: false, colorCode: "#6b7280" },
  ];
  for (const lt of leaveTypes) {
    await createWithId(LeaveTypeModel, "leaveTypes", { companyId, ...lt, requiresApproval: true, isActive: true });
  }

  const employees = [
    { firstName: "Ayesha", lastName: "Khan",   dept: "HR",    desig: "Manager",         loc: "DXB-HQ", gender: "female" },
    { firstName: "Bilal",  lastName: "Ahmed",  dept: "ENG",   desig: "Senior Engineer", loc: "DXB-HQ", gender: "male" },
    { firstName: "Sara",   lastName: "Malik",  dept: "ENG",   desig: "Engineer",        loc: "DXB-HQ", gender: "female" },
    { firstName: "Omar",   lastName: "Farooq", dept: "FIN",   desig: "Analyst",         loc: "AUH-01", gender: "male" },
    { firstName: "Hina",   lastName: "Raza",   dept: "OPS",   desig: "Associate",       loc: "AUH-01", gender: "female" },
    { firstName: "Zain",   lastName: "Sheikh", dept: "SALES", desig: "Senior Manager",  loc: "DXB-HQ", gender: "male" },
  ];
  let empNum = 1001;
  for (const emp of employees) {
    await createWithId(EmployeeModel, "employees", {
      companyId,
      employeeNumber: `EMP-${empNum++}`,
      firstName: emp.firstName, lastName: emp.lastName, displayName: `${emp.firstName} ${emp.lastName}`,
      gender: emp.gender,
      workEmail: `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}@radtech.example`,
      departmentId: deptIds[emp.dept], designationId: desigIds[emp.desig], locationId: locationIds[emp.loc],
      joinDate: new Date("2024-01-15"), employmentType: "full_time", status: "active",
    });
  }
  console.log(`  ✓  2 locations, 5 departments, 9 designations, 5 leave types, 6 employees`);
  return companyId;
}

// ─── Roles + users ───────────────────────────────────────────────────────────
async function ensureAdminUser() {
  const existing = await UserModel.findOne({ email: ADMIN_EMAIL }).lean();
  if (existing) return;
  await UserModel.create({
    id: await nextId("users"),
    openId: `local:${ADMIN_EMAIL}`, name: "Administrator", email: ADMIN_EMAIL,
    passwordHash: hashPassword(ADMIN_PASSWORD), loginMethod: "password", role: "admin", lastSignedIn: new Date(),
  });
  console.log(`  ✓  Owner admin — ${ADMIN_EMAIL}`);
}

async function seedRolesAndTestUsers(companyId) {
  // 1. Predefined roles (idempotent by slug)
  const slugToRoleId = {};
  for (const r of PREDEFINED_ROLES) {
    const existing = await HcmRoleModel.findOne({ companyId, slug: r.slug }).lean();
    slugToRoleId[r.slug] = existing
      ? existing.id
      : await createWithId(HcmRoleModel, "hcmRoles", { companyId, name: r.name, slug: r.slug, isPredefined: true, isActive: true });
  }
  console.log(`  ✓  ${PREDEFINED_ROLES.length} HCM roles ensured`);

  // 2. Test users + role assignment + employee link (idempotent)
  for (const u of TEST_USERS) {
    const email = u.email.toLowerCase();
    let user = await UserModel.findOne({ email }).lean();
    if (!user) {
      const id = await nextId("users");
      await UserModel.create({
        id, openId: `local:${email}`, name: u.name, email,
        passwordHash: hashPassword(TEST_PASSWORD), loginMethod: "password", role: u.userRole, lastSignedIn: new Date(),
      });
      user = { id };
    }

    const roleId = slugToRoleId[u.roleSlug];
    const assign = await UserRoleModel.findOne({ userId: user.id, hcmRoleId: roleId, companyId }).lean();
    if (!assign) {
      await createWithId(UserRoleModel, "userRoles", { userId: user.id, hcmRoleId: roleId, companyId, isActive: true, assignedAt: new Date() });
    } else if (!assign.isActive) {
      await UserRoleModel.updateOne({ id: assign.id }, { $set: { isActive: true } });
    }

    if (u.empEmail) {
      await EmployeeModel.updateOne({ companyId, workEmail: u.empEmail }, { $set: { userId: user.id } });
    }
    console.log(`  ✓  ${email.padEnd(24)} → ${u.roleSlug}`);
  }
}

async function main() {
  console.log("🌱  Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("   ✓  Connected to DB:", mongoose.connection.name);

  console.log("\n👤  Owner admin");
  await ensureAdminUser();

  console.log("\n🏢  Organization");
  let companyId;
  const existingCompany = await CompanyModel.findOne({ slug: "rad-technologies" }).lean();
  if (existingCompany) {
    companyId = existingCompany.id;
    console.log(`  ⚠  Company already exists (id: ${companyId}) — skipping org creation.`);
  } else {
    companyId = await seedOrg();
  }

  console.log("\n🔐  Roles + role-based test users");
  await seedRolesAndTestUsers(companyId);

  console.log("\n✅  Seed complete!");
  printCredentials();
  await mongoose.disconnect();
}

function printCredentials() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  LOGIN CREDENTIALS");
  console.log("──────────────────────────────────────────────────────────────");
  console.log(`  OWNER ADMIN (super_admin)`);
  console.log(`    ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`);
  console.log("");
  console.log(`  ROLE TEST USERS  (password for all: ${TEST_PASSWORD})`);
  for (const u of TEST_USERS) {
    console.log(`    ${u.email.padEnd(24)} → ${u.roleSlug}`);
  }
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  (Change passwords after first login for production.)");
}

main().catch(async (err) => {
  console.error("\n❌  Seed failed:", err?.message || err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
