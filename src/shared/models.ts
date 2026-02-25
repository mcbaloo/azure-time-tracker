/**
 * Time entry interface representing time logged on a work item
 * One entry per work item per user
 */
export interface TimeEntry {
    id: string;
    workItemId: number;
    workItemTitle?: string;
    workItemType?: string;
    projectId: string;
    projectName?: string;
    logs: TimeLog[]; // Array of daily logs
    description: string;
    userId: string;
    userName?: string;
    createdAt: string;
    updatedAt: string;
    auditLog: AuditLogEntry[];
}

/**
 * Represents a single log of hours for a specific date
 */
export interface TimeLog {
    date: string; // YYYY-MM-DD
    hours: number;
}

/**
 * Audit log entry for tracking changes
 */
export interface AuditLogEntry {
    timestamp: string;
    userId: string;
    userName: string;
    action: 'created' | 'updated';
    previousHours?: number;
    newHours: number;
    notes?: string;
}

/**
 * Extension settings/configuration
 */
export interface TimeTrackerSettings {
    hourIncrement: number; // Default 0.5 (30 min)
}

/**
 * Filter options for time reports
 */
export interface TimeReportFilter {
    projectId?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
    workItemType?: string;
    areaPath?: string;
    iterationPath?: string;
}

/**
 * Aggregated time data for reports
 */
export interface TimeReportSummary {
    totalHours: number;
    entriesCount: number;
    byUser: Record<string, number>;
    byWorkItemType: Record<string, number>;
    byWorkItem: Array<{
        workItemId: number;
        workItemTitle: string;
        totalHours: number;
    }>;
}

/**
 * Work item basic info
 */
export interface WorkItemInfo {
    id: number;
    title: string;
    type: string;
    state: string;
    assignedTo?: string;
    areaPath?: string;
    iterationPath?: string;
}
