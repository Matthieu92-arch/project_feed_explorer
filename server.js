const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const mimeTypes = require('mime-types');

const app = express();
const PORT = 3000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

const DJANGO_FILES = [
    'settings.py',
    'urls.py',
    'wsgi.py',
    'asgi.py',
    'models.py',
    'views.py',
    'admin.py',
    'forms.py',
    'serializers.py'
];

// React file patterns
const REACT_FILES = [
    'package.json',
    'src/index.js',
    'src/index.jsx',
    'src/main.jsx',
    'src/App.js',
    'src/App.jsx'
];

// Serve static files
app.use(express.static(__dirname));
app.use(express.json({ limit: '50mb' }));

// API Routes
app.get('/api/cwd', (req, res) => {
    res.json({ cwd: process.cwd() });
});

app.get('/api/directory/:path(*)', async (req, res) => {
    try {
        const dirPath = '/' + (req.params.path || '');
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const result = [];

        for (const item of items) {
            // Skip hidden files and common ignore patterns
            if (item.name.startsWith('.') ||
                item.name === 'node_modules' ||
                item.name === '__pycache__' ||
                item.name.endsWith('.pyc')) {
                continue;
            }

            const fullPath = path.join(dirPath, item.name);
            let stats;

            try {
                stats = await fs.stat(fullPath);
            } catch (error) {
                continue; // Skip files we can't read
            }

            result.push({
                name: item.name,
                type: item.isDirectory() ? 'directory' : 'file',
                path: fullPath,
                size: stats.size,
                modified: stats.mtime
            });
        }

        // Sort: directories first, then files, both alphabetically
        result.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name, undefined, { numeric: true });
        });

        res.json(result);
    } catch (error) {
        console.error('Error reading directory:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/file/:path(*)', async (req, res) => {
    try {
        const filePath = '/' + (req.params.path || '');
        const stats = await fs.stat(filePath);

        // Skip very large files
        if (stats.size > 1024 * 1024) { // 1MB limit
            return res.json({
                content: `// File too large to display (${(stats.size / 1024 / 1024).toFixed(2)}MB)`,
                lines: 0,
                isBinary: false
            });
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').length;

        res.json({
            content,
            lines,
            isBinary: false
        });
    } catch (error) {
        if (error.code === 'EISDIR') {
            return res.status(400).json({ error: 'Cannot read directory as file' });
        }

        // Try to read as binary to detect binary files
        try {
            const buffer = await fs.readFile('/' + (req.params.path || ''));
            const isBinary = buffer.includes(0);

            if (isBinary) {
                return res.json({
                    content: `// Binary file (${buffer.length} bytes)`,
                    lines: 0,
                    isBinary: true
                });
            }

            // Try to decode as text
            const content = buffer.toString('utf-8');
            res.json({
                content,
                lines: content.split('\n').length,
                isBinary: false
            });
        } catch (binaryError) {
            res.status(500).json({ error: `Cannot read file: ${error.message}` });
        }
    }
});

app.get('/api/exists/:path(*)', async (req, res) => {
    let originalPath;
    let filePath;
    try {
        originalPath = req.params.path;
        filePath = decodeURIComponent(originalPath);

        // If the path doesn't start with / or a drive letter, it might be an absolute path
        // that had its leading slash removed for the API call
        if (!path.isAbsolute(filePath) && !filePath.match(/^[A-Za-z]:/)) {
            // Try as absolute path first (add back the leading slash for Unix paths)
            filePath = '/' + filePath;
        }

        console.log(`🔍 Checking path existence: "${filePath}" (original: "${originalPath}")`);

        const stats = await fs.stat(filePath);
        const result = {
            exists: true,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            size: stats.isFile() ? stats.size : 0
        };

        console.log(`✅ Path check result for "${filePath}":`, result);
        res.json(result);
    } catch (error) {
        console.log(`❌ Path check failed for "${filePath || originalPath}": ${error.message}`);
        res.json({
            exists: false,
            isFile: false,
            isDirectory: false,
            size: 0
        });
    }
});

app.post('/api/save', express.raw({ type: 'text/plain', limit: '50mb' }), async (req, res) => {
    try {
        const content = req.body.toString();
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `collected_files_${timestamp}.txt`;

        // Create output directory path
        const outputDir = path.join(process.cwd(), 'output_files_selected');
        const filePath = path.join(outputDir, filename);

        // Ensure the output directory exists
        try {
            await fs.mkdir(outputDir, { recursive: true });
            console.log(`📁 Output directory ensured: ${outputDir}`);
        } catch (error) {
            console.error('Error creating output directory:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to create output directory'
            });
        }

        // Write the file
        await fs.writeFile(filePath, content, 'utf-8');
        console.log(`💾 File saved: ${filePath}`);

        // Get relative path for display
        const relativePath = path.relative(process.cwd(), filePath);

        res.json({
            success: true,
            filePath: filePath,
            relativePath: relativePath,
            filename: filename,
            outputDirectory: outputDir
        });
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 File Explorer running at http://localhost:${PORT}`);
    console.log(`📁 Root directory: ${process.cwd()}`);

    // Try to open browser automatically
    const open = (url) => {
        const { exec } = require('child_process');
        const cmd = process.platform === 'darwin' ? 'open' :
                   process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${cmd} ${url}`);
    };

    setTimeout(() => open(`http://localhost:${PORT}`), 1000);
});

// Settings file path
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// Docker file patterns
const DOCKER_FILES = [
    'Dockerfile',
    'dockerfile',
    'Dockerfile.*',
    'docker-compose.yml',
    'docker-compose.yaml',
    'docker-compose.*.yml',
    'docker-compose.*.yaml',
    '.dockerignore',
    'docker-entrypoint.sh',
    '.docker',
    'docker'
];

// Helper function to check if a filename matches Docker patterns
function isDockerFile(filename) {
    const lowerName = filename.toLowerCase();
    return DOCKER_FILES.some(pattern => {
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
            return regex.test(filename);
        }
        return lowerName === pattern.toLowerCase() ||
               lowerName.includes('dockerfile') ||
               lowerName.startsWith('docker-compose');
    });
}

// Helper function to recursively find Docker files
async function findDockerFiles(startPath, basePath = startPath) {
    const dockerFiles = [];

    try {
        const items = await fs.readdir(startPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(startPath, item.name);

            if (item.isFile() && isDockerFile(item.name)) {
                const relativePath = path.relative(basePath, fullPath);
                dockerFiles.push({
                    name: item.name,
                    path: fullPath,
                    relativePath: relativePath,
                    directory: path.dirname(fullPath)
                });
            } else if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
                // Recursively search subdirectories, but skip hidden dirs and node_modules
                const subDockerFiles = await findDockerFiles(fullPath, basePath);
                dockerFiles.push(...subDockerFiles);
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${startPath}:`, error.message);
    }

    return dockerFiles;
}

// Get settings
app.get('/api/settings', async (req, res) => {
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);
        res.json(settings);
    } catch (error) {
        // Return default settings if file doesn't exist
        res.json({
            defaultPath: '',
            includeDockerFiles: false,
            customPrompt: ''
        });
    }
});

// Save settings
app.post('/api/settings', async (req, res) => {
    try {
        const settings = req.body;

        // Validate settings
        if (typeof settings.defaultPath !== 'string' ||
            typeof settings.includeDockerFiles !== 'boolean' ||
            typeof settings.customPrompt !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid settings format'
            });
        }

        // Validate default path exists if provided
        if (settings.defaultPath) {
            try {
                const stats = await fs.stat(settings.defaultPath);
                if (!stats.isDirectory()) {
                    return res.status(400).json({
                        success: false,
                        error: 'Default path is not a directory'
                    });
                }
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Default path does not exist'
                });
            }
        }

        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save settings'
        });
    }
});

// Find Docker files
app.post('/api/docker-files', async (req, res) => {
    try {
        const { startPath } = req.body;

        if (!startPath) {
            return res.status(400).json({
                error: 'Start path is required'
            });
        }

        // Verify the start path exists
        try {
            const stats = await fs.stat(startPath);
            if (!stats.isDirectory()) {
                return res.status(400).json({
                    error: 'Start path is not a directory'
                });
            }
        } catch (error) {
            return res.status(400).json({
                error: 'Start path does not exist'
            });
        }

        // Find Docker files starting from the given path and going up to find more
        let dockerFiles = [];

        // Search in current directory and subdirectories
        const currentDirFiles = await findDockerFiles(startPath);
        dockerFiles.push(...currentDirFiles);

        // Search in parent directories (up to 3 levels)
        let currentPath = startPath;
        for (let i = 0; i < 3; i++) {
            const parentPath = path.dirname(currentPath);
            if (parentPath === currentPath) break; // Reached root

            try {
                const items = await fs.readdir(parentPath, { withFileTypes: true });
                for (const item of items) {
                    if (item.isFile() && isDockerFile(item.name)) {
                        const fullPath = path.join(parentPath, item.name);
                        const relativePath = path.relative(startPath, fullPath);
                        dockerFiles.push({
                            name: item.name,
                            path: fullPath,
                            relativePath: relativePath,
                            directory: parentPath
                        });
                    }
                }
            } catch (error) {
                // Ignore errors when scanning parent directories
            }

            currentPath = parentPath;
        }

        // Remove duplicates based on path
        const uniqueFiles = dockerFiles.filter((file, index, self) =>
            index === self.findIndex(f => f.path === file.path)
        );

        // Sort by name for consistent ordering
        uniqueFiles.sort((a, b) => a.name.localeCompare(b.name));

        console.log(`🐳 Found ${uniqueFiles.length} Docker files from ${startPath}`);
        res.json(uniqueFiles);
    } catch (error) {
        console.error('Error finding Docker files:', error);
        res.status(500).json({
            error: 'Failed to find Docker files'
        });
    }
});

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Add this endpoint to your server.js
app.post('/api/browse-directory', async (req, res) => {
    try {
        let selectedPath = null;
        const platform = process.platform;

        if (platform === 'darwin') {
            // macOS - use osascript with AppleScript
            const script = `
                tell application "System Events"
                    activate
                end tell
                set selectedFolder to (choose folder with prompt "Select Directory") as string
                set posixPath to POSIX path of selectedFolder
                return posixPath
            `;

            try {
                const { stdout, stderr } = await execAsync(`osascript -e '${script}'`);
                if (stderr) {
                    console.error('AppleScript error:', stderr);
                    return res.json({ success: false, error: 'User cancelled or error occurred' });
                }
                selectedPath = stdout.trim();
                // Remove trailing slash if present
                if (selectedPath.endsWith('/') && selectedPath.length > 1) {
                    selectedPath = selectedPath.slice(0, -1);
                }
            } catch (error) {
                console.error('Error executing AppleScript:', error);
                return res.json({ success: false, error: 'User cancelled or error occurred' });
            }

        } else if (platform === 'win32') {
            // Windows - use PowerShell
            const script = `
                Add-Type -AssemblyName System.Windows.Forms
                $folder = New-Object System.Windows.Forms.FolderBrowserDialog
                $folder.Description = "Select Directory"
                $folder.ShowNewFolderButton = $true
                if ($folder.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                    Write-Output $folder.SelectedPath
                }
            `;

            try {
                const { stdout, stderr } = await execAsync(`powershell -Command "${script.replace(/"/g, '\\"')}"`);
                if (stderr || !stdout.trim()) {
                    return res.json({ success: false, error: 'User cancelled or error occurred' });
                }
                selectedPath = stdout.trim();
            } catch (error) {
                console.error('Error executing PowerShell:', error);
                return res.json({ success: false, error: 'User cancelled or error occurred' });
            }

        } else {
            // Linux - use zenity (if available)
            try {
                const { stdout, stderr } = await execAsync('zenity --file-selection --directory --title="Select Directory"');
                if (stderr || !stdout.trim()) {
                    return res.json({ success: false, error: 'User cancelled or zenity not available' });
                }
                selectedPath = stdout.trim();
            } catch (error) {
                console.error('Error executing zenity:', error);
                return res.json({ success: false, error: 'zenity not available or user cancelled' });
            }
        }

        if (selectedPath) {
            // Verify the selected path exists and is a directory
            try {
                const stats = await fs.stat(selectedPath);
                if (stats.isDirectory()) {
                    res.json({ success: true, path: selectedPath });
                } else {
                    res.json({ success: false, error: 'Selected path is not a directory' });
                }
            } catch (error) {
                res.json({ success: false, error: 'Selected path does not exist' });
            }
        } else {
            res.json({ success: false, error: 'No path selected' });
        }

    } catch (error) {
        console.error('Error in browse-directory:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Helper function to check if a filename matches Django patterns
function isDjangoFile(filename, filePath) {
    const lowerName = filename.toLowerCase();
    return DJANGO_FILES.some(pattern => lowerName === pattern.toLowerCase()) ||
           filePath.includes('settings.py') ||
           filePath.includes('urls.py') ||
           filePath.includes('models.py') ||
           filePath.includes('views.py') ||
           filePath.includes('admin.py') ||
           filePath.includes('forms.py') ||
           filePath.includes('serializers.py') ||
           filePath.includes('wsgi.py') ||
           filePath.includes('asgi.py');
}

// Helper function to check if a filename matches React patterns
function isReactFile(filename, filePath) {
    const lowerName = filename.toLowerCase();
    // Check for package.json
    if (lowerName === 'package.json') return true;

    // Check for React entry points in src directory
    const reactEntryPoints = [
        'src/index.js',
        'src/index.jsx',
        'src/main.jsx',
        'src/app.js',
        'src/app.jsx'
    ];

    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    return reactEntryPoints.some(pattern =>
        normalizedPath.includes(pattern.toLowerCase())
    );
}

// Helper function to recursively find Django files
async function findDjangoFiles(startPath, basePath = startPath) {
    const djangoFiles = [];

    try {
        const items = await fs.readdir(startPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(startPath, item.name);

            if (item.isFile() && isDjangoFile(item.name, fullPath)) {
                const relativePath = path.relative(basePath, fullPath);
                djangoFiles.push({
                    name: item.name,
                    path: fullPath,
                    relativePath: relativePath,
                    directory: path.dirname(fullPath),
                    type: getDjangoFileType(item.name, fullPath)
                });
            } else if (item.isDirectory() &&
                      !item.name.startsWith('.') &&
                      item.name !== 'node_modules' &&
                      item.name !== '__pycache__' &&
                      item.name !== 'migrations' &&
                      item.name !== 'venv' &&
                      item.name !== 'env') {
                // Recursively search subdirectories, but skip common ignore patterns
                try {
                    const subDjangoFiles = await findDjangoFiles(fullPath, basePath);
                    djangoFiles.push(...subDjangoFiles);
                } catch (error) {
                    // Skip directories we can't access
                    console.log(`Skipping directory ${fullPath}: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${startPath}:`, error.message);
    }

    return djangoFiles;
}

// Helper function to recursively find React files
async function findReactFiles(startPath, basePath = startPath) {
    const reactFiles = [];

    try {
        const items = await fs.readdir(startPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(startPath, item.name);

            if (item.isFile() && isReactFile(item.name, fullPath)) {
                const relativePath = path.relative(basePath, fullPath);
                reactFiles.push({
                    name: item.name,
                    path: fullPath,
                    relativePath: relativePath,
                    directory: path.dirname(fullPath),
                    type: getReactFileType(item.name, fullPath)
                });
            } else if (item.isDirectory() &&
                      !item.name.startsWith('.') &&
                      item.name !== 'node_modules' &&
                      item.name !== 'build' &&
                      item.name !== 'dist' &&
                      item.name !== 'coverage') {
                // Recursively search subdirectories, but skip common ignore patterns
                try {
                    const subReactFiles = await findReactFiles(fullPath, basePath);
                    reactFiles.push(...subReactFiles);
                } catch (error) {
                    // Skip directories we can't access
                    console.log(`Skipping directory ${fullPath}: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${startPath}:`, error.message);
    }

    return reactFiles;
}

// Helper function to categorize Django file types
function getDjangoFileType(filename, filePath) {
    const lowerName = filename.toLowerCase();
    if (lowerName === 'settings.py') return 'core-config';
    if (lowerName === 'urls.py') return filePath.includes('app') ? 'app-urls' : 'project-urls';
    if (lowerName === 'wsgi.py' || lowerName === 'asgi.py') return 'deployment';
    if (lowerName === 'models.py') return 'data-model';
    if (lowerName === 'views.py') return 'business-logic';
    if (lowerName === 'admin.py') return 'admin-interface';
    if (lowerName === 'forms.py') return 'user-input';
    if (lowerName === 'serializers.py') return 'api-serialization';
    return 'django-file';
}

// Helper function to categorize React file types
function getReactFileType(filename, filePath) {
    const lowerName = filename.toLowerCase();
    if (lowerName === 'package.json') return 'dependency-config';
    if (filePath.toLowerCase().includes('index.js') ||
        filePath.toLowerCase().includes('index.jsx') ||
        filePath.toLowerCase().includes('main.jsx')) return 'entry-point';
    if (filePath.toLowerCase().includes('app.js') ||
        filePath.toLowerCase().includes('app.jsx')) return 'main-component';
    return 'react-file';
}

// ADD THIS NEW API ENDPOINT TO YOUR server.js FILE
// (Add it before the final server.listen() call)

app.post('/api/project-files', async (req, res) => {
    try {
        const { projectType, startPath } = req.body;

        if (!projectType || !startPath) {
            return res.status(400).json({
                error: 'Project type and start path are required'
            });
        }

        // Verify the start path exists
        try {
            const stats = await fs.stat(startPath);
            if (!stats.isDirectory()) {
                return res.status(400).json({
                    error: 'Start path is not a directory'
                });
            }
        } catch (error) {
            return res.status(400).json({
                error: 'Start path does not exist'
            });
        }

        let projectFiles = [];

        if (projectType === 'django') {
            // Find Django files starting from the given path and going up to find more
            projectFiles = await findDjangoFiles(startPath);

            // Also search in parent directories (up to 3 levels) for project-level files
            let currentPath = startPath;
            for (let i = 0; i < 3; i++) {
                const parentPath = path.dirname(currentPath);
                if (parentPath === currentPath) break; // Reached root

                try {
                    const items = await fs.readdir(parentPath, { withFileTypes: true });
                    for (const item of items) {
                        if (item.isFile() && isDjangoFile(item.name, path.join(parentPath, item.name))) {
                            const fullPath = path.join(parentPath, item.name);
                            const relativePath = path.relative(startPath, fullPath);

                            // Only add if not already found
                            if (!projectFiles.some(f => f.path === fullPath)) {
                                projectFiles.push({
                                    name: item.name,
                                    path: fullPath,
                                    relativePath: relativePath,
                                    directory: parentPath,
                                    type: getDjangoFileType(item.name, fullPath)
                                });
                            }
                        }
                    }
                } catch (error) {
                    // Ignore errors when scanning parent directories
                }

                currentPath = parentPath;
            }

        } else if (projectType === 'react') {
            // Find React files starting from the given path
            projectFiles = await findReactFiles(startPath);

            // Also search in parent directories (up to 2 levels) for package.json
            let currentPath = startPath;
            for (let i = 0; i < 2; i++) {
                const parentPath = path.dirname(currentPath);
                if (parentPath === currentPath) break; // Reached root

                try {
                    const packageJsonPath = path.join(parentPath, 'package.json');
                    const stats = await fs.stat(packageJsonPath);
                    if (stats.isFile()) {
                        const relativePath = path.relative(startPath, packageJsonPath);

                        // Only add if not already found
                        if (!projectFiles.some(f => f.path === packageJsonPath)) {
                            projectFiles.push({
                                name: 'package.json',
                                path: packageJsonPath,
                                relativePath: relativePath,
                                directory: parentPath,
                                type: 'dependency-config'
                            });
                        }
                    }
                } catch (error) {
                    // Ignore if package.json doesn't exist in parent
                }

                currentPath = parentPath;
            }

        } else {
            return res.status(400).json({
                error: 'Invalid project type. Supported types: django, react'
            });
        }

        // Remove duplicates based on path
        const uniqueFiles = projectFiles.filter((file, index, self) =>
            index === self.findIndex(f => f.path === file.path)
        );

        // Sort by type priority and then by name for consistent ordering
        uniqueFiles.sort((a, b) => {
            // Priority order for Django files
            const djangoPriority = {
                'core-config': 1,
                'project-urls': 2,
                'deployment': 3,
                'data-model': 4,
                'business-logic': 5,
                'app-urls': 6,
                'admin-interface': 7,
                'user-input': 8,
                'api-serialization': 9
            };

            // Priority order for React files
            const reactPriority = {
                'dependency-config': 1,
                'entry-point': 2,
                'main-component': 3
            };

            if (projectType === 'django') {
                const aPriority = djangoPriority[a.type] || 10;
                const bPriority = djangoPriority[b.type] || 10;
                if (aPriority !== bPriority) return aPriority - bPriority;
            } else if (projectType === 'react') {
                const aPriority = reactPriority[a.type] || 10;
                const bPriority = reactPriority[b.type] || 10;
                if (aPriority !== bPriority) return aPriority - bPriority;
            }

            return a.name.localeCompare(b.name);
        });

        console.log(`🔧 Found ${uniqueFiles.length} ${projectType} files from ${startPath}`);
        res.json(uniqueFiles);
    } catch (error) {
        console.error(`Error finding ${projectType || 'project'} files:`, error);
        res.status(500).json({
            error: `Failed to find ${projectType || 'project'} files`
        });
    }
});