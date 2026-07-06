/**
 * Flow HCM — MongoDB Foundation Seed
 *
 * The app's core HR modules (org, employees, leave, attendance, dashboard,
 * workflow, roles) read from MongoDB via src/mongoDb.ts. The legacy seed.mjs /
 * seed-demo.mjs scripts only target MySQL (DATABASE_URL), so they cannot
 * populate a MongoDB deployment.
 *
 * This script seeds a foundation company directly into the same MongoDB
 * collections the app uses:
 *   • 1 company (Rad Technologies)  -> becomes companyId 1
 *   • 2 locations, 5 departments, 9 designations
 *   • 5 leave types
 *   • 6 sample employees
 *
 * Predefined HCM roles + permissions are auto-seeded by the app itself the
 * first time getHcmRoles()/getUserRoles() runs, so they are intentionally
 * NOT created here.
 *
 * Idempotent: if a company with slug "rad-technologies" already exists, it
 * exits without changes.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/seed-mongo.mjs
 *   — or, if MONGODB_URI is in .env —
 *   pnpm seed:mongo
 */

import mongoose, { Schema } from "mongoose";
import { randomBytes, scryptSync } from "node:crypto";
import dns from "node:dns";
import dotenv from "dotenv";

dotenv.config();

// Some networks/routers refuse SRV DNS lookups (mongodb+srv://), causing
// "querySrv ECONNREFUSED". Force a public resolver that supports SRV records.
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

// Admin credentials (override via env). Must match auth.ts scrypt format.
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "admin@corehr.app").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@CoreHR2026";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

// Loose schemas (strict:false) so we can write exactly the fields the app
// expects. Model names MUST match src/mongoDb.ts so the derived collection
// names line up (e.g. "CompanyRecord" -> "companyrecords").
const baseOptions = { versionKey: false, strict: false, timestamps: true };

const Counter =
  mongoose.models.Counter ||
  mongoose.model(
    "Counter",
    new Schema({ key: { type: String, unique: true }, seq: { type: Number, default: 0 } }, { versionKey: false })
  );

const model = (name) =>
  mongoose.models[name] || mongoose.model(name, new Schema({ id: { type: Number, index: true } }, baseOptions));

const CompanyModel = model("CompanyRecord");
const LocationModel = model("LocationRecord");
const DepartmentModel = model("DepartmentRecord");
const DesignationModel = model("DesignationRecord");
const LeaveTypeModel = model("LeaveTypeRecord");
const EmployeeModel = model("EmployeeRecord");
const UserModel = model("UserRecord");

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

async function main() {
  console.log("🌱  Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("   ✓  Connected to DB:", mongoose.connection.name);

  // ─── 0. Admin user (email/password) ──────────────────────────────────────
  const existingAdmin = await UserModel.findOne({ email: ADMIN_EMAIL }).lean();
  if (existingAdmin) {
    console.log(`\n  ⚠  Admin user ${ADMIN_EMAIL} already exists — leaving password unchanged.`);
  } else {
    const adminId = await nextId("users");
    await UserModel.create({
      id: adminId,
      openId: `local:${ADMIN_EMAIL}`,
      name: "Administrator",
      email: ADMIN_EMAIL,
      passwordHash: hashPassword(ADMIN_PASSWORD),
      loginMethod: "password",
      role: "admin",
      lastSignedIn: new Date(),
    });
    console.log(`\n  ✓  Admin user created — ${ADMIN_EMAIL}`);
  }

  const existing = await CompanyModel.findOne({ slug: "rad-technologies" }).lean();
  if (existing) {
    console.log(`\n⚠️   Company "rad-technologies" already exists (id: ${existing.id}). Skipping org seed.`);
    printCredentials();
    await mongoose.disconnect();
    return;
  }

  // ─── 1. Company ──────────────────────────────────────────────────────────
  const companyId = await createWithId(CompanyModel, "companies", {
    name: "Rad Technologies",
    slug: "rad-technologies",
    industry: "Technology",
    country: "AE",
    currency: "AED",
    timezone: "Asia/Dubai",
    isActive: true,
  });
  console.log(`\n  ✓  Company — Rad Technologies (id: ${companyId})`);

  // ─── 2. Locations ────────────────────────────────────────────────────────
  const locations = [
    { name: "Dubai HQ", code: "DXB-HQ", city: "Dubai", country: "AE" },
    { name: "Abu Dhabi Office", code: "AUH-01", city: "Abu Dhabi", country: "AE" },
  ];
  const locationIds = {};
  for (const loc of locations) {
    locationIds[loc.code] = await createWithId(LocationModel, "locations", {
      companyId,
      ...loc,
      isActive: true,
      geoFenceRadius: 200,
    });
    console.log(`  ✓  Location — ${loc.name}`);
  }

  // ─── 3. Departments ──────────────────────────────────────────────────────
  const departments = [
    { name: "Engineering", code: "ENG" },
    { name: "Human Resources", code: "HR" },
    { name: "Finance", code: "FIN" },
    { name: "Operations", code: "OPS" },
    { name: "Sales & Marketing", code: "SALES" },
  ];
  const deptIds = {};
  for (const dept of departments) {
    deptIds[dept.code] = await createWithId(DepartmentModel, "departments", {
      companyId,
      ...dept,
      isActive: true,
    });
    console.log(`  ✓  Department — ${dept.name}`);
  }

  // ─── 4. Designations ─────────────────────────────────────────────────────
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
    desigIds[desig.name] = await createWithId(DesignationModel, "designations", {
      companyId,
      ...desig,
      isActive: true,
    });
    console.log(`  ✓  Designation — ${desig.name}`);
  }

  // ─── 5. Leave Types ──────────────────────────────────────────────────────
  const leaveTypes = [
    { name: "Annual Leave", code: "AL", isPaid: true, colorCode: "#6366f1" },
    { name: "Sick Leave", code: "SL", isPaid: true, colorCode: "#ef4444" },
    { name: "Casual Leave", code: "CL", isPaid: true, colorCode: "#f59e0b" },
    { name: "Maternity Leave", code: "ML", isPaid: true, applicableGender: "female", colorCode: "#ec4899" },
    { name: "Unpaid Leave", code: "UL", isPaid: false, colorCode: "#6b7280" },
  ];
  for (const lt of leaveTypes) {
    await createWithId(LeaveTypeModel, "leaveTypes", {
      companyId,
      ...lt,
      requiresApproval: true,
      isActive: true,
    });
    console.log(`  ✓  Leave Type — ${lt.name}`);
  }

  // ─── 6. Sample Employees ─────────────────────────────────────────────────
  const employees = [
    { firstName: "Ayesha",  lastName: "Khan",    dept: "HR",    desig: "Manager",          loc: "DXB-HQ", gender: "female" },
    { firstName: "Bilal",   lastName: "Ahmed",   dept: "ENG",   desig: "Senior Engineer",  loc: "DXB-HQ", gender: "male" },
    { firstName: "Sara",    lastName: "Malik",   dept: "ENG",   desig: "Engineer",         loc: "DXB-HQ", gender: "female" },
    { firstName: "Omar",    lastName: "Farooq",  dept: "FIN",   desig: "Analyst",          loc: "AUH-01", gender: "male" },
    { firstName: "Hina",    lastName: "Raza",    dept: "OPS",   desig: "Associate",        loc: "AUH-01", gender: "female" },
    { firstName: "Zain",    lastName: "Sheikh",  dept: "SALES", desig: "Senior Manager",   loc: "DXB-HQ", gender: "male" },
  ];
  let empNum = 1001;
  for (const emp of employees) {
    await createWithId(EmployeeModel, "employees", {
      companyId,
      employeeNumber: `EMP-${empNum++}`,
      firstName: emp.firstName,
      lastName: emp.lastName,
      displayName: `${emp.firstName} ${emp.lastName}`,
      gender: emp.gender,
      workEmail: `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}@radtech.example`,
      departmentId: deptIds[emp.dept],
      designationId: desigIds[emp.desig],
      locationId: locationIds[emp.loc],
      joinDate: new Date("2024-01-15"),
      employmentType: "full_time",
      status: "active",
    });
    console.log(`  ✓  Employee — ${emp.firstName} ${emp.lastName}`);
  }

  console.log("\n✅  MongoDB foundation seed complete!");
  console.log("    Company id: 1  •  Employees: 6  •  Departments: 5  •  Leave types: 5");
  printCredentials();
  await mongoose.disconnect();
}

function printCredentials() {
  console.log("\n────────────────────────────────────────────");
  console.log("  ADMIN LOGIN CREDENTIALS");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log("  (Change the password after first login.)");
  console.log("────────────────────────────────────────────");
}

main().catch(async (err) => {
  console.error("\n❌  Seed failed:", err?.message || err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
