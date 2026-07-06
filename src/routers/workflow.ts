import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createNotification,
  createWorkflowInstance,
  createWorkflowInstanceStep,
  createWorkflowStep,
  createWorkflowTemplate,
  getWorkflowInstanceById,
  getWorkflowInstanceSteps,
  getWorkflowInstances,
  getWorkflowSteps,
  getWorkflowTemplates,
  getPendingApprovalsCount,
  updateWorkflowInstance,
  updateWorkflowInstanceStep,
} from "../mongoDb";
import { protectedProcedure, router } from "../_core/trpc";

export const workflowRouter = router({
  // ─── Templates ─────────────────────────────────────────────────────────────
  listTemplates: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return getWorkflowTemplates(input.companyId);
    }),

  createTemplate: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        name: z.string().min(1),
        requestType: z.string().min(1),
        description: z.string().optional(),
        steps: z.array(
          z.object({
            stepOrder: z.number(),
            stepName: z.string().min(1),
            approverType: z.enum(["role", "specific_employee", "reporting_manager", "department_head"]),
            approverRoleId: z.number().optional(),
            approverEmployeeId: z.number().optional(),
            isOptional: z.boolean().default(false),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { steps, ...templateData } = input;
      await createWorkflowTemplate({ ...templateData, createdBy: ctx.user?.id });

      // Re-fetch to get the ID
      const templates = await getWorkflowTemplates(input.companyId);
      const newTemplate = templates.find((template: any) => template.name === input.name && template.requestType === input.requestType);
      if (newTemplate) {
        for (const step of steps) {
          await createWorkflowStep({ ...step, templateId: newTemplate.id, companyId: input.companyId });
        }
      }
      return { success: true };
    }),

  getTemplateSteps: protectedProcedure
    .input(z.object({ templateId: z.number(), companyId: z.number() }))
    .query(async ({ input }) => {
      return getWorkflowSteps(input.templateId, input.companyId);
    }),

  // ─── Instances ─────────────────────────────────────────────────────────────
  listInstances: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        requestedBy: z.number().optional(),
        status: z.enum(["draft", "submitted", "pending", "approved", "rejected", "cancelled"]).optional(),
        requestType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { companyId, ...filters } = input;
      return getWorkflowInstances(companyId, filters);
    }),

  getInstance: protectedProcedure
    .input(z.object({ id: z.number(), companyId: z.number() }))
    .query(async ({ input }) => {
      const instance = await getWorkflowInstanceById(input.id, input.companyId);
      if (!instance) throw new TRPCError({ code: "NOT_FOUND" });
      const steps = await getWorkflowInstanceSteps(input.id, input.companyId);
      return { ...instance, steps };
    }),

  submitRequest: protectedProcedure
    .input(
      z.object({
        companyId: z.number(),
        templateId: z.number(),
        requestType: z.string(),
        requestedBy: z.number(),
        title: z.string().min(1),
        description: z.string().optional(),
        payload: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Create the instance
      await createWorkflowInstance({ ...input, status: "submitted", currentStepOrder: 1 });

      // Fetch the instance back to get its ID
      const instances = await getWorkflowInstances(input.companyId, { requestedBy: input.requestedBy });
      const newInstance = instances[0];
      if (!newInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Create instance steps from template
      const templateSteps = await getWorkflowSteps(input.templateId, input.companyId);
      for (const step of templateSteps) {
        await createWorkflowInstanceStep({
          instanceId: newInstance.id,
          companyId: input.companyId,
          stepOrder: step.stepOrder,
          stepName: step.stepName,
          assignedToRoleId: step.approverRoleId ?? undefined,
          assignedToEmployeeId: step.approverEmployeeId ?? undefined,
          status: step.stepOrder === 1 ? "pending" : "pending",
        });
      }

      // Update status to pending
      await updateWorkflowInstance(newInstance.id, input.companyId, { status: "pending" });

      return { success: true, instanceId: newInstance.id };
    }),

  actOnStep: protectedProcedure
    .input(
      z.object({
        instanceId: z.number(),
        stepId: z.number(),
        companyId: z.number(),
        action: z.enum(["approve", "reject"]),
        comment: z.string().optional(),
        actorEmployeeId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const instance = await getWorkflowInstanceById(input.instanceId, input.companyId);
      if (!instance) throw new TRPCError({ code: "NOT_FOUND" });
      if (instance.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Instance is not pending" });

      const stepStatus = input.action === "approve" ? "approved" : "rejected";
      await updateWorkflowInstanceStep(input.stepId, {
        status: stepStatus,
        actionBy: input.actorEmployeeId,
        comment: input.comment,
        actionAt: new Date(),
      });

      if (input.action === "reject") {
        // Reject the whole instance
        await updateWorkflowInstance(input.instanceId, input.companyId, {
          status: "rejected",
          resolvedAt: new Date(),
        });
        // Notify requester
        await createNotification({
          companyId: input.companyId,
          recipientEmployeeId: instance.requestedBy,
          title: `Request "${instance.title}" was rejected`,
          body: input.comment ?? "Your request has been rejected.",
          type: "workflow",
          referenceType: "workflow_instance",
          referenceId: instance.id,
        });
      } else {
        // Check if there's a next step
        const allSteps = await getWorkflowInstanceSteps(input.instanceId, input.companyId);
        const nextStep = allSteps.find(
          (step: any) => step.stepOrder === (instance.currentStepOrder ?? 1) + 1
        );
        if (nextStep) {
          await updateWorkflowInstance(input.instanceId, input.companyId, {
            currentStepOrder: nextStep.stepOrder,
          });
        } else {
          // All steps approved → fully approved
          await updateWorkflowInstance(input.instanceId, input.companyId, {
            status: "approved",
            resolvedAt: new Date(),
          });
          await createNotification({
            companyId: input.companyId,
            recipientEmployeeId: instance.requestedBy,
            title: `Request "${instance.title}" was approved`,
            body: "Your request has been fully approved.",
            type: "workflow",
            referenceType: "workflow_instance",
            referenceId: instance.id,
          });
        }
      }

      return { success: true };
    }),

  pendingCount: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return { count: await getPendingApprovalsCount(input.companyId) };
    }),
});
