[![Install from Visual Studio Marketplace](https://img.shields.io/badge/Install%20on%20Marketplace-azure--devops--time--tracker--extension-blue?logo=visual-studio&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=mcbaloo-apps.azure-devops-time-tracker-extension)

# Azure DevOps Time Tracker Extension

A Visual Studio Marketplace extension for Azure DevOps that enables time tracking on work items and generates comprehensive reports.

## Features

### Time Entry (Work Item Form Tab)
- Add time entries directly from any work item
- Log hours with date and description
- View, edit, and delete time entries
- See total hours spent on each work item

### Time Reports Hub
- View aggregated time data across the project
- Filter by date range, user, and work item type
- Visual bar charts showing hours by user and work item type
- Export reports to CSV
- Quick date range presets (Today, This Week, This Month, etc.)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [tfx-cli](https://www.npmjs.com/package/tfx-cli) (installed automatically as dev dependency)
- An Azure DevOps organization
- A Visual Studio Marketplace publisher account

## Project Structure

```
azure-time-tracker/
├── src/
│   ├── shared/
│   │   ├── models.ts          # TypeScript interfaces
│   │   ├── timeEntryService.ts # Data service for time entries
│   │   └── styles.css         # Shared CSS styles
│   ├── time-entry/
│   │   ├── time-entry.html    # Work item form tab UI
│   │   └── time-entry.ts      # Time entry logic
│   └── reports/
│       ├── reports.html       # Reports hub UI
│       └── reports.ts         # Reports logic
├── images/
│   ├── icon.png               # Extension icon (128x128)
│   └── report-icon.png        # Hub icon
├── dist/                      # Build output
├── package.json
├── tsconfig.json
├── vss-extension.json         # Extension manifest
└── overview.md                # Marketplace description
```

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

### Build the extension

```bash
npm run build
```

This will:
1. Compile TypeScript to JavaScript
2. Copy HTML and CSS files to the dist folder

### Create the extension package

```bash
npm run package
```

This creates a `.vsix` file in the `dist` folder that can be uploaded to the Visual Studio Marketplace.

### Full build and package

```bash
npm run dev
```

## Publishing

### First-time Setup

1. Create a publisher on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage/createpublisher)

2. Update `vss-extension.json`:
   - Replace `"publisher": "your-publisher-id"` with your actual publisher ID

3. Add icon images:
   - Create a 128x128 PNG icon at `images/icon.png`
   - Create a report icon at `images/report-icon.png`

### Publishing Steps

1. Build and package the extension:
   ```bash
   npm run dev
   ```

2. Upload to the Marketplace:
   - Go to [Visual Studio Marketplace Publishing Portal](https://marketplace.visualstudio.com/manage)
   - Click "New Extension" > "Azure DevOps"
   - Upload the `.vsix` file from the `dist` folder

3. Or use the CLI:
   ```bash
   npx tfx extension publish --vsix dist/your-publisher-id.time-tracker-extension-1.0.0.vsix --token <your-pat>
   ```

### For Testing (Private Extension)

1. Share the extension with your organization:
   - In the Marketplace portal, click on your extension
   - Go to "Share/Unshare"
   - Add your Azure DevOps organization

2. Install in your organization:
   - Go to your Azure DevOps organization settings
   - Navigate to Extensions
   - Find your shared extension and install it

## Configuration

The extension stores time entries using Azure DevOps Extension Data Service, which provides:
- Secure, organization-scoped storage
- Automatic data persistence
- No external database required

## Permissions

The extension requires the following scopes:
- `vso.work` - Read work items
- `vso.work_write` - Store time entries as extension data

## Usage

### Adding Time Entries

1. Open any work item in Azure DevOps
2. Click the "Time Tracking" tab
3. Fill in the date, hours, and optional description
4. Click "Add Time Entry"

### Viewing Reports

1. Navigate to Boards > Time Reports
2. Use filters to narrow down the data
3. View charts and summary statistics
4. Export to CSV if needed

<img width="852" height="691" alt="image" src="https://github.com/user-attachments/assets/21fd28d5-81ff-4415-9392-f7dc02dd5212" />

<img width="852" height="691" alt="image" src="https://github.com/user-attachments/assets/df7fd06a-d7aa-430c-af17-8207ce42baa9" />
<img width="852" height="691" alt="image" src="https://github.com/user-attachments/assets/ab4559fe-bd21-482b-9d79-0636926ca0ac" />
<img width="852" height="691" alt="image" src="https://github.com/user-attachments/assets/c138666b-ef08-468d-b488-48b3bb9dfb43" />


## Troubleshooting

### Extension not appearing
- Make sure the extension is installed for your project
- Check that you have appropriate permissions

### Data not saving
- Verify the extension has the required scopes
- Check browser console for errors

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Make sure you have Node.js 18 or later

## License

MIT
