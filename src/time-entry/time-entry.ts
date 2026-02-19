import * as SDK from "azure-devops-extension-sdk";
import { IWorkItemFormService, WorkItemTrackingServiceIds } from "azure-devops-extension-api/WorkItemTracking";
import { timeEntryService } from "../shared/timeEntryService";
import { TimeEntry, TimeTrackerSettings, AuditLogEntry } from "../shared/models";

// DOM Elements
let loadingState: HTMLElement;
let mainContent: HTMLElement;
let errorState: HTMLElement;
let errorMessage: HTMLElement;
let hoursInput: HTMLInputElement;
let commentInput: HTMLTextAreaElement;
let currentHoursDisplay: HTMLElement;
let lastSavedDiv: HTMLElement;
let lastSavedTime: HTMLElement;
let incrementSelect: HTMLSelectElement;
let historyList: HTMLElement;

// Current work item info
let currentWorkItemId: number;
let currentProjectId: string;
let currentProjectName: string;
let currentUserId: string;
let currentUserName: string;
let currentWorkItemTitle: string;
let currentWorkItemType: string;

// Current time entry (if exists)
let currentEntry: TimeEntry | null = null;

// Settings
let settings: TimeTrackerSettings = { hourIncrement: 0.5 };

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
        hoursInput = document.getElementById("hoursInput") as HTMLInputElement;
        commentInput = document.getElementById("commentInput") as HTMLTextAreaElement;
        currentHoursDisplay = document.getElementById("currentHours")!;
        lastSavedDiv = document.getElementById("lastSaved")!;
        lastSavedTime = document.getElementById("lastSavedTime")!;
        incrementSelect = document.getElementById("incrementSelect") as HTMLSelectElement;
        historyList = document.getElementById("historyList")!;

        // Get current user
        const user = SDK.getUser();
        currentUserId = user.id;
        currentUserName = user.displayName || user.name;

        // Get work item service
        const workItemFormService = await SDK.getService<IWorkItemFormService>(
            WorkItemTrackingServiceIds.WorkItemFormService
        );

        // Get work item info
        currentWorkItemId = await workItemFormService.getId();
        const fields = await workItemFormService.getFieldValues([
            "System.Title",
            "System.WorkItemType",
            "System.TeamProject"
        ]);

        currentWorkItemTitle = fields["System.Title"] as string;
        currentWorkItemType = fields["System.WorkItemType"] as string;
        currentProjectName = fields["System.TeamProject"] as string;
        
        // Get project ID from context
        const context = SDK.getExtensionContext();
        currentProjectId = context.id;

        // Load settings
        settings = await timeEntryService.getSettings();
        applySettings();

        // Load existing time entry
        await loadTimeEntry();

        // Show main content
        loadingState.classList.add("hidden");
        mainContent.classList.remove("hidden");

        // Notify SDK that we're ready
        SDK.notifyLoadSucceeded();

    } catch (error) {
        console.error("Initialization error:", error);
        showError(error instanceof Error ? error.message : "Failed to initialize");
    }
}

/**
 * Load existing time entry for this work item
 */
async function loadTimeEntry(): Promise<void> {
    try {
        currentEntry = await timeEntryService.getTimeEntryForWorkItem(currentWorkItemId, currentUserId);
        
        if (currentEntry) {
            hoursInput.value = currentEntry.hours.toString();
            currentHoursDisplay.textContent = currentEntry.hours.toString();
            
            // Show last saved
            lastSavedDiv.classList.remove("hidden");
            lastSavedTime.textContent = formatDate(currentEntry.updatedAt);
            
            // Render history/audit log
            if (currentEntry.auditLog && currentEntry.auditLog.length > 0) {
                renderHistory(currentEntry.auditLog);
            }
        } else {
            hoursInput.value = "0";
            currentHoursDisplay.textContent = "0";
        }
    } catch (error) {
        console.error("Error loading time entry:", error);
    }
}

/**
 * Render history entries with name and time
 */
function renderHistory(entries: AuditLogEntry[]): void {
    // Sort by most recent first
    const sortedEntries = [...entries].reverse();
    
    if (sortedEntries.length === 0) {
        historyList.innerHTML = '<div class="no-history">No activity yet</div>';
        return;
    }
    
    historyList.innerHTML = sortedEntries.map(entry => {
        const isCreated = entry.action === 'created';
        const avatarLetter = entry.userName ? entry.userName.charAt(0).toUpperCase() : '?';
        const avatarClass = isCreated ? 'history-avatar created' : 'history-avatar';
        
        const actionText = isCreated ? 'logged time' : 'updated time';
        const hoursDisplay = entry.previousHours !== undefined && entry.previousHours !== entry.newHours
            ? `${entry.previousHours}h → ${entry.newHours}h`
            : `${entry.newHours}h`;
        
        const formattedTime = formatDate(entry.timestamp);
        
        return `
            <div class="history-item">
                <div class="${avatarClass}">${avatarLetter}</div>
                <div class="history-content">
                    <div class="history-meta">
                        <span class="history-user">${entry.userName || 'Unknown'}</span>
                        <span class="history-action">${actionText}</span>
                        <span class="history-hours">${hoursDisplay}</span>
                        <span class="history-time">${formattedTime}</span>
                    </div>
                    ${entry.notes ? `<div class="history-notes">${escapeHtml(entry.notes)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Apply settings to UI
 */
function applySettings(): void {
    hoursInput.step = settings.hourIncrement.toString();
    incrementSelect.value = settings.hourIncrement.toString();
}

/**
 * Save time entry
 */
async function saveTime(): Promise<void> {
    const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const hours = parseFloat(hoursInput.value) || 0;
        const comment = commentInput.value.trim();

        currentEntry = await timeEntryService.setTimeEntry({
            workItemId: currentWorkItemId,
            workItemTitle: currentWorkItemTitle,
            workItemType: currentWorkItemType,
            projectId: currentProjectId,
            projectName: currentProjectName,
            hours,
            description: currentEntry?.description || "", 
            userId: currentUserId,
            userName: currentUserName
        }, comment); 

        currentHoursDisplay.textContent = hours.toString();
        lastSavedDiv.classList.remove("hidden");
        lastSavedTime.textContent = formatDate(currentEntry.updatedAt);
        
        commentInput.value = "";
        
        // Update history
        if (currentEntry.auditLog && currentEntry.auditLog.length > 0) {
            renderHistory(currentEntry.auditLog);
        }

    
        saveBtn.textContent = "✓ Saved!";
        setTimeout(() => {
            saveBtn.textContent = "Save Time";
            saveBtn.disabled = false;
        }, 1500);

    } catch (error) {
        console.error("Error saving time:", error);
        alert("Failed to save time. Please try again.");
        saveBtn.textContent = "Save Time";
        saveBtn.disabled = false;
    }
}

/**
 * Increment hours by the configured step
 */
function incrementHours(): void {
    const current = parseFloat(hoursInput.value) || 0;
    hoursInput.value = (current + settings.hourIncrement).toString();
}

/**
 * Decrement hours by the configured step
 */
function decrementHours(): void {
    const current = parseFloat(hoursInput.value) || 0;
    const newValue = Math.max(0, current - settings.hourIncrement);
    hoursInput.value = newValue.toString();
}

/**
 * Add hours to current value
 */
function addHours(amount: number): void {
    const current = parseFloat(hoursInput.value) || 0;
    hoursInput.value = (current + amount).toString();
}

/**
 * Set hours to a specific value
 */
function setHours(value: number): void {
    hoursInput.value = value.toString();
}

/**
 * Update increment setting
 */
async function updateIncrement(): Promise<void> {
    const newIncrement = parseFloat(incrementSelect.value);
    settings.hourIncrement = newIncrement;
    hoursInput.step = newIncrement.toString();
    
    try {
        await timeEntryService.saveSettings({ hourIncrement: newIncrement });
    } catch (error) {
        console.error("Error saving settings:", error);
    }
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
    return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Make functions available globally for onclick handlers
declare global {
    interface Window {
        saveTime: typeof saveTime;
        incrementHours: typeof incrementHours;
        decrementHours: typeof decrementHours;
        addHours: typeof addHours;
        setHours: typeof setHours;
        updateIncrement: typeof updateIncrement;
    }
}

window.saveTime = saveTime;
window.incrementHours = incrementHours;
window.decrementHours = decrementHours;
window.addHours = addHours;
window.setHours = setHours;
window.updateIncrement = updateIncrement;

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", init);
