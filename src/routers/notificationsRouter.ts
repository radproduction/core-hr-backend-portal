import { z } from "zod";
import {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const notificationsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        recipientEmployeeId: z.number(),
        companyId: z.number(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      return getNotifications(input.recipientEmployeeId, input.companyId, input.limit);
    }),

  unreadCount: protectedProcedure
    .input(z.object({ recipientEmployeeId: z.number(), companyId: z.number() }))
    .query(async ({ input }) => {
      const count = await getUnreadNotificationCount(input.recipientEmployeeId, input.companyId);
      return { count };
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number(), recipientEmployeeId: z.number() }))
    .mutation(async ({ input }) => {
      await markNotificationRead(input.id, input.recipientEmployeeId);
      return { success: true };
    }),

  markAllRead: protectedProcedure
    .input(z.object({ recipientEmployeeId: z.number(), companyId: z.number() }))
    .mutation(async ({ input }) => {
      await markAllNotificationsRead(input.recipientEmployeeId, input.companyId);
      return { success: true };
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        recipientEmployeeId: z.number(),
        title: z.string().min(1),
        body: z.string().optional(),
        type: z.enum(["workflow", "system", "reminder", "announcement"]).default("system"),
        referenceType: z.string().optional(),
        referenceId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createNotification(input);
      return { success: true };
    }),
});
