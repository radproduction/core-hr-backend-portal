/**
 * CORE HR — Extended Demo Seed (batch version)
 * Adds: payroll runs + payslips (3 months), expense claims, appraisal KPI scores, extra leaves, extra candidates
 * Run AFTER seed-demo.mjs: pnpm seed:extended
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

const connection = await mysql.createConnection(DB_URL);

function toFixed2(n) { return parseFloat(n.toFixed(2)); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── Lookup existing data ─────────────────────────────────────────────────────
const [[companyRow]] = await connection.execute(
  `SELECT id FROM companies WHERE slug = 'rad-technologies' LIMIT 1`
);
if (!companyRow) throw new Error("Company not found — run seed-demo.mjs first");
const companyId = companyRow.id;

const [empRows] = await connection.execute(
  `SELECT id FROM employees WHERE companyId = ? ORDER BY id LIMIT 25`, [companyId]
);
if (empRows.length === 0) throw new Error("No employees found — run seed-demo.mjs first");
const empIds = empRows.map(r => r.id);

// Salary map: use basicSalary from assignments
const [assignRows] = await connection.execute(
  `SELECT esa.employeeId, esa.basicSalary
   FROM employeeSalaryAssignments esa
   JOIN salaryStructures ss ON ss.id = esa.structureId
   WHERE ss.companyId = ?`, [companyId]
);
const empSalaryMap = {};
for (const row of assignRows) {
  empSalaryMap[row.employeeId] = toFixed2(parseFloat(row.basicSalary) / 0.6);
}
for (const id of empIds) { if (!empSalaryMap[id]) empSalaryMap[id] = 12000; }

const [[ownerRow]] = await connection.execute(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
const ownerId = ownerRow?.id ?? 1;

console.log("\n════════════════════════════════════════════════════════════");
console.log("🌱  CORE HR Extended Demo Seed (batch mode)");
console.log(`   Company: ${companyId} | Employees: ${empIds.length}`);
console.log("════════════════════════════════════════════════════════════\n");

// ─── PAYROLL RUNS + PAYSLIPS (batch) ─────────────────────────────────────────
console.log("💰  Payroll Runs & Payslips...");

const payrollMonths = [
  { month: 2, year: 2025, status: "disbursed" },
  { month: 3, year: 2025, status: "disbursed" },
  { month: 4, year: 2025, status: "approved"  },
];

for (const pm of payrollMonths) {
  // Calculate totals
  let totalGross = 0, totalNet = 0, totalDed = 0;
  for (const id of empIds) {
    const g = empSalaryMap[id]; totalGross += g;
    totalDed += toFixed2(g * 0.05); totalNet += toFixed2(g - g * 0.05);
  }

  const approvedAt = pm.status !== "draft"
    ? `${pm.year}-${String(pm.month).padStart(2,"0")}-28 00:00:00` : null;

  await connection.execute(
    `INSERT IGNORE INTO payrollRuns
      (companyId, month, year, currency, scope, status, runBy, approvedBy, approvedAt,
       totalGross, totalDeductions, totalNet, employeeCount, createdAt, updatedAt)
     VALUES (?, ?, ?, 'AED', 'all', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [companyId, pm.month, pm.year, pm.status, ownerId,
     pm.status !== "draft" ? ownerId : null, approvedAt,
     toFixed2(totalGross), toFixed2(totalDed), toFixed2(totalNet), empIds.length]
  );

  const [[runRow]] = await connection.execute(
    `SELECT id FROM payrollRuns WHERE companyId=? AND month=? AND year=? LIMIT 1`,
    [companyId, pm.month, pm.year]
  );
  const runId = runRow?.id;
  if (!runId) continue;

  // Batch insert all payslips for this month
  const payslipValues = [];
  const payslipParams = [];
  for (const empId of empIds) {
    const gross = empSalaryMap[empId];
    const basic = toFixed2(gross * 0.6);
    const housing = toFixed2(gross * 0.25);
    const transport = toFixed2(gross * 0.15);
    const lateDed = rand(0,1) === 0 ? toFixed2(rand(0,3) * 100) : 0;
    const totalDed = toFixed2(gross * 0.05) + lateDed;
    const net = toFixed2(gross - totalDed);
    const attDays = rand(20, 23);
    const absDays = rand(0, 2);
    const components = JSON.stringify([
      { code: "BASIC", name: "Basic Salary", type: "earning", amount: basic },
      { code: "HRA", name: "Housing Allowance", type: "earning", amount: housing },
      { code: "TRANS", name: "Transport Allowance", type: "earning", amount: transport },
      { code: "LATE", name: "Late Deduction", type: "deduction", amount: lateDed },
    ]);
    const slipStatus = pm.status === "disbursed" ? "disbursed" : "approved";
    payslipValues.push("(?,?,?,?,?,?,?,?,0,0,0,0,0,?,0,?,'AED',?,?,?,?,NOW(),NOW())");
    payslipParams.push(runId, empId, pm.month, pm.year, basic, gross, gross,
      totalDed, lateDed, net, attDays, absDays, components, slipStatus);
  }

  if (payslipValues.length > 0) {
    await connection.execute(
      `INSERT IGNORE INTO payslips
        (payrollRunId, employeeId, month, year, basicSalary, grossSalary, totalEarnings,
         totalDeductions, taxAmount, pfEmployee, pfEmployer, loanDeductions, advanceDeductions,
         lateDeductions, absentDeductions, netSalary, currency, attendanceDays, absentDays,
         components, status, createdAt, updatedAt)
       VALUES ${payslipValues.join(",")}`,
      payslipParams
    );
  }
  console.log(`  ✓  Payroll ${pm.month}/${pm.year} — ${empIds.length} payslips`);
}

// ─── EXPENSE CLAIMS (batch) ───────────────────────────────────────────────────
console.log("\n📋  Expense Claims...");

const expenseData = [
  { empIdx:0,  title:"Client dinner — Dubai Marina",       cat:"client_entertainment", amount:850,  status:"paid",      daysAgo:45 },
  { empIdx:1,  title:"Flight to Abu Dhabi — Tech Summit",  cat:"travel",               amount:420,  status:"approved",  daysAgo:30 },
  { empIdx:2,  title:"Hotel — Abu Dhabi 2 nights",         cat:"accommodation",         amount:1200, status:"approved",  daysAgo:29 },
  { empIdx:3,  title:"Team lunch — Q2 kickoff",            cat:"meals",                 amount:650,  status:"paid",      daysAgo:60 },
  { empIdx:4,  title:"Uber — client meetings (May)",       cat:"transport",             amount:280,  status:"submitted", daysAgo:5  },
  { empIdx:5,  title:"AWS certification course",           cat:"training",              amount:1500, status:"submitted", daysAgo:3  },
  { empIdx:6,  title:"Office stationery & supplies",       cat:"office_supplies",       amount:175,  status:"paid",      daysAgo:55 },
  { empIdx:7,  title:"Doctor visit — work injury",         cat:"medical",               amount:320,  status:"approved",  daysAgo:20 },
  { empIdx:8,  title:"Taxi — airport pickup for client",   cat:"transport",             amount:95,   status:"submitted", daysAgo:2  },
  { empIdx:9,  title:"Sales conference registration",      cat:"training",              amount:2200, status:"rejected",  daysAgo:40, rejectedReason:"Budget exceeded for Q2 training" },
  { empIdx:10, title:"Lunch with investor",                cat:"client_entertainment",  amount:1100, status:"paid",      daysAgo:50 },
  { empIdx:11, title:"Printer cartridges",                 cat:"office_supplies",       amount:220,  status:"approved",  daysAgo:15 },
  { empIdx:12, title:"Sharjah branch visit — petrol",      cat:"transport",             amount:130,  status:"submitted", daysAgo:1  },
  { empIdx:13, title:"Team dinner — project delivery",     cat:"meals",                 amount:780,  status:"paid",      daysAgo:35 },
  { empIdx:14, title:"HR conference — registration fee",   cat:"training",              amount:950,  status:"approved",  daysAgo:25 },
  { empIdx:0,  title:"Laptop bag & accessories",           cat:"office_supplies",       amount:340,  status:"submitted", daysAgo:4  },
  { empIdx:2,  title:"Client entertainment — golf day",    cat:"client_entertainment",  amount:1800, status:"rejected",  daysAgo:18, rejectedReason:"Requires VP approval for amounts over AED 1,500" },
  { empIdx:5,  title:"Uber — daily commute (Apr)",         cat:"transport",             amount:460,  status:"paid",      daysAgo:42 },
  { empIdx:8,  title:"Team breakfast — sprint planning",   cat:"meals",                 amount:310,  status:"approved",  daysAgo:10 },
  { empIdx:15, title:"Medical checkup — annual",           cat:"medical",               amount:580,  status:"paid",      daysAgo:65 },
];

const expValues = [];
const expParams = [];
for (const exp of expenseData) {
  const empId = empIds[exp.empIdx];
  if (!empId) continue;
  const d = new Date(); d.setDate(d.getDate() - exp.daysAgo);
  const ds = d.toISOString().slice(0,19).replace("T"," ");
  const submittedAt = ["submitted","approved","rejected","paid"].includes(exp.status) ? ds : null;
  const approvedAt  = ["approved","paid"].includes(exp.status) ? ds : null;
  const paidAt      = exp.status === "paid" ? ds : null;
  // columns: companyId, employeeId, title, category, amount, currency, expenseDate,
  //           description, receiptUrl, receiptKey, status, submittedAt, approvedBy, approvedAt, rejectedReason, paidAt, payrollRunId, createdAt, updatedAt
  expValues.push("(?,?,?,?,?,'AED',?,?,NULL,NULL,?,?,?,?,?,?,NULL,NOW(),NOW())");
  expParams.push(
    companyId, empId, exp.title, exp.cat, exp.amount, ds,
    `Expense claim for ${exp.cat.replace(/_/g," ")}`,
    exp.status, submittedAt,
    ["approved","paid"].includes(exp.status) ? ownerId : null,
    approvedAt, exp.rejectedReason ?? null, paidAt
  );
}

if (expValues.length > 0) {
  await connection.execute(
    `INSERT IGNORE INTO expenseClaims
      (companyId, employeeId, title, category, amount, currency, expenseDate,
       description, receiptUrl, receiptKey, status, submittedAt, approvedBy, approvedAt, rejectedReason, paidAt, payrollRunId, createdAt, updatedAt)
     VALUES ${expValues.join(",")}`,
    expParams
  );
  console.log(`  ✓  ${expValues.length} expense claims inserted`);
}

// ─── APPRAISAL KPI SCORES (batch) ─────────────────────────────────────────────
console.log("\n🎯  Appraisal KPI Scores...");
const [[cycleRow]] = await connection.execute(
  `SELECT id FROM appraisalCycles WHERE companyId=? AND name='Annual Performance Review 2025' LIMIT 1`,
  [companyId]
);

if (cycleRow) {
  const cycleId = cycleRow.id;
  const [participants] = await connection.execute(
    `SELECT id FROM cycleParticipants WHERE cycleId=? LIMIT 8`, [cycleId]
  );
  const [kpiDefs] = await connection.execute(
    `SELECT id, defaultTarget FROM kpiDefinitions WHERE companyId=? LIMIT 5`, [companyId]
  );

  const kpiValues = [];
  const kpiParams = [];
  for (const p of participants) {
    for (const kpi of kpiDefs) {
      const target = parseFloat(kpi.defaultTarget) || 90;
      const actual = toFixed2(target * (0.75 + Math.random() * 0.35));
      const score  = toFixed2(Math.min(100, (actual / target) * 100));
      kpiValues.push("(?,?,?,?,?,25,NOW())");
      kpiParams.push(p.id, kpi.id, String(target), String(actual), score);
    }
  }
  if (kpiValues.length > 0) {
    await connection.execute(
      `INSERT IGNORE INTO participantKpis
        (participantId, kpiDefinitionId, target, actual, score, weight, updatedAt)
       VALUES ${kpiValues.join(",")}`,
      kpiParams
    );
    console.log(`  ✓  ${kpiValues.length} KPI scores inserted`);
  }
} else {
  console.log("  ~  No appraisal cycle found — skipping");
}

// ─── ADDITIONAL LEAVE REQUESTS (batch) ───────────────────────────────────────
console.log("\n📅  Additional Leave Requests...");
const [[alRow]] = await connection.execute(
  `SELECT id FROM leaveTypes WHERE companyId=? AND code='AL' LIMIT 1`, [companyId]
);
const [[slRow]] = await connection.execute(
  `SELECT id FROM leaveTypes WHERE companyId=? AND code='SL' LIMIT 1`, [companyId]
);
const alId = alRow?.id, slId = slRow?.id;

const addLeaves = [
  { empIdx:16, typeId:alId, start:"2025-06-09", end:"2025-06-11", days:3, reason:"Family event",          status:"pending"  },
  { empIdx:17, typeId:slId, start:"2025-06-05", end:"2025-06-06", days:2, reason:"Back pain",             status:"approved" },
  { empIdx:18, typeId:alId, start:"2025-06-16", end:"2025-06-20", days:5, reason:"Summer vacation",       status:"pending"  },
  { empIdx:19, typeId:slId, start:"2025-06-03", end:"2025-06-03", days:1, reason:"Dental appointment",    status:"approved" },
  { empIdx:20, typeId:alId, start:"2025-06-23", end:"2025-06-25", days:3, reason:"Travel to home country",status:"pending"  },
  { empIdx:21, typeId:slId, start:"2025-06-10", end:"2025-06-11", days:2, reason:"Fever and cold",        status:"approved" },
  { empIdx:22, typeId:alId, start:"2025-07-01", end:"2025-07-05", days:5, reason:"Annual leave",          status:"pending"  },
  { empIdx:23, typeId:alId, start:"2025-06-30", end:"2025-07-02", days:3, reason:"Wedding",               status:"pending"  },
];

const lvValues = [], lvParams = [];
for (const lr of addLeaves) {
  const empId = empIds[lr.empIdx];
  if (!empId || !lr.typeId) continue;
  lvValues.push("(?,?,?,?,?,?,0,NULL,?,NULL,?,NULL,NULL,NULL,NULL,NOW(),NOW())");
  lvParams.push(companyId, empId, lr.typeId,
    lr.start+" 00:00:00", lr.end+" 00:00:00",
    lr.days, lr.reason, lr.status);
}
if (lvValues.length > 0) {
  await connection.execute(
    `INSERT IGNORE INTO leaveRequests
      (companyId, employeeId, leaveTypeId, startDate, endDate, days, isHalfDay, halfDayPeriod, reason, attachmentKey, status, approvedBy, approvedAt, rejectedReason, cancelledAt, appliedAt, updatedAt)
     VALUES ${lvValues.join(",")}`,
    lvParams
  );
  console.log(`  ✓  ${lvValues.length} additional leave requests inserted`);
}

// ─── ADDITIONAL CANDIDATES (batch) ────────────────────────────────────────────
console.log("\n👥  Additional Candidates...");
const [[jobRow]] = await connection.execute(
  `SELECT id FROM jobPostings WHERE companyId=? LIMIT 1`, [companyId]
);
if (jobRow) {
  const jobId = jobRow.id;
  // candidates table has no jobPostingId — link via applications table
  const cands = [
    ["Priya",   "Sharma",   "priya.sharma@email.com",   "+971501234567", "screening",  "active",   "linkedin"],
    ["Omar",    "Hassan",   "omar.hassan@email.com",    "+971502345678", "interview",  "active",   "referral"],
    ["Elena",   "Petrov",   "elena.petrov@email.com",   "+971503456789", "offer",      "active",   "website" ],
    ["James",   "Okonkwo",  "james.okonkwo@email.com",  "+971504567890", "applied",    "active",   "indeed"  ],
    ["Fatima",  "Al-Rashid","fatima.rashid@email.com",  "+971505678901", "technical",  "active",   "linkedin"],
    ["Carlos",  "Mendez",   "carlos.mendez@email.com",  "+971506789012", "rejected",   "rejected", "website" ],
    ["Aisha",   "Nkrumah",  "aisha.nkrumah@email.com",  "+971507890123", "hired",      "hired",    "referral"],
  ];
  let insertedCount = 0;
  for (const [fn, ln, email, phone, stage, appStatus, source] of cands) {
    // Insert candidate (ignore if email already exists)
    await connection.execute(
      `INSERT IGNORE INTO candidates
        (companyId, firstName, lastName, email, phone, source, status, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,NOW(),NOW())`,
      [companyId, fn, ln, email, phone, source, "active"]
    );
    const [[candRow]] = await connection.execute(
      `SELECT id FROM candidates WHERE companyId=? AND email=? LIMIT 1`, [companyId, email]
    );
    if (!candRow) continue;
    // Link to job via applications table
    await connection.execute(
      `INSERT IGNORE INTO applications
        (companyId, jobPostingId, candidateId, stage, status, appliedAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,NOW(),NOW(),NOW())`,
      [companyId, jobId, candRow.id, stage, appStatus]
    );
    insertedCount++;
  }
  console.log(`  ✓  ${insertedCount} additional candidates + applications inserted`);
}

// ─── Done ──────────────────────────────────────────────────────────────────────
console.log("\n════════════════════════════════════════════════════════════");
console.log("✅  CORE HR Extended Seed Complete!\n");
console.log("📊  Added:");
console.log(`   • 3 payroll runs (Feb–Apr 2025) + ${empIds.length * 3} payslips`);
console.log(`   • ${expenseData.length} expense claims (various statuses)`);
console.log(`   • Appraisal KPI scores for participants`);
console.log(`   • 8 additional leave requests`);
console.log(`   • 7 additional candidates`);
console.log("════════════════════════════════════════════════════════════\n");

await connection.end();
