export { DB_MODE, supabase } from './client.js';
export { ensureDemoState, resetDemoDatabase } from './demo-state.js';
export { getCurrentAccess } from './repositories/access-repository.js';
export {
  getAllWards, getWardById, getWardByName, getOperatingPeriods, getWardsForDate,
  isWardOperational, getCapacityHistory, getWardCapacity, getCapacitiesForWards, createWard, updateWard, saveWardConfiguration, reorderWards,
  addOperatingPeriod, closeOperatingPeriod, addCapacity,
} from './repositories/ward-repository.js';
export { getWardStaff, getWardStaffForWards, saveWardStaff, setStaffActive } from './repositories/staff-repository.js';
export { getReportItems, saveReportItem, reorderReportItems } from './repositories/report-item-repository.js';
export { getRecentReports, getPreviousReport } from './repositories/report-repository.js';
export { getAccounts, adminAccount } from './repositories/account-repository.js';
export { getAuditLog, recordAudit } from './repositories/audit-repository.js';
export { getNightMemoTemplateMetadata, getNightMemoVisualTemplate, publishNightMemoVisualTemplate } from './repositories/visual-template-repository.js';
export { getMaintenanceWardsSnapshot } from './repositories/bootstrap-repository.js';
export { importGeneratedDemoBatch, listGeneratedDemoBatches, deleteGeneratedDemoBatch } from './repositories/demo-data-repository.js';
export {
  getPatrolMemo,
  savePatrolMemoRecovery,
  savePatrolMemoRevision,
  listPatrolMemoRevisions,
  getPatrolMemoRevision,
  listPatrolMemoArchive,
  createPatrolMemoCheckpoint,
  listPatrolMemoCheckpoints,
  getPatrolMemoCheckpoint,
} from './repositories/patrol-memo-repository.js';
// PM and Night are the only supported reporting types.
export { getWardCycleReport, getCycleReports, submitWardCycleReport, getWardCycleDraft, saveWardCycleDraft, deleteWardCycleDraft } from './repositories/report-cycle-repository.js';
export { getPatrolDocxBytes, savePatrolDocxRecovery, savePatrolDocxRevision } from './repositories/patrol-memo-repository.js';
