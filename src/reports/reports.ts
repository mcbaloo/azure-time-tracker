import * as SDK from "azure-devops-extension-sdk";
import { timeEntryService } from "../shared/timeEntryService";
import { TimeEntry, TimeReportFilter, TimeReportSummary } from "../shared/models";

// DOM Elements
let loadingState: HTMLElement;
let mainContent: HTMLElement;
let errorState: HTMLElement;
let errorMessage: HTMLElement;
let resultsBody: HTMLElement;
let resultsTable: HTMLElement;
let emptyState: HTMLElement;

// Summary elements
let totalHoursEl: HTMLElement;
let totalEntriesEl: HTMLElement;
let avgHoursPerDayEl: HTMLElement;
let uniqueWorkItemsEl: HTMLElement;
let resultsCountEl: HTMLElement;

// Filter elements
let filterStartDate: HTMLInputElement;
let filterEndDate: HTMLInputElement;
let filterUser: HTMLSelectElement;
let filterWorkItemType: HTMLSelectElement;

// Chart elements
let chartByUser: HTMLElement;
let chartByType: HTMLElement;

// Data
let allEntries: TimeEntry[] = [];
// Flattened log entries for reporting
type FlatLog = {
    workItemId: number;
    workItemTitle?: string;
    workItemType?: string;
    projectId: string;
    projectName?: string;
    userId: string;
    userName?: string;
    description: string;
    date: string;
    hours: number;
};
let flatLogs: FlatLog[] = [];
let filteredLogs: FlatLog[] = [];
let currentFilter: TimeReportFilter = {};

/**
 * Initialize the SDK and load data
 */
async function init(): Promise<void> {
    try {
        await SDK.init();
        await SDK.ready();

        // Get DOM elements
        loadingState = document.getElementById("loadingState")!;
        mainContent = document.getElementById("mainContent")!;
        errorState = document.getElementById("errorState")!;
        errorMessage = document.getElementById("errorMessage")!;
        resultsBody = document.getElementById("resultsBody")!;
        resultsTable = document.getElementById("resultsTable")!;
        emptyState = document.getElementById("emptyState")!;

        // Summary elements
        totalHoursEl = document.getElementById("totalHours")!;
        totalEntriesEl = document.getElementById("totalEntries")!;
        avgHoursPerDayEl = document.getElementById("avgHoursPerDay")!;
        uniqueWorkItemsEl = document.getElementById("uniqueWorkItems")!;
        resultsCountEl = document.getElementById("resultsCount")!;

        // Filter elements
        filterStartDate = document.getElementById("filterStartDate") as HTMLInputElement;
        filterEndDate = document.getElementById("filterEndDate") as HTMLInputElement;
        filterUser = document.getElementById("filterUser") as HTMLSelectElement;
        filterWorkItemType = document.getElementById("filterWorkItemType") as HTMLSelectElement;

        // Chart elements
        chartByUser = document.getElementById("chartByUser")!;
        chartByType = document.getElementById("chartByType")!;

        // Set up date range presets
        setupDateRangePresets();

        // Set default date range (this month)
        setDateRangePreset("month");

        // Load all time entries
        await loadAllEntries();

        // Populate filter dropdowns
        populateFilterDropdowns();

        // Apply initial filters
        applyFilters();

        // Show main content
        loadingState.classList.add("hidden");
        mainContent.classList.remove("hidden");

        // Notify SDK
        SDK.notifyLoadSucceeded();

    } catch (error) {
        console.error("Initialization error:", error);
        showError(error instanceof Error ? error.message : "Failed to initialize");
    }
}

/**
 * Load all time entries
 */
async function loadAllEntries(): Promise<void> {
    try {
        allEntries = await timeEntryService.getAllTimeEntries();
        flatLogs = [];
        for (const entry of allEntries) {
            if (entry.logs && entry.logs.length > 0) {
                for (const log of entry.logs) {
                    flatLogs.push({
                        workItemId: entry.workItemId,
                        workItemTitle: entry.workItemTitle,
                        workItemType: entry.workItemType,
                        projectId: entry.projectId,
                        projectName: entry.projectName,
                        userId: entry.userId,
                        userName: entry.userName,
                        description: entry.description,
                        date: log.date,
                        hours: log.hours
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error loading entries:", error);
        allEntries = [];
        flatLogs = [];
    }
}

/**
 * Populate filter dropdowns based on available data
 */
function populateFilterDropdowns(): void {
    
    const users = new Map<string, string>();
    const workItemTypes = new Set<string>();

    for (const entry of allEntries) {
        if (entry.userId) {
            users.set(entry.userId, entry.userName || entry.userId);
        }
        if (entry.workItemType) {
            workItemTypes.add(entry.workItemType);
        }
    }

    // Populate users dropdown
    filterUser.innerHTML = '<option value="">All Users</option>';
    for (const [userId, userName] of users) {
        const option = document.createElement("option");
        option.value = userId;
        option.textContent = userName;
        filterUser.appendChild(option);
    }

    // Populate work item types dropdown
    filterWorkItemType.innerHTML = '<option value="">All Types</option>';
    for (const type of workItemTypes) {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        filterWorkItemType.appendChild(option);
    }
}

/**
 * Set up date range preset buttons
 */
function setupDateRangePresets(): void {
    const presetButtons = document.querySelectorAll(".preset-btn");
    presetButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const range = (e.target as HTMLElement).dataset.range;
            if (range) {
                setDateRangePreset(range);
                
                presetButtons.forEach(b => b.classList.remove("active"));
                (e.target as HTMLElement).classList.add("active");
               
                applyFilters();
            }
        });
    });
}

// Listen for changes from other pages (time entry saves) and refresh data
window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === 'timeEntryUpdated') {
        setTimeout(() => refreshData(), 100);
    }
});

/**
 * Set date range based on preset
 */
function setDateRangePreset(preset: string): void {
    const today = new Date();
    let startDate: Date;
    let endDate: Date = today;

    switch (preset) {
        case "today":
            startDate = today;
            endDate = today;
            break;
        case "week":
            startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay());
            break;
        case "month":
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case "quarter":
            const quarter = Math.floor(today.getMonth() / 3);
            startDate = new Date(today.getFullYear(), quarter * 3, 1);
            break;
        case "year":
            startDate = new Date(today.getFullYear(), 0, 1);
            break;
        case "all":
            filterStartDate.value = "";
            filterEndDate.value = "";
            return;
        default:
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    filterStartDate.value = formatDateForInput(startDate);
    filterEndDate.value = formatDateForInput(endDate);
}

/**
 * Apply current filters
 */
function applyFilters(): void {
    currentFilter = {
        startDate: filterStartDate.value || undefined,
        endDate: filterEndDate.value || undefined,
        userId: filterUser.value || undefined,
        workItemType: filterWorkItemType.value || undefined
    };

    // Get work item id filter value
    const workItemIdFilter = (document.getElementById("filterWorkItemId") as HTMLInputElement)?.value || undefined;

    // Filter logs using date and work item id
    filteredLogs = flatLogs.filter(log => {
        if (currentFilter.startDate && log.date < currentFilter.startDate) {
            return false;
        }
        if (currentFilter.endDate && log.date > currentFilter.endDate) {
            return false;
        }
        if (currentFilter.userId && log.userId !== currentFilter.userId) {
            return false;
        }
        if (currentFilter.workItemType && log.workItemType !== currentFilter.workItemType) {
            return false;
        }
        if (workItemIdFilter && log.workItemId.toString() !== workItemIdFilter) {
            return false;
        }
        return true;
    });
    updateSummary();
    renderCharts();
    renderTable();
}

/**
 * Reset all filters
 */
function resetFilters(): void {
    filterStartDate.value = "";
    filterEndDate.value = "";
    filterUser.value = "";
    filterWorkItemType.value = "";

    document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("active"));

    applyFilters();
}

/**
 * Refresh data
 */
async function refreshData(): Promise<void> {
    const refreshBtn = document.getElementById("refreshBtn") as HTMLButtonElement;
    refreshBtn.disabled = true;
    refreshBtn.textContent = "🔄 Refreshing...";

    try {
        await loadAllEntries();
        populateFilterDropdowns();
        applyFilters();
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.textContent = "🔄 Refresh";
    }
}

/**
 * Update summary statistics
 */
function updateSummary(): void {
    const totalHours = filteredLogs.reduce((sum, e) => sum + e.hours, 0);
    const totalEntries = filteredLogs.length;
    // Calculate unique work items
    const uniqueWorkItems = new Set(filteredLogs.map(e => e.workItemId)).size;
    const avgPerWorkItem = uniqueWorkItems > 0 ? totalHours / uniqueWorkItems : 0;
    totalHoursEl.textContent = totalHours.toFixed(1);
    totalEntriesEl.textContent = totalEntries.toString();
    avgHoursPerDayEl.textContent = avgPerWorkItem.toFixed(1);
    uniqueWorkItemsEl.textContent = uniqueWorkItems.toString();
    resultsCountEl.textContent = `${totalEntries} logs`;
}

/**
 * Render bar charts
 */
function renderCharts(): void {
    // Calculate hours by user
    const hoursByUser: Record<string, number> = {};
    const hoursByType: Record<string, number> = {};

    for (const log of filteredLogs) {
        const userName = log.userName || log.userId || "Unknown";
        const workItemType = log.workItemType || "Unknown";
        hoursByUser[userName] = (hoursByUser[userName] || 0) + log.hours;
        hoursByType[workItemType] = (hoursByType[workItemType] || 0) + log.hours;
    }

    // Render charts
    chartByUser.innerHTML = renderBarChart(hoursByUser);
    chartByType.innerHTML = renderBarChart(hoursByType);
}

/**
 * Render a simple horizontal bar chart
 */
function renderBarChart(data: Record<string, number>): string {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    
    if (entries.length === 0) {
        return '<div class="empty-state"><p>No data available</p></div>';
    }

    const maxValue = Math.max(...entries.map(([, v]) => v));

    return entries.slice(0, 10).map(([label, value]) => {
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return `
            <div class="bar-item">
                <div class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="bar-value">${value.toFixed(1)}h</div>
            </div>
        `;
    }).join("");
}

/**
 * Render the results table
 */
function renderTable(): void {
    if (filteredLogs.length === 0) {
        emptyState.classList.remove("hidden");
        resultsTable.classList.add("hidden");
        return;
    }
    emptyState.classList.add("hidden");
    resultsTable.classList.remove("hidden");
    // Sort by date descending
    const sortedLogs = [...filteredLogs].sort((a, b) => b.date.localeCompare(a.date));
    resultsBody.innerHTML = sortedLogs.map(log => `
        <tr>
            <td>
                <a href="#" class="work-item-link" onclick="openWorkItem(${log.workItemId}); return false;">
                    #${log.workItemId}
                </a>
                ${escapeHtml(log.workItemTitle || "")}
            </td>
            <td>${escapeHtml(log.workItemType || "-")}</td>
            <td><strong>${log.hours}h</strong></td>
            <td>${escapeHtml(log.userName || log.userId || "-")}</td>
            <td>${escapeHtml(log.description || "-")}</td>
            <td>${log.date}</td>
        </tr>
    `).join("");
}

/**
 * Export filtered entries to CSV
 */
function exportToCSV(): void {
    if (filteredLogs.length === 0) {
        alert("No entries to export");
        return;
    }
    // Generate CSV from filteredLogs
    const csvRows = [
        'Work Item,Type,Hours,User,Description,Date'
    ];
    for (const log of filteredLogs) {
        csvRows.push([
            `#${log.workItemId}`,
            log.workItemType || '-',
            log.hours,
            log.userName || log.userId || '-',
            '"' + (log.description || '').replace(/"/g, '""') + '"',
            log.date
        ].join(','));
    }
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `time-report-${dateStr}.csv`);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Open a work item in Azure DevOps
 */
function openWorkItem(workItemId: number): void {
    const host = SDK.getHost();
    const baseUrl = `https://dev.azure.com/${host.name}`;
    window.open(`${baseUrl}/_workitems/edit/${workItemId}`, "_blank");
}

/**
 * Show error state
 */
function showError(message: string): void {
    loadingState.classList.add("hidden");
    mainContent.classList.add("hidden");
    errorState.classList.remove("hidden");
    errorMessage.textContent = message;
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

/**
 * Format date for input
 */
function formatDateForInput(date: Date): string {
    return date.toISOString().split("T")[0];
}

/**
 * Escape HTML
 */
function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally
declare global {
    interface Window {
        applyFilters: typeof applyFilters;
        resetFilters: typeof resetFilters;
        refreshData: typeof refreshData;
        exportToCSV: typeof exportToCSV;
        openWorkItem: typeof openWorkItem;
    }
}

window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.refreshData = refreshData;
window.exportToCSV = exportToCSV;
window.openWorkItem = openWorkItem;

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", init);
