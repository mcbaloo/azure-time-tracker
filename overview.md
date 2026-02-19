# Time Tracker Logger for Azure DevOps

Track time spent on work items and generate comprehensive reports with full audit history.

## Features

### Time Logged Summary on Work Items
- **See time at a glance**: Time logged is displayed directly on the work item form without clicking any tabs
- Shows total hours and contributors
- Quick link to edit time or navigate to full Time Tracking tab

### Time Entry on Work Items
- Add time entries directly from any work item using the "Time Tracking" tab
- Quick-add buttons: +30m, +1h, +3h, +6h, +8 for fast time logging
- Configurable time increments (15 min, 30 min, or 1 hour)
- Add notes/descriptions for each time entry
- Simple, compact form that opens directly when you click Time Tracking

### Audit Trail & History
- **Full audit log**: Track who updated time and when
- View change history showing previous hours → new hours
- See all notes/comments associated with each update
- Expandable history panel on the Time Tracking tab

### Time Reports Hub
- Access via **Boards > Time Reports**
- Filter by date range, project, work item type, user
- Visual bar charts showing hours by user and work item type
- Summary cards with total hours, entries count, and averages
- Export reports to CSV for external analysis
- Detailed table with all time entries

## Getting Started

1. Install the extension from the Visual Studio Marketplace
2. Open any work item - you'll see a "Time Logged" section showing current time
3. Click the "Time Tracking" tab to add or edit time entries
4. Access **Boards > Time Reports** to generate reports across your project

## How It Works

- Each user can log time against each work item (one entry per user per work item)
- Time entries are stored securely using Azure DevOps Extension Data Service
- All changes are tracked in an audit log with timestamps and user information
- Reports aggregate time across all users for comprehensive project tracking

## Permissions Required

- **Work Items (Read)**: To read work item information
- **Work Items (Write)**: To save time entries

## Version History


### v1.0.0
- Initial release with time tracking and reports

## Support

For issues and feature requests, please visit our GitHub repository.
