import * as SDK from "azure-devops-extension-sdk";
import { IWorkItemFormService, WorkItemTrackingServiceIds } from "azure-devops-extension-api/WorkItemTracking";
import { timeEntryService } from "../shared/timeEntryService";

// DOM Elements
let loadingState: HTMLElement;
let content: HTMLElement;
let noTime: HTMLElement;
let timeValue: HTMLElement;
let contributors: HTMLElement;

/**
 * Initialize the SDK and load data
 */
async function init(): Promise<void> {
    try {
        await SDK.init();
        await SDK.ready();

        // Get DOM elements
        loadingState = document.getElementById("loadingState")!;
        content = document.getElementById("content")!;
        noTime = document.getElementById("noTime")!;
        timeValue = document.getElementById("timeValue")!;
        contributors = document.getElementById("contributors")!;

        // Get work item service
        const workItemFormService = await SDK.getService<IWorkItemFormService>(
            WorkItemTrackingServiceIds.WorkItemFormService
        );

        // Get work item ID
        const workItemId = await workItemFormService.getId();

        // Load time entries for this work item
        await loadTimeSummary(workItemId);

        // Hide loading
        loadingState.style.display = "none";

        // Notify SDK that we're ready
        SDK.notifyLoadSucceeded();

    } catch (error) {
        console.error("Initialization error:", error);
        // Show no time state on error
        if (loadingState) loadingState.style.display = "none";
        if (noTime) noTime.style.display = "flex";
        SDK.notifyLoadSucceeded();
    }
}

/**
 * Load time summary for the work item
 */
async function loadTimeSummary(workItemId: number): Promise<void> {
    try {
        const entries = await timeEntryService.getTimeEntriesForWorkItem(workItemId);
        
        if (!entries || entries.length === 0) {
            noTime.style.display = "flex";
            return;
        }

        // Calculate total hours (sum all logs in each entry)
        const totalHours = entries.reduce((sum, e) => sum + (e.logs ? e.logs.reduce((s, l) => s + l.hours, 0) : 0), 0);
        
        if (totalHours === 0) {
            noTime.style.display = "flex";
            return;
        }
        
        // Get unique contributors
        const uniqueUsers = new Set(entries.map(e => e.userName || e.userId));
        
        // Display
        timeValue.textContent = `${totalHours}h`;
        
        if (uniqueUsers.size > 1) {
            contributors.textContent = `(${uniqueUsers.size} contributors)`;
        } else if (uniqueUsers.size === 1) {
            const userName = entries[0].userName || entries[0].userId;
            contributors.textContent = `by ${userName}`;
        }
        
        content.style.display = "flex";

    } catch (error) {
        console.error("Error loading time summary:", error);
        noTime.style.display = "flex";
    }
}

/**
 * Open the Time Tracking tab 
 */
async function openTimeTracking(): Promise<void> {
    try {
        const workItemFormService = await SDK.getService<IWorkItemFormService>(
            WorkItemTrackingServiceIds.WorkItemFormService
        ) as any; 
        
        
        const contributionId = SDK.getExtensionContext().id + ".time-entry-work-item-form-page";
        
        
        if (typeof workItemFormService.setActivePage === 'function') {
            await workItemFormService.setActivePage(contributionId);
        } else {
           
            alert("Click the 'Time Tracking' tab in the work item form to log time.");
        }
    } catch (error) {
        console.error("Error opening Time Tracking:", error);
        alert("Click the 'Time Tracking' tab in the work item form to log time.");
    }
}

declare global {
    interface Window {
        openTimeTracking: typeof openTimeTracking;
    }
}

window.openTimeTracking = openTimeTracking;

document.addEventListener("DOMContentLoaded", init);
