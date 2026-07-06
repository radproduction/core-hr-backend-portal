import {
  adjustLeaveBalance,
  createAccrualLog,
  createCarryForwardLog,
  createCompensatoryLeave,
  createLeaveApproval,
  createLeavePolicy,
  createLeaveRequest,
  createLeaveType,
  deleteLeavePolicy,
  deleteLeaveType,
  getCompensatoryLeave,
  getLeaveBalance,
  getLeavePoliciesForType,
  getLeaveRequest,
  getLeaveType,
  getOverlappingLeaveRequests,
  getPendingApprovalsForApprover,
  listAccrualLogs,
  listCarryForwardLogs,
  listCompensatoryLeaves,
  listLeaveApprovals,
  listLeaveBalances,
  listLeavePolicies,
  listLeaveRequests,
  listLeaveTypes,
  updateCompensatoryLeave,
  updateLeaveApproval,
  updateLeavePolicy,
  updateLeaveRequest,
  updateLeaveType,
  upsertLeaveBalance,
} from "./mongoDb";

export {
  adjustLeaveBalance,
  createAccrualLog,
  createCarryForwardLog,
  createCompensatoryLeave,
  createLeaveApproval,
  createLeavePolicy,
  createLeaveRequest,
  createLeaveType,
  deleteLeavePolicy,
  deleteLeaveType,
  getCompensatoryLeave,
  getLeaveBalance,
  getLeavePoliciesForType,
  getLeaveRequest,
  getLeaveType,
  getOverlappingLeaveRequests,
  getPendingApprovalsForApprover,
  listAccrualLogs,
  listCarryForwardLogs,
  listCompensatoryLeaves,
  listLeaveApprovals,
  listLeaveBalances,
  listLeavePolicies,
  listLeaveRequests,
  listLeaveTypes,
  updateCompensatoryLeave,
  updateLeaveApproval,
  updateLeavePolicy,
  updateLeaveRequest,
  updateLeaveType,
  upsertLeaveBalance,
};

export function calculateProratedDays(
  annualEntitlement: number,
  joinDate: Date,
  year: number
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const effectiveStart = joinDate > yearStart ? joinDate : yearStart;
  const totalDaysInYear = 365;
  const remainingDays = Math.ceil((yearEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
  return Math.round((annualEntitlement * remainingDays) / totalDaysInYear * 2) / 2;
}

export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
