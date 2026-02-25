import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IExtensionDataService, IExtensionDataManager } from "azure-devops-extension-api";
import { TimeEntry, TimeReportFilter, TimeReportSummary, TimeTrackerSettings, AuditLogEntry } from "./models";

const COLLECTION_NAME = "TimeEntries";
const SETTINGS_COLLECTION = "TimeTrackerSettings";
const SETTINGS_DOC_ID = "global-settings";

/**
 * Default settings
 */
const DEFAULT_SETTINGS: TimeTrackerSettings = {
    hourIncrement: 0.5 // 30 minutes
};

/**
 * Service for managing time entries using Azure DevOps Extension Data Service
 * Each work item has exactly ONE time entry per user
 */
export class TimeEntryService {
    private dataManager: IExtensionDataManager | null = null;

    /**
     * Initialize the data manager
     */
    private async getDataManager(): Promise<IExtensionDataManager> {
        if (this.dataManager) {
            return this.dataManager;
        }

        const accessToken = await SDK.getAccessToken();
        const extDataService = await SDK.getService<IExtensionDataService>(
            CommonServiceIds.ExtensionDataService
        );
        this.dataManager = await extDataService.getExtensionDataManager(
            SDK.getExtensionContext().id,
            accessToken
        );
        return this.dataManager;
    }

    /**
     * Generate a unique ID for a time entry based on work item and user
     */
    private generateId(workItemId: number, userId: string): string {
        return `time-entry-${workItemId}-${userId}`;
    }

    /**
     * Get settings
     */
    async getSettings(): Promise<TimeTrackerSettings> {
        const dataManager = await this.getDataManager();
        try {
            const settings = await dataManager.getDocument(SETTINGS_COLLECTION, SETTINGS_DOC_ID);
            return { ...DEFAULT_SETTINGS, ...settings };
        } catch {
            return DEFAULT_SETTINGS;
        }
    }

    /**
     * Save settings
     */
    async saveSettings(settings: Partial<TimeTrackerSettings>): Promise<TimeTrackerSettings> {
        const dataManager = await this.getDataManager();
        const currentSettings = await this.getSettings();
        const newSettings = { ...currentSettings, ...settings, id: SETTINGS_DOC_ID };
        await dataManager.setDocument(SETTINGS_COLLECTION, newSettings);
        return newSettings;
    }

    /**
     * Set or update time entry for a work item (upsert)
     * Each user can have one time entry per work item
     * @param entry The time entry data
     * @param comment Optional comment for the audit log (separate from description)
     */
    /**
     * Set or update time entry for a work item (append daily log)
     * Each user can have one time entry per work item, but multiple logs per day
     * @param entry The time entry data (must include logs: TimeLog[])
     * @param comment Optional comment for the audit log (separate from description)
     */
    async setTimeEntry(entry: Omit<TimeEntry, "id" | "createdAt" | "updatedAt" | "auditLog"> & { hours: number, date: string }, comment?: string): Promise<TimeEntry> {
        const dataManager = await this.getDataManager();
        const id = this.generateId(entry.workItemId, entry.userId);
        const now = new Date().toISOString();

        // Check if entry exists
        const existingEntry = await this.getTimeEntry(id);

        let logs = existingEntry?.logs ? [...existingEntry.logs] : [];
        // Find if there's already a log for this date
        const logIdx = logs.findIndex(l => l.date === entry.date);
        let previousHours = 0;
        if (logIdx >= 0) {
            previousHours = logs[logIdx].hours;
            logs[logIdx].hours = entry.hours; // Overwrite today's log
        } else {
            logs.push({ date: entry.date, hours: entry.hours });
        }

        // Create audit log entry
        const auditEntry: AuditLogEntry = {
            timestamp: now,
            userId: entry.userId,
            userName: entry.userName || entry.userId,
            action: existingEntry ? 'updated' : 'created',
            previousHours: previousHours,
            newHours: (logIdx >= 0 ? logs[logIdx].hours : entry.hours),
            notes: comment || undefined
        };

        // Preserve existing audit log and add new entry
        const auditLog = existingEntry?.auditLog || [];
        auditLog.push(auditEntry);

        // Preserve __etag for optimistic concurrency
        const existingEtag = existingEntry ? (existingEntry as any).__etag : undefined;

        const timeEntry: TimeEntry & { __etag?: number } = {
            ...entry,
            logs,
            id,
            createdAt: existingEntry?.createdAt || now,
            updatedAt: now,
            auditLog
        };

        // Include __etag if updating existing document
        if (existingEtag !== undefined) {
            timeEntry.__etag = existingEtag;
        }

        await dataManager.setDocument(COLLECTION_NAME, timeEntry);
        return timeEntry;
    }

    /**
     * Delete a time entry
     */
    async deleteTimeEntry(id: string): Promise<void> {
        const dataManager = await this.getDataManager();
        await dataManager.deleteDocument(COLLECTION_NAME, id);
    }

    /**
     * Get a single time entry by ID
     */
    async getTimeEntry(id: string): Promise<TimeEntry | null> {
        const dataManager = await this.getDataManager();
        try {
            const doc = await dataManager.getDocument(COLLECTION_NAME, id) as any;
            if (!doc) return null;
            // Backwards-compat: if legacy `hours` field exists but no `logs`, synthesize logs array for runtime
            if ((!doc.logs || !Array.isArray(doc.logs)) && (doc.hours !== undefined && doc.hours !== null)) {
                const dateSrc = (doc.updatedAt || doc.createdAt || new Date().toISOString()).slice(0, 10);
                doc.logs = [{ date: dateSrc, hours: Number(doc.hours) || 0 }];
            }
            // Normalize workItemId to number to avoid type mismatches when filtering
            if (doc.workItemId !== undefined && doc.workItemId !== null) {
                doc.workItemId = Number(doc.workItemId);
            }
            return doc as TimeEntry;
        } catch {
            return null;
        }
    }

    /**
     * Get time entry for a specific work item and user
     */
    async getTimeEntryForWorkItem(workItemId: number, userId: string): Promise<TimeEntry | null> {
        const id = this.generateId(workItemId, userId);
        return this.getTimeEntry(id);
    }

    /**
     * Get total hours for a work item (sum of all users)
     */
    async getTotalHoursForWorkItem(workItemId: number): Promise<number> {
        const entries = await this.getTimeEntriesForWorkItem(workItemId);
        return entries.reduce((sum, entry) => sum + (entry.logs ? entry.logs.reduce((s, l) => s + l.hours, 0) : 0), 0);
    }

    /**
     * Get all time entries for a specific work item
     */
    async getTimeEntriesForWorkItem(workItemId: number): Promise<TimeEntry[]> {
        const allEntries = await this.getAllTimeEntries();
        return allEntries.filter(entry => entry.workItemId === workItemId);
    }

    /**
     * Get all time entries
     */
    async getAllTimeEntries(): Promise<TimeEntry[]> {
        const dataManager = await this.getDataManager();
        try {
            const documents = await dataManager.getDocuments(COLLECTION_NAME) as any[];
            if (!documents || documents.length === 0) return [];
            // Backwards-compat: synthesize `logs` for documents that still have legacy `hours` field
            return documents.map(doc => {
                if ((!doc.logs || !Array.isArray(doc.logs)) && (doc.hours !== undefined && doc.hours !== null)) {
                    const dateSrc = (doc.updatedAt || doc.createdAt || new Date().toISOString()).slice(0, 10);
                    doc.logs = [{ date: dateSrc, hours: Number(doc.hours) || 0 }];
                }
                // Normalize numeric fields to expected types
                if (doc.workItemId !== undefined && doc.workItemId !== null) {
                    doc.workItemId = Number(doc.workItemId);
                }
                return doc as TimeEntry;
            });
        } catch {
            return [];
        }
    }

    /**
     * Get filtered time entries for reports
     */
    async getFilteredTimeEntries(filter: TimeReportFilter): Promise<TimeEntry[]> {
        let entries = await this.getAllTimeEntries();

        if (filter.projectId) {
            entries = entries.filter(e => e.projectId === filter.projectId);
        }

        if (filter.userId) {
            entries = entries.filter(e => e.userId === filter.userId);
        }

        if (filter.workItemType) {
            entries = entries.filter(e => e.workItemType === filter.workItemType);
        }

        // Filter by updatedAt date if date filters provided
        if (filter.startDate) {
            entries = entries.filter(e => e.updatedAt >= filter.startDate!);
        }

        if (filter.endDate) {
            const endDatePlusOne = new Date(filter.endDate);
            endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
            entries = entries.filter(e => e.updatedAt < endDatePlusOne.toISOString());
        }

        return entries;
    }

    /**
     * Generate a summary report from filtered entries
     */
    async generateReport(filter: TimeReportFilter): Promise<TimeReportSummary> {
        const entries = await this.getFilteredTimeEntries(filter);

        const summary: TimeReportSummary = {
            totalHours: 0,
            entriesCount: entries.length,
            byUser: {},
            byWorkItemType: {},
            byWorkItem: []
        };

        const workItemMap = new Map<number, { title: string; hours: number }>();

        for (const entry of entries) {
            summary.totalHours += entry.logs ? entry.logs.reduce((s, l) => s + l.hours, 0) : 0;

            // By user
            const userName = entry.userName || entry.userId;
            summary.byUser[userName] = (summary.byUser[userName] || 0) + (entry.logs ? entry.logs.reduce((s, l) => s + l.hours, 0) : 0);

            // By work item type
            const workItemType = entry.workItemType || "Unknown";
            summary.byWorkItemType[workItemType] = (summary.byWorkItemType[workItemType] || 0) + (entry.logs ? entry.logs.reduce((s, l) => s + l.hours, 0) : 0);

            // By work item
            const existing = workItemMap.get(entry.workItemId);
            if (existing) {
                if (entry.logs) {
                    existing.hours += entry.logs.reduce((s, l) => s + l.hours, 0);
                }
            } else {
                workItemMap.set(entry.workItemId, {
                    title: entry.workItemTitle || `Work Item #${entry.workItemId}`,
                    hours: entry.logs ? entry.logs.reduce((s, l) => s + l.hours, 0) : 0
                });
            }
        }

        summary.byWorkItem = Array.from(workItemMap.entries()).map(([id, data]) => ({
            workItemId: id,
            workItemTitle: data.title,
            totalHours: data.hours
        }));

        return summary;
    }

    /**
     * Export entries to CSV format
     */
    exportToCSV(entries: TimeEntry[]): string {
        const headers = ["Work Item ID", "Work Item Title", "Type", "Hours", "User", "Description", "Last Updated"];
        const rows = entries.map(entry => [
            entry.workItemId.toString(),
            `"${(entry.workItemTitle || "").replace(/"/g, '""')}"`,
            entry.workItemType || "",
            (entry.logs ? entry.logs.reduce((s, l) => s + l.hours, 0) : 0).toString(),
            entry.userName || entry.userId,
            `"${(entry.description || "").replace(/"/g, '""')}"`,
            entry.updatedAt
        ]);

        return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    }
}

// Export a singleton instance
export const timeEntryService = new TimeEntryService();
