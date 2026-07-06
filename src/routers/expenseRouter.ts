/**
 * server/routers/expenseRouter.ts
 *
 * Expense Claims module — submit, approve, reject, list.
 * All AI suggestions are surfaced as human-reviewable recommendations;
 * no automated decisions are made about expense approval.
 */
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { expenseClaims, InsertExpenseClaim } from "../../drizzle/schema";

const COMPANY_ID = 1;

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function listExpenses(companyId: number, filters?: {
  employeeId?: number;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(expenseClaims.companyId, companyId)];
  if (filters?.employeeId) conditions.push(eq(expenseClaims.employeeId, filters.employeeId));
  if (filters?.status) {
    const statusVal = filters.status as "draft" | "submitted" | "approved" | "rejected" | "paid";
    conditions.push(eq(expenseClaims.status, statusVal));
  }
  return db
    .select()
    .from(expenseClaims)
    .where(and(...conditions))
    .orderBy(desc(expenseClaims.createdAt));
}

async function getExpense(id: number, companyId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(expenseClaims)
    .where(and(eq(expenseClaims.id, id), eq(expenseClaims.companyId, companyId)))
    .limit(1);
  return rows[0] ?? null;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const expenseRouter = router({
  /** List expense claims — optionally filtered by employee or status */
  list: protectedProcedure
    .input(z.object({
      employeeId: z.number().optional(),
      status: z.string().optional(),
    }))
    .query(({ input }) => listExpenses(COMPANY_ID, input)),

  /** Get a single expense claim */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getExpense(input.id, COMPANY_ID)),

  /** Create a new expense claim (draft) */
  create: protectedProcedure
    .input(z.object({
      employeeId: z.number(),
      title: z.string().min(1),
      category: z.enum(["travel", "accommodation", "meals", "transport", "office_supplies", "training", "client_entertainment", "medical", "other"]),
      amount: z.number().positive(),
      currency: z.string().default("AED"),
      expenseDate: z.date(),
      description: z.string().optional(),
      receiptUrl: z.string().optional(),
      receiptKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(expenseClaims).values({
        companyId: COMPANY_ID,
        employeeId: input.employeeId,
        title: input.title,
        category: input.category,
        amount: String(input.amount),
        currency: input.currency,
        expenseDate: input.expenseDate,
        description: input.description,
        receiptUrl: input.receiptUrl,
        receiptKey: input.receiptKey,
        status: "draft",
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  /**
   * Submit an expense claim for approval.
   * Transitions: draft → submitted
   */
  submit: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const claim = await getExpense(input.id, COMPANY_ID);
      if (!claim) throw new Error("Expense claim not found");
      if (claim.status !== "draft") throw new Error("Only draft claims can be submitted");
      await db
        .update(expenseClaims)
        .set({ status: "submitted", submittedAt: new Date() })
        .where(eq(expenseClaims.id, input.id));
      return { success: true };
    }),

  /**
   * Approve an expense claim.
   * Transitions: submitted → approved
   *
   * NOTE: This is a human action — the approver reviews the claim and
   * explicitly clicks Approve. No automated decision is made.
   */
  approve: protectedProcedure
    .input(z.object({
      id: z.number(),
      approverId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const claim = await getExpense(input.id, COMPANY_ID);
      if (!claim) throw new Error("Expense claim not found");
      if (claim.status !== "submitted") throw new Error("Only submitted claims can be approved");
      await db
        .update(expenseClaims)
        .set({
          status: "approved",
          approvedBy: input.approverId,
          approvedAt: new Date(),
        })
        .where(eq(expenseClaims.id, input.id));
      return { success: true };
    }),

  /**
   * Reject an expense claim with a mandatory reason.
   * Transitions: submitted → rejected
   *
   * NOTE: This is a human action — the approver explicitly provides a reason.
   * No automated rejection occurs.
   */
  reject: protectedProcedure
    .input(z.object({
      id: z.number(),
      approverId: z.number(),
      reason: z.string().min(1, "Rejection reason is required"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const claim = await getExpense(input.id, COMPANY_ID);
      if (!claim) throw new Error("Expense claim not found");
      if (claim.status !== "submitted") throw new Error("Only submitted claims can be rejected");
      await db
        .update(expenseClaims)
        .set({
          status: "rejected",
          approvedBy: input.approverId,
          approvedAt: new Date(),
          rejectedReason: input.reason,
        })
        .where(eq(expenseClaims.id, input.id));
      return { success: true };
    }),

  /** Mark an approved claim as paid */
  markPaid: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(expenseClaims)
        .set({ status: "paid", paidAt: new Date() })
        .where(and(eq(expenseClaims.id, input.id), eq(expenseClaims.status, "approved")));
      return { success: true };
    }),

  /** Pending approvals count */
  pendingCount: protectedProcedure
    .query(async () => {
      const rows = await listExpenses(COMPANY_ID, { status: "submitted" });
      return { count: rows.length };
    }),
});
