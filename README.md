# Local File Explorer - Complete Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Installation & Setup](#installation--setup)
5. [Usage Guide](#usage-guide)
6. [API Reference](#api-reference)
7. [File Structure](#file-structure)
8. [Configuration](#configuration)
9. [Development](#development)
10. [Troubleshooting](#troubleshooting)

## Project Overview

The Local File Explorer is a web-based application that provides an intuitive interface for browsing, selecting, and analyzing files on your local system. It's designed to help developers understand project structures, manage dependencies, and generate comprehensive file collections for analysis or AI assistance.

### Key Capabilities
- **Interactive File Browsing**: Navigate through your file system with a GitHub-like interface
- **Smart File Selection**: Automatic dependency detection and project type recognition
- **File Generation**: Create consolidated files from selected content with chunking support
- **Project Type Detection**: Built-in support for Django and React projects
- **Docker Integration**: Automatic detection and inclusion of Docker-related files

## Architecture

### Technology Stack
- **Backend**: Node.js with Express framework
- **Frontend**: Vanilla JavaScript with modern CSS
- **File System**: Native Node.js `fs` module
- **Communication**: RESTful API with WebSocket support

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  Express Server │    │  File System    │
│  (HTML/CSS/JS)  │◄──►│   (Node.js)     │◄──►│   Operations    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
    ┌─────────┐            ┌─────────┐            ┌─────────┐
    │ Chunking│            │   API   │            │Settings │
    │ System  │            │Endpoints│            │Management│
    └─────────┘            └─────────┘            └─────────┘
```

## Features

### 1. File Browser Interface
- **Tree View**: Hierarchical display of directories and files
- **Breadcrumb Navigation**: Easy navigation through directory paths
- **File Information**: Size, type, and modification details
- **Responsive Design**: Works on desktop and mobile devices

### 2. Smart Selection System
- **Manual Selection**: Click checkboxes to select individual files
- **Dependency Detection**: Automatically includes referenced files
- **Project Type Recognition**: Auto-selects important files based on project type
- **Bulk Operations**: Select entire directories with one click

### 3. File Content Management
- **Live Preview**: View file contents with syntax highlighting
- **Binary Detection**: Handles both text and binary files appropriately
- **Large File Handling**: Optimized for files up to 1MB
- **Line Numbers**: Enhanced readability with line numbering

### 4. Advanced Features
- **Chunking System**: Splits large outputs into manageable pieces
- **Copy & Download**: Multiple options for exporting content
- **Settings Persistence**: Remembers your preferences across sessions
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Installation & Setup

### Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Quick Start
1. **Clone or Download** the project files
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start the Server**:
   ```bash
   npm start
   ```
4. **Open Browser**: Navigate to `http://localhost:3000`

### Directory Structure After Setup
```
project_feed_explorer/
├── css/
│   ├── styles.css          # Main application styles
│   └── chunking.css        # Chunking-specific styles
├── js/
│   └── file-explorer.js    # Main application logic
├── index.html              # Application entry point
├── server.js               # Express server
├── package.json            # Dependencies and scripts
├── .gitignore             # Git ignore patterns
├── README.md              # Basic project info
├── settings.json          # User settings (created after first use)
└── output_files_selected/ # Generated files directory
```

## Usage Guide

### Getting Started

1. **Launch the Application**
   - Start the server with `npm start`
   - Your browser should automatically open to `http://localhost:3000`

2. **Set Your Default Directory**
   - Click the "⚙️ Settings" button
   - Browse and select your project directory
   - Save settings

3. **Browse and Select Files**
   - Navigate through directories using the file tree
   - Check boxes next to files you want to include
   - Watch as dependencies are automatically detected

### File Selection Strategies

#### Manual Selection
- Click individual file checkboxes
- Use directory checkboxes to select all contents
- Dependency files are auto-included with "AUTO" tags

#### Project Type Detection
Enable project type detection in settings:
- **Django Projects**: Auto-selects settings.py, models.py, views.py, etc.
- **React Projects**: Auto-includes package.json, src/App.js, index.js, etc.

#### Docker Integration
- Enable "Auto-include Docker files" in settings
- Automatically finds Dockerfile, docker-compose.yml, etc.
- Searches current and parent directories

### Content Generation

1. **Validate Selection**
   - Click "Validate Selection" when ready
   - Review the summary of selected files
   - See total files, lines, and estimated size

2. **Generate Output**
   - Click "Generate File" to create the collection
   - Files are saved to `output_files_selected/` directory
   - View content in the preview modal

3. **Work with Chunks** (for large files)
   - Large outputs are automatically split into chunks
   - Navigate between chunks using buttons or arrow keys
   - Copy individual chunks or download all

### Settings Configuration

#### Default Directory
Set where the explorer starts when launched:
```
Settings → Default Directory → Browse → Select Folder
```

#### Custom AI Prompt
Add context text that appears at the beginning of generated files:
```
Settings → AI Context Prompt → Enter your instructions
```

#### Project Types
Enable automatic detection for:
- Django projects (Python web framework)
- React projects (JavaScript library)

#### Docker Integration
Auto-include Docker-related files from your project tree.

## API Reference

### Core Endpoints

#### `GET /api/cwd`
Returns the current working directory.

**Response:**
```json
{
  "cwd": "/path/to/current/directory"
}
```

#### `GET /api/directory/:path`
Lists contents of a directory.

**Parameters:**
- `path`: URL-encoded directory path

**Response:**
```json
[
  {
    "name": "filename.js",
    "type": "file",
    "path": "/full/path/to/file",
    "size": 1024,
    "modified": "2024-01-01T00:00:00.000Z"
  }
]
```

#### `GET /api/file/:path`
Retrieves file content.

**Response:**
```json
{
  "content": "file content as string",
  "lines": 42,
  "isBinary": false
}
```

#### `POST /api/save`
Saves generated file collection.

**Body:** Raw text content

**Response:**
```json
{
  "success": true,
  "filePath": "/full/path/to/saved/file",
  "relativePath": "output_files_selected/filename.txt",
  "filename": "collected_files_timestamp.txt"
}
```

### Settings Endpoints

#### `GET /api/settings`
Retrieves current settings.

#### `POST /api/settings`
Saves settings configuration.

**Body:**
```json
{
  "defaultPath": "/path/to/project",
  "includeDockerFiles": true,
  "customPrompt": "Your context text",
  "projectTypes": {
    "django": true,
    "react": false
  }
}
```

### Specialized Endpoints

#### `POST /api/docker-files`
Finds Docker-related files.

#### `POST /api/project-files`
Finds project-specific files (Django/React).

#### `POST /api/browse-directory`
Opens native file browser (platform-specific).

## File Structure

### Frontend Components

#### `index.html`
Main application template with:
- Header with title and controls
- File content viewer with line numbers
- Resizable file explorer panel
- Modal dialogs for settings and content preview

#### `css/styles.css`
Core styling including:
- Dark theme design
- Responsive layout
- Modal and form styles
- File tree styling

#### `css/chunking.css`
Chunking-specific styles:
- Chunk navigation interface
- Progress indicators
- Accessibility features

#### `js/file-explorer.js`
Main application logic:
- `FileExplorer` class manages the entire application
- File tree rendering and navigation
- Dependency detection algorithms
- Chunking system implementation
- Settings management

### Backend Components

#### `server.js`
Express server with:
- Static file serving
- API route handlers
- File system operations
- Project type detection
- Cross-platform file browser integration

### Generated Files

#### `settings.json`
Persisted user settings:
```json
{
  "defaultPath": "/Users/username/projects/myapp",
  "includeDockerFiles": true,
  "customPrompt": "This is my project for...",
  "projectTypes": {
    "django": true,
    "react": false
  }
}
```

#### `output_files_selected/`
Directory containing generated file collections with timestamps.

## Configuration

### Environment Variables
The application uses these optional environment variables:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode

### File Limits
- Maximum file size for preview: 1MB
- Chunk size for large outputs: 350KB
- Maximum request body size: 50MB

### Ignored Patterns
The application automatically skips:
- Hidden files (starting with `.`)
- `node_modules/` directories
- `__pycache__/` directories
- `.pyc` files

## Development

### Running in Development Mode
```bash
# Install dependencies
npm install

# Start with auto-reload (if using nodemon)
npm run dev

# Or start normally
npm start
```

### Code Structure

#### Frontend Architecture
- **Event-driven**: Uses event listeners for user interactions
- **Modular**: Separated concerns for file operations, UI updates, and data management
- **Responsive**: Handles different screen sizes and device types

#### Backend Architecture
- **RESTful API**: Clean separation between frontend and backend
- **Async/Await**: Modern JavaScript for file system operations
- **Error Handling**: Comprehensive error management and user feedback

### Adding New Features

#### New Project Type
1. Add detection patterns to `server.js`
2. Create helper functions for file identification
3. Update frontend project type settings
4. Add new project type checkbox in settings modal

#### New File Operation
1. Add API endpoint in `server.js`
2. Create frontend method in `FileExplorer` class
3. Update UI components as needed
4. Add error handling and user feedback

### Testing Locally
- Test on different operating systems
- Verify with various project structures
- Check with large files and directories
- Validate chunking with extensive file collections

## Troubleshooting

### Common Issues

#### "Cannot read directory" errors
- **Cause**: Permission issues or path doesn't exist
- **Solution**: Check directory permissions, verify path exists

#### Files not appearing in browser
- **Cause**: Hidden files or ignored patterns
- **Solution**: Check if files match ignored patterns in `server.js`

#### Large files causing timeouts
- **Cause**: File size exceeds limits
- **Solution**: Increase limits in server configuration or exclude large files

#### Chunking not working
- **Cause**: JavaScript memory limits or file size issues
- **Solution**: Reduce chunk size in `FileExplorer` class

### Browser Compatibility
- **Supported**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Features requiring modern browsers**: Clipboard API, async/await

### Performance Optimization
- Limit directory depth for large projects
- Use file size limits for preview
- Enable chunking for large outputs
- Consider excluding build directories

### Security Considerations
- The application runs locally only
- No external network access required
- File system access limited to server process permissions
- No user authentication (local-only use)

---

## Support

For issues or questions:
1. Check this documentation first
2. Review the browser console for error messages
3. Verify file permissions and paths
4. Test with a smaller, simpler directory structure

This documentation covers the complete functionality of the Local File Explorer. The application is designed to be intuitive while providing powerful features for developers working with complex project structures.