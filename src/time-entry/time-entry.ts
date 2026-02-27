import * as SDK from "azure-devops-extension-sdk";
import {
  IWorkItemFormService,
  WorkItemTrackingServiceIds,
} from "azure-devops-extension-api/WorkItemTracking";
import { timeEntryService } from "../shared/timeEntryService";
import {
  TimeEntry,
  TimeTrackerSettings,
  AuditLogEntry,
  TimeLog,
} from "../shared/models";

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
let currentEntryTimeLog: TimeLog[] = [];
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
    commentInput = document.getElementById(
      "commentInput",
    ) as HTMLTextAreaElement;
    currentHoursDisplay = document.getElementById("currentHours")!;
    lastSavedDiv = document.getElementById("lastSaved")!;
    lastSavedTime = document.getElementById("lastSavedTime")!;
    incrementSelect = document.getElementById(
      "incrementSelect",
    ) as HTMLSelectElement;
    historyList = document.getElementById("historyList")!;

    // Get current user
    const user = SDK.getUser();
    currentUserId = user.id;
    currentUserName = user.displayName || user.name;

    // Get work item service
    const workItemFormService = await SDK.getService<IWorkItemFormService>(
      WorkItemTrackingServiceIds.WorkItemFormService,
    );

    // Get work item info
    currentWorkItemId = await workItemFormService.getId();
    const fields = await workItemFormService.getFieldValues([
      "System.Title",
      "System.WorkItemType",
      "System.TeamProject",
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

    // Listen for updates from other pages and refresh the work item view
    setupRemoteUpdateListener();

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
    const entries = await timeEntryService.getTimeEntriesForWorkItem(
      currentWorkItemId,
    );

 
    currentEntry = entries.find((e) => String(e.userId) === String(currentUserId)) || null;
    
    let today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const todayDateEl = document.getElementById("todayDate");
    if (todayDateEl) {
      const d = new Date();
      todayDateEl.textContent = d.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    
    const allLogsRaw = entries.flatMap((e) => e.logs || []);
    currentEntryTimeLog = allLogsRaw;
    const normalizeDate = (d: string) => {
      try {
        return new Date(d).toISOString().slice(0, 10);
      } catch {
        return (d || "").slice(0, 10);
      }
    };
    const aggMap: Record<string, number> = {};
    for (const l of allLogsRaw) {
      const key = normalizeDate(l.date);
      aggMap[key] = (aggMap[key] || 0) + (Number(l.hours) || 0);
    }
    const allLogs = Object.keys(aggMap).map((date) => ({ date, hours: aggMap[date] }));
    const todayLogs = allLogs.filter((l) => normalizeDate(l.date) === today);
    const todayHours = todayLogs.reduce((sum, l) => sum + l.hours, 0);

    const totalHours = allLogs.reduce((sum, l) => sum + l.hours, 0);
    currentHoursDisplay.textContent = totalHours.toString();


    const todayHoursDisplay = document.getElementById("todayHours");
    const saveBtn = document.getElementById(
      "saveBtn",
    ) as HTMLButtonElement | null;
    const totalLarge = document.getElementById("totalHoursLarge");

    if (todayHoursDisplay)
      todayHoursDisplay.textContent = todayHours.toString();
    if (totalLarge)
      totalLarge.textContent =
        (todayHours > 0 ? todayHours.toString() : totalHours.toString()) || "0";

    const todayAggregatedHours = todayHours || 0;
    hoursInput.value = todayAggregatedHours.toString();
    if (saveBtn) saveBtn.textContent = todayAggregatedHours > 0 ? "Update Time" : "Add Time";
    hoursInput.disabled = false;
    if (saveBtn) saveBtn.disabled = false;


    if (entries && entries.length > 0) {
      const latestUpdate = entries
        .map((e) => e.updatedAt)
        .filter(Boolean)
        .sort()
        .reverse()[0];
      if (latestUpdate) {
        lastSavedDiv.classList.remove("hidden");
        lastSavedTime.textContent = formatDate(latestUpdate);
      }

     
      const combinedAudit: AuditLogEntry[] = entries.flatMap((e) => e.auditLog || []);
      if (combinedAudit && combinedAudit.length > 0) {
        renderHistory(combinedAudit);
      }
    }

    renderDailyLogs(allLogs);
    ensureSaveBtnAndInput();
  } catch (error) {
    console.error("Error loading time entry:", error);
  }
}

/**
 * Ensure the hours input and save button reflect today's state.
 */
function ensureSaveBtnAndInput(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const allLogs = currentEntryTimeLog || [];
    const normalizeDate = (d: string) => {
      try {
        return new Date(d).toISOString().slice(0, 10);
      } catch {
        return (d || "").slice(0, 10);
      }
    };
    const todayLogs = allLogs.filter((l) => normalizeDate(l.date) === today);
    const saveBtn = document.getElementById(
      "saveBtn",
    ) as HTMLButtonElement | null;
    if (todayLogs.length === 0) {
      if (hoursInput) hoursInput.value = "0";
      if (saveBtn) saveBtn.textContent = "Add Time";
    } else {
      const latest = todayLogs[todayLogs.length - 1];
      if (hoursInput)
        hoursInput.value =
          latest && latest.hours !== undefined
            ? latest.hours.toString()
            : todayLogs.reduce((s, l) => s + l.hours, 0).toString();
      if (saveBtn) saveBtn.textContent = "Update Time";
    }
    if (saveBtn) saveBtn.disabled = false;
    if (hoursInput) hoursInput.disabled = false;
  } catch (e) {
    console.error("ensureSaveBtnAndInput error", e);
  }
}

/**
 * Render editable daily logs so users can view and edit each day's hours
 */
function renderDailyLogs(logs: { date: string; hours: number }[]): void {
  const container = document.getElementById("dailyLogs")!;
  if (!container) return;

  if (!logs || logs.length === 0) {
    container.innerHTML = `
            <div style="padding:12px; display:flex; gap:10px; align-items:flex-start; color:var(--text-secondary);">
                <div style="font-size:18px;">📭</div>
                <div>
                    <div style="font-weight:600; color:var(--text-color);">No daily time logged yet</div>
                    <div style="font-size:12px; margin-top:4px;">When you log time it will appear here.</div>
                </div>
            </div>
        `;
    return;
  }

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  container.innerHTML = sorted
    .map((l) => {
      const displayDate = new Date(l.date).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      return `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color);">
                <div style="min-width:140px;color:var(--text-secondary);font-size:13px;">${displayDate}</div>
                <div style="padding:4px 8px;border-radius:10px;background:#f1f8ff;color:var(--primary-color);font-weight:600;font-size:13px;">${l.hours}h</div>
                <div style="margin-left:auto;color:var(--text-secondary);font-size:12px;">${l.date}</div>
            </div>
        `;
    })
    .join("");
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

  historyList.innerHTML = sortedEntries
    .map((entry) => {
      const isCreated = entry.action === "created";
      const avatarLetter = entry.userName
        ? entry.userName.charAt(0).toUpperCase()
        : "?";
      const avatarClass = isCreated
        ? "history-avatar created"
        : "history-avatar";

      const actionText = isCreated ? "logged time" : "updated time";
      const hoursDisplay =
        entry.previousHours !== undefined &&
        entry.previousHours !== entry.newHours
          ? `${entry.previousHours}h → ${entry.newHours}h`
          : `${entry.newHours}h`;

      const formattedTime = formatDate(entry.timestamp);

      return `
            <div class="history-item">
                <div class="${avatarClass}">${avatarLetter}</div>
                <div class="history-content">
                    <div class="history-meta">
                        <span class="history-user">${entry.userName || "Unknown"}</span>
                        <span class="history-action">${actionText}</span>
                        <span class="history-hours">${hoursDisplay}</span>
                        <span class="history-time">${formattedTime}</span>
                    </div>
                    ${entry.notes ? `<div class="history-notes">${escapeHtml(entry.notes)}</div>` : ""}
                </div>
            </div>
        `;
    })
    .join("");
}


function escapeHtml(text: string): string {
  const div = document.createElement("div");
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

  const hours = parseFloat(hoursInput.value) || 0;
  const comment = commentInput.value.trim();
  const today = new Date().toISOString().slice(0, 10);

  try {
    currentEntry = await timeEntryService.setTimeEntry(
      {
        workItemId: currentWorkItemId,
        workItemTitle: currentWorkItemTitle,
        workItemType: currentWorkItemType,
        projectId: currentProjectId,
        projectName: currentProjectName,
        logs: currentEntry?.logs || [],
        hours,
        date: today,
        description: currentEntry?.description || "",
        userId: currentUserId,
        userName: currentUserName,
      },
      comment,
    );
  } catch (err) {
    console.error("Failed to persist time entry:", err);
    alert("Failed to save time. Please try again.");
    saveBtn.textContent = "Update Time";
    saveBtn.disabled = false;
    return;
  }

  try {
    await loadTimeEntry();
    lastSavedDiv.classList.remove("hidden");
    if (currentEntry && currentEntry.updatedAt) {
      lastSavedTime.textContent = formatDate(currentEntry.updatedAt);
    }
    commentInput.value = "";
    if (currentEntry?.auditLog && currentEntry.auditLog.length > 0) {
      try { renderHistory(currentEntry.auditLog); } catch (e) { console.error('renderHistory failed', e); }
    }
  } catch (err) {
    console.error("Failed to reload entry after save:", err);
  }

  try {
    try {
      const bc = new BroadcastChannel("azure-time-tracker");
      bc.postMessage("timeEntryUpdated");
      bc.close();
    } catch (e) {
      try { localStorage.setItem("timeEntryUpdated", new Date().toISOString()); } catch (le) { console.error('fallback storage failed', le); }
    }
  } catch (err) {
    console.error('Notification failed', err);
  }

  saveBtn.textContent = "✓ Updated!";
  setTimeout(() => {
    saveBtn.textContent = "Update Time";
    saveBtn.disabled = false;
  }, 1500);
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
    minute: "2-digit",
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

/**
 * Listen for time entry updates from other tabs/windows and refresh current view.
 */
function setupRemoteUpdateListener(): void {
  try {
    const bc = new BroadcastChannel("azure-time-tracker");
    bc.onmessage = (ev) => {
      if (ev.data === "timeEntryUpdated") {
        // Reload entry for current work item
        loadTimeEntry().catch((err) =>
          console.error("Failed to reload after broadcast:", err),
        );
      }
    };
  } catch {
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key === "timeEntryUpdated") {
        loadTimeEntry().catch((err) =>
          console.error("Failed to reload after storage event:", err),
        );
      }
    });
  }
}
