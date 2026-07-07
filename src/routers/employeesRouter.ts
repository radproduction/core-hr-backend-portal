import { z } from "zod";
import { permissionProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  createAuditLog,
  createBulkUploadJob,
  createEmployee,
  createEmployeeAsset,
  createEmployeeDocument,
  createEmployeeExit,
  createEmployeeTransfer,
  createEmploymentHistory,
  deleteEmployeeDocument,
  getAllAssets,
  getBulkUploadJobById,
  getBulkUploadJobs,
  getDepartments,
  getDesignations,
  getEmployeeAssets,
  getEmployeeById,
  getEmployeeDocuments,
  getEmployeeExits,
  getEmployeeReportData,
  getEmployeeTransfers,
  getEmployees,
  getEmploymentHistory,
  getExpiringDocuments,
  getTurnoverStats,
  getUpcomingAnniversaries,
  getUpcomingBirthdays,
  updateBulkUploadJob,
  updateEmployee,
  updateEmployeeAsset,
  updateEmployeeDocument,
  updateEmployeeExit,
  updateEmployeeTransfer,
} from "../mongoDb";

// ─── Employee CRUD ─────────────────────────────────────────────────────────────

const employeeCreateSchema = z.object({
  companyId: z.number(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  displayName: z.string().optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  dateOfBirth: z.date().optional(),
  nationalId: z.string().optional(),
  nationality: z.string().optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
  personalEmail: z.string().email().optional(),
  workEmail: z.string().email().optional(),
  personalPhone: z.string().optional(),
  workPhone: z.string().optional(),
  address: z.string().optional(),
  locationId: z.number().optional(),
  departmentId: z.number().optional(),
  designationId: z.number().optional(),
  hcmRoleId: z.number().optional(),
  reportsToId: z.number().optional(),
  joinDate: z.date().optional(),
  confirmationDate: z.date().optional(),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern", "probation"]).optional(),
  status: z.enum(["active", "inactive", "on_leave", "terminated", "resigned"]).optional(),
  photoUrl: z.string().optional(),
  employeeNumber: z.string().optional(),
  // Extended profile fields stored as part of the employee record
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIban: z.string().optional(),
  taxNumber: z.string().optional(),
  socialSecurityNumber: z.string().optional(),
});

export const employeesRouter = router({
  // ─── List & Get ─────────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      departmentId: z.number().optional(),
      locationId: z.number().optional(),
      status: z.string().optional(),
      employmentType: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      let rows = await getEmployees(input.companyId, {
        departmentId: input.departmentId,
        locationId: input.locationId,
        status: input.status,
      });
      // Data scope: employees see only their own record; department managers
      // see only their own department; everyone else sees the whole company.
      if (ctx.hcmRoleSlug === "employee") {
        rows = rows.filter(e => e.id === ctx.employeeId);
      } else if (ctx.hcmRoleSlug === "department_manager") {
        rows = rows.filter(e => e.departmentId === ctx.departmentId);
      }
      if (input.search) {
        const q = input.search.toLowerCase();
        return rows.filter(e =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.workEmail?.toLowerCase().includes(q) ||
          e.employeeNumber?.toLowerCase().includes(q)
        );
      }
      if (input.employmentType) {
        return rows.filter(e => e.employmentType === input.employmentType);
      }
      return rows;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const emp = await getEmployeeById(input.id, input.companyId);
      if (!emp) return undefined;
      // Enforce the same data scope on single-record reads.
      if (ctx.hcmRoleSlug === "employee" && emp.id !== ctx.employeeId) return undefined;
      if (ctx.hcmRoleSlug === "department_manager" && emp.departmentId !== ctx.departmentId) return undefined;
      return emp;
    }),

  // ─── Create ─────────────────────────────────────────────────────────────────
  create: permissionProcedure("employees", "create")
    .input(employeeCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await createEmployee({
        companyId: input.companyId,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: input.displayName ?? `${input.firstName} ${input.lastName}`,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth,
        nationalId: input.nationalId,
        nationality: input.nationality,
        maritalStatus: input.maritalStatus,
        personalEmail: input.personalEmail,
        workEmail: input.workEmail,
        personalPhone: input.personalPhone,
        workPhone: input.workPhone,
        address: input.address,
        locationId: input.locationId,
        departmentId: input.departmentId,
        designationId: input.designationId,
        hcmRoleId: input.hcmRoleId,
        reportsToId: input.reportsToId,
        joinDate: input.joinDate,
        confirmationDate: input.confirmationDate,
        employmentType: input.employmentType ?? "full_time",
        status: input.status ?? "active",
        photoUrl: input.photoUrl,
        employeeNumber: input.employeeNumber,
        createdBy: ctx.user?.id,
      });
      await createAuditLog({
        companyId: input.companyId,
        actorUserId: ctx.user?.id,
        actorName: ctx.user?.name ?? "System",
        action: "CREATE",
        module: "employees",
        entityType: "employee",
        entityLabel: `${input.firstName} ${input.lastName}`,
        after: input,
      });
      return result;
    }),

  // ─── Update ─────────────────────────────────────────────────────────────────
  update: permissionProcedure("employees", "edit")
    .input(z.object({
      id: z.number(),
      companyId: z.number(),
      data: employeeCreateSchema.partial(),
    }))
    .mutation(async ({ input, ctx }) => {
      const before = await getEmployeeById(input.id, input.companyId);
      await updateEmployee(input.id, input.companyId, input.data as Parameters<typeof updateEmployee>[2]);
      await createAuditLog({
        companyId: input.companyId,
        actorUserId: ctx.user?.id,
        actorName: ctx.user?.name ?? "System",
        action: "UPDATE",
        module: "employees",
        entityType: "employee",
        entityId: input.id,
        entityLabel: before ? `${before.firstName} ${before.lastName}` : String(input.id),
        before,
        after: input.data,
      });
      return { success: true };
    }),

  // ─── Status Change ───────────────────────────────────────────────────────────
  changeStatus: permissionProcedure("employees", "delete")
    .input(z.object({
      id: z.number(),
      companyId: z.number(),
      status: z.enum(["active", "inactive", "on_leave", "terminated", "resigned"]),
    }))
    .mutation(async ({ input, ctx }) => {
      await updateEmployee(input.id, input.companyId, { status: input.status });
      await createAuditLog({
        companyId: input.companyId,
        actorUserId: ctx.user?.id,
        actorName: ctx.user?.name ?? "System",
        action: "STATUS_CHANGE",
        module: "employees",
        entityType: "employee",
        entityId: input.id,
        after: { status: input.status },
      });
      return { success: true };
    }),

  // ─── Documents ───────────────────────────────────────────────────────────────
  documents: router({
    list: protectedProcedure
      .input(z.object({ employeeId: z.number(), companyId: z.number() }))
      .query(({ input }) => getEmployeeDocuments(input.employeeId, input.companyId)),

    create: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        employeeId: z.number(),
        documentType: z.enum([
          "passport", "national_id", "visa", "work_permit", "driving_license",
          "degree", "certificate", "contract", "nda", "offer_letter",
          "appraisal", "warning_letter", "other",
        ]),
        title: z.string().min(1),
        fileKey: z.string(),
        fileUrl: z.string(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        expiryDate: z.date().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return createEmployeeDocument({
          ...input,
          uploadedBy: ctx.user?.id ?? 0,
        });
      }),

    verify: protectedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await updateEmployeeDocument(input.id, input.companyId, {
          isVerified: true,
          verifiedBy: ctx.user?.id,
          verifiedAt: new Date(),
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteEmployeeDocument(input.id, input.companyId);
        return { success: true };
      }),

    expiring: protectedProcedure
      .input(z.object({ companyId: z.number(), daysAhead: z.number().default(30) }))
      .query(({ input }) => getExpiringDocuments(input.companyId, input.daysAhead)),
  }),

  // ─── Assets ──────────────────────────────────────────────────────────────────
  assets: router({
    listByEmployee: protectedProcedure
      .input(z.object({ employeeId: z.number(), companyId: z.number() }))
      .query(({ input }) => getEmployeeAssets(input.employeeId, input.companyId)),

    listAll: protectedProcedure
      .input(z.object({ companyId: z.number(), status: z.string().optional() }))
      .query(({ input }) => getAllAssets(input.companyId, input.status)),

    assign: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        employeeId: z.number(),
        assetName: z.string().min(1),
        assetType: z.enum(["laptop", "mobile", "tablet", "vehicle", "access_card", "uniform", "tools", "other"]),
        serialNumber: z.string().optional(),
        assetTag: z.string().optional(),
        assignedDate: z.date(),
        condition: z.enum(["new", "good", "fair", "damaged", "lost"]).default("good"),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return createEmployeeAsset({
          ...input,
          status: "assigned",
          assignedBy: ctx.user?.id ?? 0,
        });
      }),

    return: protectedProcedure
      .input(z.object({
        id: z.number(),
        companyId: z.number(),
        conditionOnReturn: z.enum(["new", "good", "fair", "damaged", "lost"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateEmployeeAsset(input.id, input.companyId, {
          status: "returned",
          returnDate: new Date(),
          conditionOnReturn: input.conditionOnReturn,
          notes: input.notes,
        });
        return { success: true };
      }),
  }),

  // ─── Bulk Upload ─────────────────────────────────────────────────────────────
  bulkUpload: router({
    jobs: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(({ input }) => getBulkUploadJobs(input.companyId)),

    getJob: protectedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .query(({ input }) => getBulkUploadJobById(input.id, input.companyId)),

    process: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        fileName: z.string(),
        rows: z.array(z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          workEmail: z.string().optional(),
          employeeNumber: z.string().optional(),
          departmentId: z.number().optional(),
          designationId: z.number().optional(),
          locationId: z.number().optional(),
          joinDate: z.string().optional(),
          employmentType: z.string().optional(),
          status: z.string().optional(),
          gender: z.string().optional(),
          personalPhone: z.string().optional(),
          nationality: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const jobResult = await createBulkUploadJob({
          companyId: input.companyId,
          uploadedBy: ctx.user?.id ?? 0,
          fileName: input.fileName,
          totalRows: input.rows.length,
          status: "processing",
        });

        const errors: Array<{ row: number; field: string; message: string }> = [];
        let successCount = 0;

        for (let i = 0; i < input.rows.length; i++) {
          const row = input.rows[i];
          const rowNum = i + 2; // 1-indexed + header row

          // Validate required fields
          if (!row.firstName?.trim()) {
            errors.push({ row: rowNum, field: "firstName", message: "First name is required" });
            continue;
          }
          if (!row.lastName?.trim()) {
            errors.push({ row: rowNum, field: "lastName", message: "Last name is required" });
            continue;
          }
          if (row.workEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.workEmail)) {
            errors.push({ row: rowNum, field: "workEmail", message: "Invalid email format" });
            continue;
          }

          const validStatuses = ["active", "inactive", "on_leave", "terminated", "resigned"];
          const validEmpTypes = ["full_time", "part_time", "contract", "intern", "probation"];

          try {
            await createEmployee({
              companyId: input.companyId,
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              displayName: `${row.firstName.trim()} ${row.lastName.trim()}`,
              workEmail: row.workEmail?.trim(),
              employeeNumber: row.employeeNumber?.trim(),
              departmentId: row.departmentId,
              designationId: row.designationId,
              locationId: row.locationId,
              joinDate: row.joinDate ? new Date(row.joinDate) : undefined,
              employmentType: validEmpTypes.includes(row.employmentType ?? "") ? row.employmentType as "full_time" | "part_time" | "contract" | "intern" | "probation" : "full_time",
              status: validStatuses.includes(row.status ?? "") ? row.status as "active" | "inactive" | "on_leave" | "terminated" | "resigned" : "active",
              gender: (["male", "female", "other", "prefer_not_to_say"] as const).includes(row.gender as "male") ? row.gender as "male" | "female" | "other" | "prefer_not_to_say" : undefined,
              personalPhone: row.personalPhone?.trim(),
              nationality: row.nationality?.trim(),
              createdBy: ctx.user?.id,
            });
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, field: "general", message: String(err) });
          }
        }

        // Get the job ID from the insert result
        const jobs = await getBulkUploadJobs(input.companyId, 1);
        const jobId = jobs[0]?.id;

        if (jobId) {
          await updateBulkUploadJob(jobId, {
            status: errors.length === input.rows.length ? "failed" : "completed",
            successRows: successCount,
            errorRows: errors.length,
            errorReport: errors,
            completedAt: new Date(),
          });
        }

        return {
          jobId,
          total: input.rows.length,
          success: successCount,
          errors: errors.length,
          errorReport: errors,
        };
      }),
  }),

  // ─── Transfers ───────────────────────────────────────────────────────────────
  transfers: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number(), employeeId: z.number().optional() }))
      .query(({ input }) => getEmployeeTransfers(input.companyId, input.employeeId)),

    create: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        employeeId: z.number(),
        fromDepartmentId: z.number().optional(),
        toDepartmentId: z.number().optional(),
        fromLocationId: z.number().optional(),
        toLocationId: z.number().optional(),
        fromDesignationId: z.number().optional(),
        toDesignationId: z.number().optional(),
        fromReportsToId: z.number().optional(),
        toReportsToId: z.number().optional(),
        effectiveDate: z.date(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createEmployeeTransfer({
          ...input,
          status: "pending",
          requestedBy: ctx.user?.id ?? 0,
        });
        await createAuditLog({
          companyId: input.companyId,
          actorUserId: ctx.user?.id,
          actorName: ctx.user?.name ?? "System",
          action: "TRANSFER_REQUESTED",
          module: "employees",
          entityType: "employee_transfer",
          entityId: input.employeeId,
          after: input,
        });
        return result;
      }),

    approve: protectedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Fetch transfer to apply changes
        const transfers = await getEmployeeTransfers(input.companyId);
        const transfer = transfers.find(t => t.id === input.id);
        if (!transfer) throw new Error("Transfer not found");

        await updateEmployeeTransfer(input.id, input.companyId, {
          status: "executed",
          executedAt: new Date(),
        });

        // Apply the transfer to the employee record
        const updates: Record<string, unknown> = {};
        if (transfer.toDepartmentId) updates.departmentId = transfer.toDepartmentId;
        if (transfer.toLocationId) updates.locationId = transfer.toLocationId;
        if (transfer.toDesignationId) updates.designationId = transfer.toDesignationId;
        if (transfer.toReportsToId) updates.reportsToId = transfer.toReportsToId;

        if (Object.keys(updates).length > 0) {
          await updateEmployee(transfer.employeeId, input.companyId, updates as Parameters<typeof updateEmployee>[2]);
        }

        // Record in employment history
        await createEmploymentHistory({
          companyId: input.companyId,
          employeeId: transfer.employeeId,
          eventType: "transferred",
          description: `Transfer approved — effective ${transfer.effectiveDate.toLocaleDateString()}`,
          effectiveDate: transfer.effectiveDate,
          previousValue: {
            departmentId: transfer.fromDepartmentId,
            locationId: transfer.fromLocationId,
            designationId: transfer.fromDesignationId,
          },
          newValue: {
            departmentId: transfer.toDepartmentId,
            locationId: transfer.toLocationId,
            designationId: transfer.toDesignationId,
          },
          recordedBy: ctx.user?.id,
        });

        return { success: true };
      }),

    reject: protectedProcedure
      .input(z.object({ id: z.number(), companyId: z.number() }))
      .mutation(async ({ input }) => {
        await updateEmployeeTransfer(input.id, input.companyId, { status: "rejected" });
        return { success: true };
      }),
  }),

  // ─── Exits ───────────────────────────────────────────────────────────────────
  exits: router({
    list: protectedProcedure
      .input(z.object({ companyId: z.number(), employeeId: z.number().optional() }))
      .query(({ input }) => getEmployeeExits(input.companyId, input.employeeId)),

    initiate: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        employeeId: z.number(),
        exitType: z.enum(["resignation", "termination", "retirement", "end_of_contract", "redundancy", "death", "absconding"]),
        lastWorkingDay: z.date(),
        noticeDate: z.date().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createEmployeeExit({
          ...input,
          status: "initiated",
          initiatedBy: ctx.user?.id ?? 0,
        });
        // Mark employee status as inactive pending clearance
        await updateEmployee(input.employeeId, input.companyId, { status: "inactive" });
        await createAuditLog({
          companyId: input.companyId,
          actorUserId: ctx.user?.id,
          actorName: ctx.user?.name ?? "System",
          action: "EXIT_INITIATED",
          module: "employees",
          entityType: "employee_exit",
          entityId: input.employeeId,
          after: input,
        });
        return result;
      }),

    updateChecklist: protectedProcedure
      .input(z.object({
        id: z.number(),
        companyId: z.number(),
        checklistAssetsReturned: z.boolean().optional(),
        checklistAccessRevoked: z.boolean().optional(),
        checklistDocumentsHandedOver: z.boolean().optional(),
        checklistFinancialClearance: z.boolean().optional(),
        checklistExitInterviewDone: z.boolean().optional(),
        exitInterviewNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, companyId, ...updates } = input;
        await updateEmployeeExit(id, companyId, updates);
        return { success: true };
      }),

    complete: protectedProcedure
      .input(z.object({ id: z.number(), companyId: z.number(), employeeId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await updateEmployeeExit(input.id, input.companyId, {
          status: "completed",
          completedAt: new Date(),
        });
        await updateEmployee(input.employeeId, input.companyId, { status: "resigned" });
        await createEmploymentHistory({
          companyId: input.companyId,
          employeeId: input.employeeId,
          eventType: "exited",
          description: "Exit process completed",
          effectiveDate: new Date(),
          recordedBy: ctx.user?.id,
        });
        return { success: true };
      }),
  }),

  // ─── Employment History ───────────────────────────────────────────────────────
  history: protectedProcedure
    .input(z.object({ employeeId: z.number(), companyId: z.number() }))
    .query(({ input }) => getEmploymentHistory(input.employeeId, input.companyId)),

  // ─── Reports ─────────────────────────────────────────────────────────────────
  reports: router({
    headcount: protectedProcedure
      .input(z.object({
        companyId: z.number(),
        departmentId: z.number().optional(),
        locationId: z.number().optional(),
        status: z.string().optional(),
        employmentType: z.string().optional(),
      }))
      .query(({ input }) => getEmployeeReportData(input.companyId, input)),

    turnover: protectedProcedure
      .input(z.object({ companyId: z.number(), year: z.number().default(new Date().getFullYear()) }))
      .query(({ input }) => getTurnoverStats(input.companyId, input.year)),

    birthdays: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const emps = await getUpcomingBirthdays(input.companyId);
        const today = new Date();
        return emps
          .filter(e => e.dateOfBirth)
          .map(e => {
            const dob = e.dateOfBirth!;
            const nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
            if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
            const daysUntil = Math.ceil((nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return { ...e, daysUntilBirthday: daysUntil, nextBirthday };
          })
          .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday)
          .slice(0, 20);
      }),

    anniversaries: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const emps = await getUpcomingAnniversaries(input.companyId);
        const today = new Date();
        return emps
          .filter(e => e.joinDate)
          .map(e => {
            const join = e.joinDate!;
            const nextAnniversary = new Date(today.getFullYear(), join.getMonth(), join.getDate());
            if (nextAnniversary < today) nextAnniversary.setFullYear(today.getFullYear() + 1);
            const daysUntil = Math.ceil((nextAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const yearsOfService = today.getFullYear() - join.getFullYear();
            return { ...e, daysUntilAnniversary: daysUntil, nextAnniversary, yearsOfService };
          })
          .sort((a, b) => a.daysUntilAnniversary - b.daysUntilAnniversary)
          .slice(0, 20);
      }),

    departmentMatrix: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const [emps, depts] = await Promise.all([
          getEmployees(input.companyId),
          getDepartments(input.companyId),
        ]);
        return depts.map(dept => {
          const deptEmps = emps.filter(e => e.departmentId === dept.id);
          return {
            departmentId: dept.id,
            departmentName: dept.name,
            total: deptEmps.length,
            active: deptEmps.filter(e => e.status === "active").length,
            onLeave: deptEmps.filter(e => e.status === "on_leave").length,
            fullTime: deptEmps.filter(e => e.employmentType === "full_time").length,
            partTime: deptEmps.filter(e => e.employmentType === "part_time").length,
            contract: deptEmps.filter(e => e.employmentType === "contract").length,
            male: deptEmps.filter(e => e.gender === "male").length,
            female: deptEmps.filter(e => e.gender === "female").length,
          };
        });
      }),

    tenure: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const emps = await getEmployees(input.companyId, { status: "active" });
        const today = new Date();
        const buckets = { "< 1 year": 0, "1-2 years": 0, "2-5 years": 0, "5-10 years": 0, "10+ years": 0 };
        emps.forEach(e => {
          if (!e.joinDate) return;
          const years = (today.getTime() - e.joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
          if (years < 1) buckets["< 1 year"]++;
          else if (years < 2) buckets["1-2 years"]++;
          else if (years < 5) buckets["2-5 years"]++;
          else if (years < 10) buckets["5-10 years"]++;
          else buckets["10+ years"]++;
        });
        return Object.entries(buckets).map(([range, count]) => ({ range, count }));
      }),
  }),

  // ─── AI Integrations ──────────────────────────────────────────────────────────
  ai: router({
    /** Parse a resume or ID document text and return a suggested employee profile */
    parseDocument: protectedProcedure
      .input(z.object({
        documentText: z.string().min(10),
        documentType: z.enum(["resume", "national_id", "passport", "other"]).default("resume"),
      }))
      .mutation(async ({ input }) => {
        const { parseDocumentToEmployeeProfile } = await import("../ai/employeeAI");
        return parseDocumentToEmployeeProfile(input.documentText, input.documentType);
      }),

    /** Answer a natural-language question about the workforce and optionally return chart data */
    queryWorkforce: protectedProcedure
      .input(z.object({
        question: z.string().min(3),
        companyId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { queryWorkforceNL } = await import("../ai/employeeAI");
        return queryWorkforceNL(input.question, input.companyId);
      }),

    /** Compute attrition risk for a single employee */
    attritionRisk: protectedProcedure
      .input(z.object({
        employeeId: z.number(),
        companyId: z.number(),
      }))
      .query(async ({ input }) => {
        const { computeAttritionRisk } = await import("../ai/employeeAI");
        return computeAttritionRisk(input.employeeId, input.companyId);
      }),

    /** Compute attrition risk for all active employees in a company */
    batchAttritionRisk: protectedProcedure
      .input(z.object({ companyId: z.number() }))
      .query(async ({ input }) => {
        const { computeBatchAttritionRisk } = await import("../ai/employeeAI");
        return computeBatchAttritionRisk(input.companyId);
      }),
  }),
});
