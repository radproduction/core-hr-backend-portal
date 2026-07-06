import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createExpenseClaim,
  getExpenseClaim,
  listExpenseClaims,
  updateExpenseClaim,
} from "../mongoDb";

const COMPANY_ID = 1;

export const expenseRouter = router({
  list: protectedProcedure
    .input(z.object({
      employeeId: z.number().optional(),
      status: z.string().optional(),
    }))
    .query(({ input }) => listExpenseClaims(COMPANY_ID, input)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getExpenseClaim(input.id, COMPANY_ID)),

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
    .mutation(async ({ input }) => ({
      id: await createExpenseClaim({
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
      }),
    })),

  submit: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const claim = await getExpenseClaim(input.id, COMPANY_ID);
      if (!claim) throw new Error("Expense claim not found");
      if (claim.status !== "draft") throw new Error("Only draft claims can be submitted");
      await updateExpenseClaim(input.id, COMPANY_ID, { status: "submitted", submittedAt: new Date() });
      return { success: true };
    }),

  approve: protectedProcedure
    .input(z.object({
      id: z.number(),
      approverId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const claim = await getExpenseClaim(input.id, COMPANY_ID);
      if (!claim) throw new Error("Expense claim not found");
      if (claim.status !== "submitted") throw new Error("Only submitted claims can be approved");
      await updateExpenseClaim(input.id, COMPANY_ID, {
        status: "approved",
        approvedBy: input.approverId,
        approvedAt: new Date(),
      });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({
      id: z.number(),
      approverId: z.number(),
      reason: z.string().min(1, "Rejection reason is required"),
    }))
    .mutation(async ({ input }) => {
      const claim = await getExpenseClaim(input.id, COMPANY_ID);
      if (!claim) throw new Error("Expense claim not found");
      if (claim.status !== "submitted") throw new Error("Only submitted claims can be rejected");
      await updateExpenseClaim(input.id, COMPANY_ID, {
        status: "rejected",
        approvedBy: input.approverId,
        approvedAt: new Date(),
        rejectedReason: input.reason,
      });
      return { success: true };
    }),

  markPaid: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const claim = await getExpenseClaim(input.id, COMPANY_ID);
      if (!claim || claim.status !== "approved") {
        return { success: true };
      }
      await updateExpenseClaim(input.id, COMPANY_ID, { status: "paid", paidAt: new Date() });
      return { success: true };
    }),

  pendingCount: protectedProcedure
    .query(async () => {
      const rows = await listExpenseClaims(COMPANY_ID, { status: "submitted" });
      return { count: rows.length };
    }),
});
