import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createCompany,
  createDepartment,
  createDesignation,
  createLocation,
  getCompanies,
  getCompanyById,
  getDepartments,
  getDesignations,
  getLocations,
  updateCompany,
  updateDepartment,
  updateDesignation,
  updateLocation,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const orgRouter = router({
  // ─── Companies ─────────────────────────────────────────────────────────────
  listCompanies: protectedProcedure.query(async () => {
    return getCompanies();
  }),

  getCompany: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const company = await getCompanyById(input.id);
      if (!company) throw new TRPCError({ code: "NOT_FOUND" });
      return company;
    }),

  createCompany: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
        industry: z.string().optional(),
        country: z.string().optional(),
        currency: z.string().optional(),
        timezone: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        website: z.string().url().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createCompany(input);
      return { success: true };
    }),

  updateCompany: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        industry: z.string().optional(),
        country: z.string().optional(),
        currency: z.string().optional(),
        timezone: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        website: z.string().url().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateCompany(id, data);
      return { success: true };
    }),

  // ─── Locations ─────────────────────────────────────────────────────────────
  listLocations: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return getLocations(input.companyId);
    }),

  createLocation: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        name: z.string().min(1),
        code: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        geoLat: z.string().optional(),
        geoLng: z.string().optional(),
        geoFenceRadius: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createLocation(input);
      return { success: true };
    }),

  updateLocation: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        companyId: z.number(),
        name: z.string().min(1).optional(),
        code: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, companyId, ...data } = input;
      await updateLocation(id, companyId, data);
      return { success: true };
    }),

  // ─── Departments ───────────────────────────────────────────────────────────
  listDepartments: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return getDepartments(input.companyId);
    }),

  createDepartment: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        locationId: z.number().optional(),
        parentId: z.number().optional(),
        name: z.string().min(1),
        code: z.string().optional(),
        headEmployeeId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createDepartment(input);
      return { success: true };
    }),

  updateDepartment: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        companyId: z.number(),
        name: z.string().min(1).optional(),
        code: z.string().optional(),
        locationId: z.number().optional(),
        parentId: z.number().optional(),
        headEmployeeId: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, companyId, ...data } = input;
      await updateDepartment(id, companyId, data);
      return { success: true };
    }),

  // ─── Designations ──────────────────────────────────────────────────────────
  listDesignations: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return getDesignations(input.companyId);
    }),

  createDesignation: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        name: z.string().min(1),
        grade: z.string().optional(),
        level: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createDesignation(input);
      return { success: true };
    }),

  updateDesignation: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        companyId: z.number(),
        name: z.string().min(1).optional(),
        grade: z.string().optional(),
        level: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, companyId, ...data } = input;
      await updateDesignation(id, companyId, data);
      return { success: true };
    }),
});
