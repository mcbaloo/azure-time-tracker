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
let filteredEntries: TimeEntry[] = [];
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
    } catch (error) {
        console.error("Error loading entries:", error);
        allEntries = [];
    }
}

/**
 * Populate filter dropdowns based on available data
 */
function populateFilterDropdowns(): void {
    // Get unique users
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
                // Update active state
                presetButtons.forEach(b => b.classList.remove("active"));
                (e.target as HTMLElement).classList.add("active");
            }
        });
    });
}

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

    // Filter entries using updatedAt
    filteredEntries = allEntries.filter(entry => {
        const entryDate = entry.updatedAt.split("T")[0];
        if (currentFilter.startDate && entryDate < currentFilter.startDate) {
            return false;
        }
        if (currentFilter.endDate && entryDate > currentFilter.endDate) {
            return false;
        }
        if (currentFilter.userId && entry.userId !== currentFilter.userId) {
            return false;
        }
        if (currentFilter.workItemType && entry.workItemType !== currentFilter.workItemType) {
            return false;
        }
        return true;
    });

    // Update reports
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

    // Remove active state from presets
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
    const totalHours = filteredEntries.reduce((sum, e) => sum + e.hours, 0);
    const totalEntries = filteredEntries.length;
    
    // Calculate unique work items
    const uniqueWorkItems = new Set(filteredEntries.map(e => e.workItemId)).size;
    const avgPerWorkItem = uniqueWorkItems > 0 ? totalHours / uniqueWorkItems : 0;

    totalHoursEl.textContent = totalHours.toFixed(1);
    totalEntriesEl.textContent = totalEntries.toString();
    avgHoursPerDayEl.textContent = avgPerWorkItem.toFixed(1);
    uniqueWorkItemsEl.textContent = uniqueWorkItems.toString();
    resultsCountEl.textContent = `${totalEntries} entries`;
}

/**
 * Render bar charts
 */
function renderCharts(): void {
    // Calculate hours by user
    const hoursByUser: Record<string, number> = {};
    const hoursByType: Record<string, number> = {};

    for (const entry of filteredEntries) {
        const userName = entry.userName || entry.userId || "Unknown";
        const workItemType = entry.workItemType || "Unknown";

        hoursByUser[userName] = (hoursByUser[userName] || 0) + entry.hours;
        hoursByType[workItemType] = (hoursByType[workItemType] || 0) + entry.hours;
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
    if (filteredEntries.length === 0) {
        emptyState.classList.remove("hidden");
        resultsTable.classList.add("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    resultsTable.classList.remove("hidden");

    // Sort by updatedAt descending
    const sortedEntries = [...filteredEntries].sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    resultsBody.innerHTML = sortedEntries.map(entry => `
        <tr>
            <td>
                <a href="#" class="work-item-link" onclick="openWorkItem(${entry.workItemId}); return false;">
                    #${entry.workItemId}
                </a>
                ${escapeHtml(entry.workItemTitle || "")}
            </td>
            <td>${escapeHtml(entry.workItemType || "-")}</td>
            <td><strong>${entry.hours}h</strong></td>
            <td>${escapeHtml(entry.userName || entry.userId || "-")}</td>
            <td>${escapeHtml(entry.description || "-")}</td>
            <td>${formatDate(entry.updatedAt)}</td>
        </tr>
    `).join("");
}

/**
 * Export filtered entries to CSV
 */
function exportToCSV(): void {
    if (filteredEntries.length === 0) {
        alert("No entries to export");
        return;
    }

    const csv = timeEntryService.exportToCSV(filteredEntries);
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
