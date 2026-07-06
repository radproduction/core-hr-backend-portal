import {
  bulkAssignRoster,
  clockIn,
  clockOut,
  createAnomalyFlag,
  createGeoFence,
  createOvertimeRequest,
  createPunchImportJob,
  deleteGeoFence,
  deleteShift,
  getAttendanceRecord,
  getAttendanceReportData,
  getAttendanceStatsByStatus,
  getGeoFenceViolations,
  getOvertimeSummary,
  getRosterForDateRange,
  getTodayAttendanceSummary,
  getTopLateEmployees,
  listAbsenteeismPredictions,
  listAnomalyFlags,
  listAttendanceRecords,
  listGeoFences,
  listOvertimeRequests,
  listPunchImportJobs,
  listShifts,
  reviewAnomalyFlag,
  updateAttendanceRecord,
  updateGeoFence,
  updateOvertimeRequest,
  updatePunchImportJob,
  updateShift,
  upsertAbsenteeismPrediction,
  upsertRosterEntry,
  createShift,
} from "./mongoDb";

export {
  bulkAssignRoster,
  clockIn,
  clockOut,
  createAnomalyFlag,
  createGeoFence,
  createOvertimeRequest,
  createPunchImportJob,
  deleteGeoFence,
  deleteShift,
  getAttendanceRecord,
  getAttendanceReportData,
  getAttendanceStatsByStatus,
  getGeoFenceViolations,
  getOvertimeSummary,
  getRosterForDateRange,
  getTodayAttendanceSummary,
  getTopLateEmployees,
  listAbsenteeismPredictions,
  listAnomalyFlags,
  listAttendanceRecords,
  listGeoFences,
  listOvertimeRequests,
  listPunchImportJobs,
  listShifts,
  reviewAnomalyFlag,
  updateAttendanceRecord,
  updateGeoFence,
  updateOvertimeRequest,
  updatePunchImportJob,
  updateShift,
  upsertAbsenteeismPrediction,
  upsertRosterEntry,
  createShift,
};

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkGeoFence(
  lat: number,
  lng: number,
  fence: { lat: string; lng: string; radiusMeters: number }
): "inside" | "outside" {
  const distance = haversineDistance(lat, lng, parseFloat(fence.lat), parseFloat(fence.lng));
  return distance <= fence.radiusMeters ? "inside" : "outside";
}
