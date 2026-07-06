import { z } from "zod";
import {
  createEmployee,
  getEmployeeById,
  getEmployees,
  getHeadcountStats,
  updateEmployee,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const employeesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        departmentId: z.number().optional(),
        locationId: z.number().optional(),
        status: z.enum(["active", "inactive", "on_leave", "terminated", "resigned"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const { companyId, ...filters } = input;
      return getEmployees(companyId, filters);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .query(async ({ input }) => {
      return getEmployeeById(input.id, input.companyId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        displayName: z.string().optional(),
        workEmail: z.string().email().optional(),
        personalEmail: z.string().email().optional(),
        workPhone: z.string().optional(),
        personalPhone: z.string().optional(),
        gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
        nationalId: z.string().optional(),
        nationality: z.string().optional(),
        maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
        locationId: z.number().optional(),
        departmentId: z.number().optional(),
        designationId: z.number().optional(),
        hcmRoleId: z.number().optional(),
        reportsToId: z.number().optional(),
        employmentType: z.enum(["full_time", "part_time", "contract", "intern", "probation"]).optional(),
        joinDate: z.date().optional(),
        employeeNumber: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await createEmployee({
        ...input,
        status: "active",
        createdBy: ctx.user?.id,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        companyId: z.number(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        displayName: z.string().optional(),
        workEmail: z.string().email().optional(),
        personalEmail: z.string().email().optional(),
        workPhone: z.string().optional(),
        personalPhone: z.string().optional(),
        gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
        nationalId: z.string().optional(),
        nationality: z.string().optional(),
        maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
        locationId: z.number().optional(),
        departmentId: z.number().optional(),
        designationId: z.number().optional(),
        hcmRoleId: z.number().optional(),
        reportsToId: z.number().optional(),
        employmentType: z.enum(["full_time", "part_time", "contract", "intern", "probation"]).optional(),
        status: z.enum(["active", "inactive", "on_leave", "terminated", "resigned"]).optional(),
        joinDate: z.date().optional(),
        confirmationDate: z.date().optional(),
        address: z.string().optional(),
        photoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, companyId, ...data } = input;
      await updateEmployee(id, companyId, data);
      return { success: true };
    }),

  headcountStats: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return getHeadcountStats(input.companyId);
    }),
});
