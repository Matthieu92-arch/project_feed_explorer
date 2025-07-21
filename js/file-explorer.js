class FileExplorer {
    constructor() {
        this.currentPath = '';
        this.selectedFiles = new Set();
        this.fileContents = new Map();
        this.expandedDirectories = new Set();
        this.settings = {
            defaultPath: '',
            includeDockerFiles: false,
            customPrompt: '',
            projectTypes: {
                django: false,
                react: false
            }
        };
        this.dockerFiles = [];
        this.djangoFiles = [];
        this.reactFiles = [];
        this.fileDependencies = new Map();
        this.dependencyOwners = new Map();
        this.generatedFileContent = '';

        // Chunking properties
        this.fileChunks = [];
        this.currentChunkIndex = 0;
        this.chunkSize = 100000;

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupSuccessModalListeners();

        // Load settings first
        await this.loadSettings();

        // Start from settings default path or server's current working directory
        if (this.settings.defaultPath && await this.directoryExists(this.settings.defaultPath)) {
            this.currentPath = this.settings.defaultPath;
        } else {
            this.currentPath = await this.getCurrentWorkingDirectory();
        }

        document.getElementById('currentPath').textContent = this.currentPath;
        await this.loadDirectory(this.currentPath);

        // Scan for Docker files if enabled
        if (this.settings.includeDockerFiles) {
            await this.scanForDockerFiles();
        }

        if (this.settings.defaultPath &&
            (this.settings.projectTypes.django || this.settings.projectTypes.react)) {
            await this.scanForProjectFiles();
        }

        // Setup resizer after everything else is loaded
        this.setupResizer();

        // Make this instance globally accessible for the browse button
        window.fileExplorer = this;
    }

    // Settings Management
    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                const settings = await response.json();
                this.settings = { ...this.settings, ...settings };
                console.log('✅ Settings loaded:', this.settings);
            }
        } catch (error) {
            console.log('⚠️ No settings found, using defaults');
        }
    }

    async saveSettings() {
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.settings)
            });

            if (response.ok) {
                console.log('✅ Settings saved successfully');
                return true;
            } else {
                console.error('❌ Failed to save settings');
                return false;
            }
        } catch (error) {
            console.error('❌ Error saving settings:', error);
            return false;
        }
    }

    // File Chunking Methods
    splitIntoChunks(content, chunkSize = 350000) {
        const chunks = [];

        // Check if this content has pasting instructions
        const hasPastingInstructions = content.startsWith(`I'm going to paste multiple parts`);

        // If content fits in one chunk and has no pasting instructions, return as single chunk
        if (!hasPastingInstructions && content.length <= chunkSize) {
            const chunkLabel = 'a';
            chunks.push({
                index: 0,
                label: chunkLabel,
                filename: `file_${chunkLabel}`,
                content: content,
                size: content.length,
                startPos: 0,
                endPos: content.length
            });
            return chunks;
        }

        // For content with pasting instructions OR content that needs chunking
        let currentIndex = 0;
        let chunkNumber = 1;

        while (currentIndex < content.length) {
            let finalChunk;
            let contentLength;

            if (hasPastingInstructions) {
                // Add "Part X:" prefix for pasting instructions
                const partPrefix = `Part ${chunkNumber}:\n\n`;
                const endPrefix = `--- wait for Part ${chunkNumber + 1}, only respond with "Ready for next one boss."---`;
                const availableContentSpace = chunkSize - partPrefix.length;

                // Get the content chunk (but don't exceed remaining content)
                const remainingContent = content.length - currentIndex;
                contentLength = Math.min(availableContentSpace, remainingContent);
                const contentChunk = content.substring(currentIndex, currentIndex + contentLength);

                // Create the final chunk with prefix
                finalChunk = partPrefix + contentChunk + endPrefix;
            } else {
                // No pasting instructions, just chunk normally
                const remainingContent = content.length - currentIndex;
                contentLength = Math.min(chunkSize, remainingContent);
                finalChunk = content.substring(currentIndex, currentIndex + contentLength);
            }

            const chunkLabel = String.fromCharCode(96 + chunkNumber); // 'a', 'b', 'c', etc.
            const filename = hasPastingInstructions ? `part_${chunkNumber}` : `file_${chunkLabel}`;

            chunks.push({
                index: chunkNumber - 1,
                label: chunkLabel,
                filename: filename,
                content: finalChunk,
                size: finalChunk.length,
                startPos: currentIndex,
                endPos: currentIndex + contentLength,
                partNumber: chunkNumber
            });

            // Move to next chunk
            currentIndex += contentLength;
            chunkNumber++;
        }

        return chunks;
    }

    createChunkNavigation() {
        const navigation = document.createElement('div');
        navigation.className = 'chunk-navigation';

        const instructionText = this.fileChunks.length > 1 && this.fileChunks[0].content.startsWith(`I'm going to paste multiple parts`)
            ? 'AI-ready parts for sequential pasting'
            : 'File split into chunks';

        navigation.innerHTML = `
            <div class="chunk-nav-header">
                <span class="chunk-info">${instructionText} - ${this.fileChunks.length} parts (${this.chunkSize.toLocaleString()} chars each)</span>
            </div>
            <div class="chunk-buttons" id="chunkButtons">
                ${this.fileChunks.map((chunk, index) => `
                    <button class="chunk-btn ${index === 0 ? 'active' : ''}" 
                            data-chunk-index="${index}" 
                            id="chunkBtn${index}">
                        <div class="chunk-btn-label">${chunk.filename}</div>
                        <div class="chunk-btn-size">${this.formatFileSize(chunk.size)}</div>
                    </button>
                `).join('')}
            </div>
        `;

        return navigation;
    }

    switchToChunk(chunkIndex) {
        if (chunkIndex < 0 || chunkIndex >= this.fileChunks.length) return;

        // Add loading state
        const contentDisplayModal = document.getElementById('contentDisplayModal');
        contentDisplayModal.classList.add('chunk-loading');

        // Simulate loading delay for smooth UX
        setTimeout(() => {
            this.currentChunkIndex = chunkIndex;
            const chunk = this.fileChunks[chunkIndex];

            // Update content display
            const generatedContent = document.getElementById('generatedContent');
            if (generatedContent) {
                generatedContent.textContent = chunk.content;
            }

            // Update active button
            document.querySelectorAll('.chunk-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            const activeBtn = document.getElementById(`chunkBtn${chunkIndex}`);
            if (activeBtn) {
                activeBtn.classList.add('active');
                activeBtn.setAttribute('aria-pressed', 'true');
            }

            // Update copy button text
            const copyBtn = document.getElementById('copyContentBtn');
            if (copyBtn) {
                copyBtn.textContent = `📋 Copy ${chunk.filename}`;
            }

            // Update modal header to show current chunk
            const modalHeader = document.querySelector('#contentModal .modal-header h2');
            if (modalHeader) {
                modalHeader.textContent = `📄 ${chunk.filename} (${chunkIndex + 1}/${this.fileChunks.length})`;
            }

            // Update chunk info
            this.updateChunkInfo();

            // Scroll to top
            contentDisplayModal.scrollTop = 0;

            // Remove loading state
            contentDisplayModal.classList.remove('chunk-loading');

            console.log(`📦 Switched to chunk ${chunkIndex + 1}/${this.fileChunks.length}: ${chunk.filename}`);
        }, 150);
    }

    async copyAllChunks() {
        try {
            let allContent = '';
            this.fileChunks.forEach((chunk, index) => {
                allContent += `=== ${chunk.filename} (${index + 1}/${this.fileChunks.length}) ===\n\n`;
                allContent += chunk.content;
                if (index < this.fileChunks.length - 1) {
                    allContent += '\n\n' + '='.repeat(80) + '\n\n';
                }
            });

            await navigator.clipboard.writeText(allContent);

            const copyAllBtn = document.getElementById('copyAllChunksBtn');
            const originalText = copyAllBtn.textContent;

            copyAllBtn.textContent = '✅ All Chunks Copied!';
            copyAllBtn.classList.add('copied');

            setTimeout(() => {
                copyAllBtn.textContent = originalText;
                copyAllBtn.classList.remove('copied');
            }, 3000);

        } catch (error) {
            console.error('Failed to copy all chunks:', error);
            alert('❌ Failed to copy all chunks. Try copying individual chunks instead.');
        }
    }

    downloadAllChunks() {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

        this.fileChunks.forEach((chunk, index) => {
            setTimeout(() => {
                const filename = `${chunk.filename}_${timestamp}.txt`;
                const blob = new Blob([chunk.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';

                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                URL.revokeObjectURL(url);
            }, index * 500); // Stagger downloads by 500ms
        });

        alert(`📥 Downloading ${this.fileChunks.length} chunk files...`);
    }

    updateChunkInfo() {
        const chunkInfoItem = document.getElementById('chunkInfoItem');
        const currentChunkInfo = document.getElementById('currentChunkInfo');

        if (this.fileChunks.length > 1) {
            chunkInfoItem.style.display = 'flex';
            currentChunkInfo.textContent = `${this.currentChunkIndex + 1}/${this.fileChunks.length}`;
        } else {
            chunkInfoItem.style.display = 'none';
        }
    }

    handleChunkKeyNavigation(event) {
        if (!document.getElementById('contentModal').classList.contains('hidden')) {
            if (event.key === 'ArrowLeft' && this.currentChunkIndex > 0) {
                event.preventDefault();
                this.switchToChunk(this.currentChunkIndex - 1);
            } else if (event.key === 'ArrowRight' && this.currentChunkIndex < this.fileChunks.length - 1) {
                event.preventDefault();
                this.switchToChunk(this.currentChunkIndex + 1);
            } else if (event.key === 'Home') {
                event.preventDefault();
                this.switchToChunk(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                this.switchToChunk(this.fileChunks.length - 1);
            }
        }
    }

    // Project File Scanning
    async scanForProjectFiles() {
        if (!this.settings.defaultPath) {
            console.log('⚠️ No default path set, skipping project file scan');
            return;
        }

        try {
            let scannedFiles = [];

            if (this.settings.projectTypes.django) {
                console.log('🐍 Scanning for Django files...');
                this.djangoFiles = await this.findProjectFiles('django', this.settings.defaultPath);
                scannedFiles.push(...this.djangoFiles);
                console.log(`🐍 Found ${this.djangoFiles.length} Django files`);
            }

            if (this.settings.projectTypes.react) {
                console.log('⚛️ Scanning for React files...');
                this.reactFiles = await this.findProjectFiles('react', this.settings.defaultPath);
                scannedFiles.push(...this.reactFiles);
                console.log(`⚛️ Found ${this.reactFiles.length} React files`);
            }

            scannedFiles.forEach(projectFile => {
                this.selectedFiles.add(projectFile.path);
            });

            this.updateValidateButton();
            this.updateVisibleCheckboxes();

        } catch (error) {
            console.error('Error scanning for project files:', error);
        }
    }

    async findProjectFiles(projectType, startPath) {
        const response = await fetch('/api/project-files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                projectType: projectType,
                startPath: startPath
            })
        });

        if (response.ok) {
            return await response.json();
        } else {
            console.error(`Error finding ${projectType} files:`, response.statusText);
            return [];
        }
    }

    // Directory and File Operations
    async directoryExists(path) {
        try {
            let apiPath;
            if (path.startsWith('/')) {
                apiPath = path.substring(1);
            } else if (path.match(/^[A-Za-z]:/)) {
                apiPath = path;
            } else {
                apiPath = path;
            }

            const encodedPath = encodeURIComponent(apiPath);
            const response = await fetch(`/api/exists/${encodedPath}`);
            const result = await response.json();
            return result.exists && result.isDirectory;
        } catch (error) {
            console.error('Error checking directory:', error);
            return false;
        }
    }

    async getCurrentWorkingDirectory() {
        try {
            const response = await fetch('/api/cwd');
            const data = await response.json();
            return data.cwd;
        } catch (error) {
            console.error('Error getting current directory:', error);
            return '/';
        }
    }

    async loadDirectory(path) {
        try {
            const tree = document.getElementById('fileTree');
            tree.innerHTML = '<div class="loading">🔄 Loading files...</div>';

            const encodedPath = encodeURIComponent(path.substring(1));
            const response = await fetch(`/api/directory/${encodedPath}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const files = await response.json();
            this.renderFileTree(files, path);
            this.updateBreadcrumb(path);
            this.currentPath = path;
        } catch (error) {
            console.error('Error loading directory:', error);
            const tree = document.getElementById('fileTree');
            tree.innerHTML = `<div class="error">❌ Error loading directory: ${error.message}</div>`;
        }
    }

    async changeRootDirectory() {
        const newPath = await this.openNativeFileBrowser();
        if (newPath && newPath !== this.currentPath) {
            try {
                await this.loadDirectory(newPath);
                document.getElementById('currentPath').textContent = newPath;
                this.selectedFiles.clear();
                this.fileContents.clear();
                this.expandedDirectories.clear();
                this.fileDependencies.clear();
                this.dependencyOwners.clear();
                this.currentPath = newPath;

                if (this.settings.includeDockerFiles) {
                    await this.scanForDockerFiles();
                }

                this.updateValidateButton();
            } catch (error) {
                alert(`Error accessing directory: ${error.message}`);
            }
        }
    }

    async openNativeFileBrowser() {
        try {
            const response = await fetch('/api/browse-directory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success && result.path) {
                return result.path;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error opening file browser:', error);
            return null;
        }
    }

    // File Tree Rendering
    renderFileTree(files, basePath) {
        const tree = document.getElementById('fileTree');
        tree.innerHTML = '';

        if (files.length === 0) {
            tree.innerHTML = '<div class="empty-state">📂 No files found</div>';
            return;
        }

        files.forEach(file => {
            const item = this.createFileItem(file, basePath);
            tree.appendChild(item);
        });
    }

    createFileItem(file, basePath) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.path = file.path;
        item.dataset.type = file.type;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox';
        checkbox.checked = this.selectedFiles.has(file.path);
        checkbox.addEventListener('change', (e) => {
            this.handleManualFileSelection(file, e.target.checked);
            this.handleFileSelection(file, e.target.checked);
        });

        const icon = document.createElement('div');
        icon.className = 'file-icon';

        if (file.type === 'directory') {
            const arrow = document.createElement('div');
            arrow.className = 'directory-arrow';
            if (this.expandedDirectories.has(file.path)) {
                arrow.classList.add('expanded');
            }
            item.appendChild(arrow);
            icon.innerHTML = '📁';
        } else {
            icon.innerHTML = this.getFileIcon(file.name);
        }

        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = file.name;

        const size = document.createElement('span');
        size.className = 'file-size';
        if (file.type === 'file') {
            size.textContent = this.formatFileSize(file.size);
        }

        item.appendChild(checkbox);
        item.appendChild(icon);
        item.appendChild(name);
        if (file.type === 'file') {
            item.appendChild(size);
        }

        // Add indicators for special file types
        this.addFileIndicators(item, file);

        // Add click handlers
        if (file.type === 'directory') {
            name.addEventListener('click', () => this.loadDirectory(file.path));
            item.querySelector('.directory-arrow').addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDirectory(item, file.path);
            });
        } else {
            name.addEventListener('click', () => this.loadFileContent(file));
        }

        return item;
    }

    addFileIndicators(item, file) {
        // Add Docker indicator
        if (this.dockerFiles.some(dockerFile => dockerFile.path === file.path)) {
            const dockerIndicator = document.createElement('span');
            dockerIndicator.className = 'dependency-indicator';
            dockerIndicator.textContent = '🐳';
            dockerIndicator.title = 'Docker file (auto-included)';
            dockerIndicator.style.background = '#0066cc';
            item.appendChild(dockerIndicator);
        }

        // Add Django indicator
        if (this.djangoFiles.some(djangoFile => djangoFile.path === file.path)) {
            const djangoIndicator = document.createElement('span');
            djangoIndicator.className = 'dependency-indicator';
            djangoIndicator.textContent = '🐍';
            djangoIndicator.title = 'Django file (auto-included)';
            djangoIndicator.style.background = '#092e20';
            djangoIndicator.style.color = '#7fb069';
            item.appendChild(djangoIndicator);
        }

        // Add React indicator
        if (this.reactFiles.some(reactFile => reactFile.path === file.path)) {
            const reactIndicator = document.createElement('span');
            reactIndicator.className = 'dependency-indicator';
            reactIndicator.textContent = '⚛️';
            reactIndicator.title = 'React file (auto-included)';
            reactIndicator.style.background = '#61dafb';
            reactIndicator.style.color = '#000';
            item.appendChild(reactIndicator);
        }
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const iconMap = {
            'js': '🟨', 'jsx': '🟨', 'ts': '🔷', 'tsx': '🔷',
            'py': '🐍', 'json': '⚙️', 'md': '📝', 'css': '🎨',
            'scss': '🎨', 'html': '🌐', 'txt': '📃', 'yml': '📄',
            'yaml': '📄', 'xml': '📄', 'svg': '🖼️', 'png': '🖼️',
            'jpg': '🖼️', 'jpeg': '🖼️', 'gif': '🖼️', 'pdf': '📕',
            'zip': '📦', 'tar': '📦', 'gz': '📦'
        };

        // Special handling for Docker files
        if (filename.toLowerCase().includes('dockerfile') ||
            filename === 'docker-compose.yml' ||
            filename === 'docker-compose.yaml' ||
            filename === '.dockerignore') {
            return '🐳';
        }

        return iconMap[ext] || '📄';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // File Selection and Dependencies
    async handleFileSelection(file, isSelected) {
        if (isSelected) {
            this.selectedFiles.add(file.path);
            if (file.type === 'file') {
                await this.analyzeFileDependencies(file);
            } else if (file.type === 'directory') {
                await this.selectDirectoryContents(file.path);
            }
        } else {
            this.selectedFiles.delete(file.path);

            const wasDockerFile = this.dockerFiles.some(dockerFile => dockerFile.path === file.path);
            const wasDjangoFile = this.djangoFiles.some(djangoFile => djangoFile.path === file.path);
            const wasReactFile = this.reactFiles.some(reactFile => reactFile.path === file.path);

            if (wasDockerFile || wasDjangoFile || wasReactFile) {
                let fileType = '';
                if (wasDockerFile) fileType = 'Docker';
                if (wasDjangoFile) fileType = 'Django';
                if (wasReactFile) fileType = 'React';

                const confirmDeselect = confirm(
                    `This file was auto-selected as a ${fileType} file. ` +
                    `Deselecting it may affect your project analysis. ` +
                    `Continue with deselection?`
                );

                if (!confirmDeselect) {
                    this.selectedFiles.add(file.path);
                    this.updateVisibleCheckboxes();
                    return;
                }
            }

            if (file.type === 'file') {
                await this.removeDependencies(file.path);
            } else if (file.type === 'directory') {
                await this.deselectDirectoryContents(file.path);
            }
        }

        this.updateValidateButton();
        this.updateVisibleCheckboxes();
    }

    handleManualFileSelection(file, isSelected) {
        if (isSelected) {
            const fileItem = document.querySelector(`[data-path="${file.path}"]`);
            if (fileItem) {
                const indicator = fileItem.querySelector('.dependency-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }
        }
    }

    async analyzeFileDependencies(file) {
    try {
        console.log('🔍 Analyzing dependencies for:', file.path);
        const content = await this.getFileContent(file.path);
        if (!content || content.isBinary) {
            console.log('❌ Cannot analyze dependencies - file is binary or unreadable');
            return;
        }

        const dependencies = this.extractDependencies(content.content, file.path);
        console.log('🔗 Found dependencies:', dependencies);

        const allResolvedPaths = [];
        for (const dependency of dependencies) {
            console.log('⚡ Resolving dependency:', dependency);
            const resolvedPaths = await this.resolvePath(file.path, dependency);
            if (resolvedPaths && resolvedPaths.length > 0) {
                console.log('✅ Resolved to:', resolvedPaths);
                allResolvedPaths.push(...resolvedPaths);
            } else {
                console.log('❌ Could not resolve:', dependency.relativePath);
            }
        }

        // Remove duplicates
        const uniqueResolvedPaths = [...new Set(allResolvedPaths)];
        this.fileDependencies.set(file.path, new Set(uniqueResolvedPaths));

        for (const depPath of uniqueResolvedPaths) {
            if (!this.selectedFiles.has(depPath)) {
                this.selectedFiles.add(depPath);

                if (!this.dependencyOwners.has(depPath)) {
                    this.dependencyOwners.set(depPath, new Set());
                }
                this.dependencyOwners.get(depPath).add(file.path);

                const checkbox = document.querySelector(`[data-path="${depPath}"] .checkbox`);
                if (checkbox) {
                    checkbox.checked = true;
                }

                const fileItem = document.querySelector(`[data-path="${depPath}"]`);
                if (fileItem && !fileItem.querySelector('.dependency-indicator')) {
                    const indicator = document.createElement('span');
                    indicator.className = 'dependency-indicator';
                    indicator.textContent = 'AUTO';
                    indicator.title = 'Automatically selected as dependency';
                    fileItem.appendChild(indicator);
                }
            } else {
                if (!this.dependencyOwners.has(depPath)) {
                    this.dependencyOwners.set(depPath, new Set());
                }
                this.dependencyOwners.get(depPath).add(file.path);
            }
        }

        this.updateValidateButton();
    } catch (error) {
        console.error('❌ Error analyzing dependencies:', error);
    }
}

    extractDependencies(content, currentFilePath) {
    const dependencies = [];

    // Enhanced import regex patterns that capture both the import specifiers and the path
    const importRegexes = [
        // Named imports: import { ComponentName, AnotherComponent } from 'path'
        /import\s*\{\s*([^}]+)\s*\}\s*from\s+['"`](\.\.?\/[^'"`]+)['"`]/g,
        // Default imports: import ComponentName from 'path'
        /import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"`](\.\.?\/[^'"`]+)['"`]/g,
        // Namespace imports: import * as Name from 'path'
        /import\s+\*\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"`](\.\.?\/[^'"`]+)['"`]/g,
        // Side effect imports: import 'path'
        /import\s+['"`](\.\.?\/[^'"`]+)['"`]/g,
        // Dynamic imports: import('path')
        /import\(['"`](\.\.?\/[^'"`]+)['"`]\)/g,
        // Require statements: require('path')
        /require\(['"`](\.\.?\/[^'"`]+)['"`]\)/g,
        // Assignment with require: const name = require('path')
        /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*require\(['"`](\.\.?\/[^'"`]+)['"`]\)/g
    ];

    importRegexes.forEach((regex, regexIndex) => {
        let match;
        while ((match = regex.exec(content)) !== null) {
            let relativePath, importedNames = [];

            // Different regex patterns have different capture groups
            if (regexIndex === 0) {
                // Named imports: extract both names and path
                const namesString = match[1];
                relativePath = match[2];
                // Parse the named imports (handle aliases with 'as')
                importedNames = namesString.split(',').map(name => {
                    const cleanName = name.trim();
                    // Handle 'ComponentName as Alias' syntax
                    const asMatch = cleanName.match(/^([^as]+)\s+as\s+(.+)$/);
                    return asMatch ? asMatch[1].trim() : cleanName;
                });
            } else if (regexIndex === 1) {
                // Default imports
                importedNames = [match[1]];
                relativePath = match[2];
            } else if (regexIndex === 2) {
                // Namespace imports
                importedNames = [match[1]];
                relativePath = match[2];
            } else if (regexIndex === 3 || regexIndex === 4 || regexIndex === 5) {
                // Side effect imports, dynamic imports, basic require
                relativePath = match[1];
                importedNames = [];
            } else if (regexIndex === 6) {
                // Assignment with require
                importedNames = [match[1]];
                relativePath = match[2];
            }

            dependencies.push({
                relativePath,
                importedNames,
                originalStatement: match[0]
            });
        }
        regex.lastIndex = 0;
    });

    return dependencies;
}

    async resolvePath(currentPath, dependencyInfo) {
    try {
        const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
        const { relativePath, importedNames } = dependencyInfo;

        let resolvedPath;

        // Basic path resolution
        if (relativePath.startsWith('./')) {
            resolvedPath = currentDir + '/' + relativePath.substring(2);
        } else if (relativePath.startsWith('../')) {
            let pathParts = currentDir.split('/');
            let relativeParts = relativePath.split('/');

            for (let part of relativeParts) {
                if (part === '..') {
                    pathParts.pop();
                } else if (part !== '.') {
                    pathParts.push(part);
                }
            }
            resolvedPath = pathParts.join('/');
        } else {
            resolvedPath = currentDir + '/' + relativePath;
        }

        // Helper function to check if a file exists
        const checkFileExists = async (testPath) => {
            try {
                const pathForAPI = testPath.startsWith('/') ? testPath.substring(1) : testPath;
                const encodedPath = encodeURIComponent(pathForAPI);
                const existsResponse = await fetch(`/api/exists/${encodedPath}`);
                const exists = await existsResponse.json();

                if (exists.exists && exists.isFile) {
                    return testPath;
                }
                return null;
            } catch (error) {
                return null;
            }
        };

        // Helper function to parse index.js and find re-exports
        const parseIndexFile = async (indexPath) => {
            try {
                const content = await this.getFileContent(indexPath);
                if (!content || content.isBinary) return [];

                const reExports = [];
                const lines = content.content.split('\n');

                for (const line of lines) {
                    // Match: export { default as ComponentName } from './path/to/Component';
                    const defaultAsMatch = line.match(/export\s*\{\s*default\s+as\s+(\w+)\s*\}\s*from\s*['"`]([^'"`]+)['"`]/);
                    if (defaultAsMatch) {
                        reExports.push({
                            exportedName: defaultAsMatch[1],
                            relativePath: defaultAsMatch[2]
                        });
                        continue;
                    }

                    // Match: export { ComponentName } from './path/to/Component';
                    const namedExportMatch = line.match(/export\s*\{\s*([^}]+)\s*\}\s*from\s*['"`]([^'"`]+)['"`]/);
                    if (namedExportMatch) {
                        const exportedNames = namedExportMatch[1].split(',').map(name => name.trim());
                        exportedNames.forEach(name => {
                            reExports.push({
                                exportedName: name,
                                relativePath: namedExportMatch[2]
                            });
                        });
                        continue;
                    }

                    // Match: export * from './path/to/Component';
                    const starExportMatch = line.match(/export\s*\*\s*from\s*['"`]([^'"`]+)['"`]/);
                    if (starExportMatch) {
                        reExports.push({
                            exportedName: '*',
                            relativePath: starExportMatch[1]
                        });
                    }
                }

                return reExports;
            } catch (error) {
                console.error('Error parsing index file:', error);
                return [];
            }
        };

        // Helper function to resolve a path relative to the index file
        const resolveRelativeToIndex = (indexDir, relativePath) => {
            if (relativePath.startsWith('./')) {
                return indexDir + '/' + relativePath.substring(2);
            } else if (relativePath.startsWith('../')) {
                let pathParts = indexDir.split('/');
                let relativeParts = relativePath.split('/');

                for (let part of relativeParts) {
                    if (part === '..') {
                        pathParts.pop();
                    } else if (part !== '.') {
                        pathParts.push(part);
                    }
                }
                return pathParts.join('/');
            } else {
                return indexDir + '/' + relativePath;
            }
        };

        const resolvedPaths = new Set();

        // 1. Try the exact path as specified
        let foundPath = await checkFileExists(resolvedPath);
        if (foundPath) {
            resolvedPaths.add(foundPath);
        }

        // 2. Try with common extensions if no extension is present
        const hasNoExtension = (str) => {
            const lastSlash = str.lastIndexOf('/');
            const lastDot = str.lastIndexOf('.');
            return lastDot === -1 || lastDot < lastSlash;
        };

        if (hasNoExtension(relativePath)) {
            const extensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];

            // Try direct file with extensions
            for (const ext of extensions) {
                const pathWithExt = resolvedPath + ext;
                foundPath = await checkFileExists(pathWithExt);
                if (foundPath) {
                    resolvedPaths.add(foundPath);
                }
            }

            // Try index files in the directory
            for (const ext of extensions) {
                const indexPath = resolvedPath + '/index' + ext;
                foundPath = await checkFileExists(indexPath);
                if (foundPath) {
                    resolvedPaths.add(foundPath);

                    // NEW: Parse the index file to find re-exports
                    if (importedNames && importedNames.length > 0) {
                        const reExports = await parseIndexFile(foundPath);
                        const indexDir = foundPath.substring(0, foundPath.lastIndexOf('/'));

                        for (const importedName of importedNames) {
                            if (importedName) {
                                // Find matching re-export
                                const matchingExport = reExports.find(reExport =>
                                    reExport.exportedName === importedName || reExport.exportedName === '*'
                                );

                                if (matchingExport) {
                                    const reExportPath = resolveRelativeToIndex(indexDir, matchingExport.relativePath);

                                    // Try the re-export path with extensions
                                    for (const ext of extensions) {
                                        const reExportWithExt = reExportPath + ext;
                                        const reExportFound = await checkFileExists(reExportWithExt);
                                        if (reExportFound) {
                                            resolvedPaths.add(reExportFound);
                                            console.log(`✅ Found re-exported component: ${importedName} at ${reExportFound} via index file ${foundPath}`);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 3. Try named component files in the directory (existing logic)
            if (importedNames && importedNames.length > 0) {
                for (const importedName of importedNames) {
                    if (importedName) {
                        for (const ext of extensions) {
                            const namedComponentPath = resolvedPath + '/' + importedName + ext;
                            foundPath = await checkFileExists(namedComponentPath);
                            if (foundPath) {
                                resolvedPaths.add(foundPath);
                                console.log(`✅ Found named component: ${importedName} at ${foundPath}`);
                            }
                        }
                    }
                }
            }
        }

        // Return all found paths as an array
        return Array.from(resolvedPaths);
    } catch (error) {
        console.error('❌ Error resolving path:', error);
        return [];
    }
}

    // File Content Operations
    async getFileContent(filePath) {
        if (this.fileContents.has(filePath)) {
            return this.fileContents.get(filePath);
        }

        try {
            const encodedPath = encodeURIComponent(filePath.substring(1));
            const response = await fetch(`/api/file/${encodedPath}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.json();
            this.fileContents.set(filePath, content);
            return content;
        } catch (error) {
            console.error('Error reading file:', error);
            return null;
        }
    }

    async loadFileContent(file) {
        try {
            const content = await this.getFileContent(file.path);
            const header = document.getElementById('contentHeader');
            const fileInfo = document.getElementById('fileInfo');
            const display = document.getElementById('contentDisplay');

            header.firstChild.textContent = file.name;

            if (!content) {
                display.innerHTML = `
                    <div class="empty-state">
                        <p>❌ Could not load file</p>
                        <p style="font-size: 12px; margin-top: 8px;">File may not exist or be inaccessible</p>
                    </div>
                `;
                return;
            }

            if (content.isBinary) {
                fileInfo.textContent = `Binary file (${this.formatFileSize(file.size)})`;
                display.innerHTML = `
                    <div class="empty-state">
                        <p>📁 Binary file</p>
                        <p style="font-size: 12px; margin-top: 8px;">Cannot display binary content</p>
                    </div>
                `;
            } else {
                fileInfo.textContent = `${content.lines} lines • ${this.formatFileSize(file.size)}`;

                const lineNumbers = [];
                for (let i = 1; i <= content.lines; i++) {
                    lineNumbers.push(i);
                }
                const lineNumbersText = lineNumbers.join('\n');

                display.innerHTML = '';

                const lineNumbersDiv = document.createElement('div');
                lineNumbersDiv.className = 'line-numbers';
                lineNumbersDiv.textContent = lineNumbersText;

                const contentDiv = document.createElement('div');
                contentDiv.className = 'content-with-numbers';
                contentDiv.textContent = content.content;

                display.appendChild(lineNumbersDiv);
                display.appendChild(contentDiv);

                display.scrollTop = 0;
                display.scrollLeft = 0;
            }
        } catch (error) {
            console.error('Error loading file content:', error);
            const display = document.getElementById('contentDisplay');
            display.innerHTML = `
                <div class="error">
                    ❌ Error loading file: ${error.message}
                </div>
            `;
        }
    }

    // File Generation with Chunking
    // Updated generateFile method to use success modal
    async generateFile() {
    try {
        const selectedFilesList = Array.from(this.selectedFiles).filter(path => {
            const item = document.querySelector(`[data-path="${path}"]`);
            return !item || item.dataset.type === 'file';
        });

        let output = '';

        // Add file collection header
        output += 'FILE COLLECTION\n';
        output += '='.repeat(80) + '\n\n';
        output += `Generated: ${new Date().toISOString()}\n`;
        output += `Total files: ${selectedFilesList.length}\n`;
        output += `Root directory: ${this.currentPath}\n`;

        const enabledProjectTypes = [];
        if (this.settings.projectTypes.django && this.djangoFiles.length > 0) {
            enabledProjectTypes.push(`Django (${this.djangoFiles.length} files)`);
        }
        if (this.settings.projectTypes.react && this.reactFiles.length > 0) {
            enabledProjectTypes.push(`React (${this.reactFiles.length} files)`);
        }
        if (enabledProjectTypes.length > 0) {
            output += `Project types detected: ${enabledProjectTypes.join(', ')}\n`;
        }

        if (this.dockerFiles.length > 0) {
            output += `Docker files included: ${this.dockerFiles.length}\n`;
        }
        output += `Output saved to: output_files_selected/ directory\n`;
        output += '\n';

        // Collect file info for the summary
        const fileInfoList = [];

        for (const filePath of selectedFilesList.sort()) {
            try {
                if (typeof filePath !== 'string') {
                    console.error('Invalid filePath type:', typeof filePath, filePath);
                    continue;
                }

                const content = await this.getFileContent(filePath);
                const fileName = filePath.split('/').pop();
                const directory = filePath.substring(0, filePath.lastIndexOf('/'));
                const relativePath = filePath.replace(this.currentPath, '').replace(/^\//, '');

                // Add to file info list for summary
                const displayPath = relativePath || fileName;
                fileInfoList.push(displayPath);

                output += '='.repeat(80) + '\n';
                output += `filename: ${fileName}\n`;
                output += `directory: ${directory}\n`;
                output += `relative_path: ${relativePath}\n`;
                output += `full_path: ${filePath}\n`;

                const classifications = [];
                if (this.dockerFiles.some(dockerFile => dockerFile.path === filePath)) {
                    classifications.push('docker');
                }
                if (this.djangoFiles.some(djangoFile => djangoFile.path === filePath)) {
                    const djangoFile = this.djangoFiles.find(df => df.path === filePath);
                    classifications.push(`django-${djangoFile.type}`);
                }
                if (this.reactFiles.some(reactFile => reactFile.path === filePath)) {
                    const reactFile = this.reactFiles.find(rf => rf.path === filePath);
                    classifications.push(`react-${reactFile.type}`);
                }

                if (classifications.length > 0) {
                    output += `classification: ${classifications.join(', ')}\n`;
                }

                if (content && content.isBinary) {
                    output += `type: binary\n`;
                    output += `size: ${this.formatFileSize(new Blob(['']).size)}\n`;
                } else if (content) {
                    output += `type: text\n`;
                    output += `lines: ${content.lines}\n`;
                    output += `size: ${this.formatFileSize(new Blob([content.content]).size)}\n`;
                }

                output += '='.repeat(80) + '\n\n';

                if (content && !content.isBinary) {
                    output += content.content;
                } else if (content && content.isBinary) {
                    output += '// Binary file - content not included\n';
                } else {
                    output += '// Could not read file content\n';
                }

                output += '\n\n';
            } catch (error) {
                console.error(`Error processing file ${filePath}:`, error);
                const fileName = typeof filePath === 'string' ? filePath.split('/').pop() : 'unknown';
                const directory = typeof filePath === 'string' ? filePath.substring(0, filePath.lastIndexOf('/')) : 'unknown';

                // Add to file info list even if there was an error
                if (typeof filePath === 'string') {
                    const fileName = filePath.split('/').pop();
                    const relativePath = filePath.replace(this.currentPath, '').replace(/^\//, '');
                    const displayPath = relativePath || fileName;
                    fileInfoList.push(displayPath);
                }

                output += '='.repeat(80) + '\n';
                output += `filename: ${fileName}\n`;
                output += `directory: ${directory}\n`;
                output += `full_path: ${filePath}\n`;
                output += `error: ${error.message}\n`;
                output += '='.repeat(80) + '\n\n';
                output += '// Error reading file\n\n';
            }
        }

        // Add final instructions only for the last (or only) chunk
        output += '\n' + '='.repeat(80) + '\n\n';
        output += 'DONE PASTING\n\n';

        // Add file summary line with paths
        if (fileInfoList.length > 0) {
            output += `I just gave you ${fileInfoList.length} files that are: ${fileInfoList.join(', ')}\n\n`;
        }

        output += 'Now here are your instructions:\n\n';

        // Add custom prompt if provided
        if (this.settings.customPrompt && this.settings.customPrompt.trim()) {
            output += this.settings.customPrompt.trim() + '\n';
        } else {
            output += 'Please analyze the provided project files and provide insights or assistance as needed.\n';
        }

        this.generatedFileContent = output;

        // Create chunks if content is large
        if (output.length > this.chunkSize) {
            this.fileChunks = this.splitIntoChunks(output, this.chunkSize);
            console.log(`📦 Created ${this.fileChunks.length} chunks from ${output.length} characters`);

            // Modify chunks to include part-specific instructions
            this.fileChunks = this.fileChunks.map((chunk, index) => {
                let chunkContent = chunk.content;
                if (index < this.fileChunks.length - 1) {
                    // For non-last chunks, add part instruction
                    chunkContent = `I'm going to paste multiple parts of my Django/React project files. IMPORTANT: Just respond with "Ready for part ${index + 2}" after each part until I say "DONE PASTING". Do not analyze, suggest changes, or provide any code until I finish providing all parts.\n\n${chunkContent}`;
                } else {
                    // For the last chunk, ensure it ends with DONE PASTING and instructions
                    chunkContent = chunkContent.replace(
                        /--- wait for Part \d+, only respond with "Ready for next one boss."---/,
                        ''
                    );
                }
                return {
                    ...chunk,
                    content: chunkContent,
                    size: chunkContent.length
                };
            });
            this.currentChunkIndex = 0;
        } else {
            this.fileChunks = [{
                index: 0,
                label: 'a',
                filename: 'file_a',
                content: output,
                size: output.length,
                startPos: 0,
                endPos: output.length
            }];
            this.currentChunkIndex = 0;
        }

        const response = await fetch('/api/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: output
        });

        const result = await response.json();

        if (result.success) {
            this.hideConfirmModal();
            this.showSuccessModal(result, enabledProjectTypes);
        } else {
            alert(`❌ Error saving file: ${result.error}`);
        }

    } catch (error) {
        console.error('Error generating file:', error);
        alert(`❌ Error generating file: ${error.message}`);
    }
}

    // Show success modal with file information
showSuccessModal(result, enabledProjectTypes) {
    const modal = document.getElementById('successModal');

    // Populate file information
    document.getElementById('successFilename').textContent = result.filename;
    document.getElementById('successDirectory').textContent = 'output_files_selected/';
    document.getElementById('successFullPath').textContent = result.relativePath;

    // Calculate and show file size
    const fileSize = new Blob([this.generatedFileContent]).size;
    document.getElementById('successFileSize').textContent = this.formatFileSize(fileSize);

    // Populate content statistics
    const selectedFilesList = Array.from(this.selectedFiles).filter(path => {
        const item = document.querySelector(`[data-path="${path}"]`);
        return !item || item.dataset.type === 'file';
    });

    const lines = this.generatedFileContent.split('\n').length;
    const characters = this.generatedFileContent.length;

    document.getElementById('successTotalFiles').textContent = selectedFilesList.length;
    document.getElementById('successTotalLines').textContent = lines.toLocaleString();
    document.getElementById('successTotalChars').textContent = characters.toLocaleString();

    // Show chunk information if applicable
    const chunkStat = document.getElementById('successChunkStat');
    if (this.fileChunks.length > 1) {
        chunkStat.style.display = 'flex';
        document.getElementById('successChunkCount').textContent = this.fileChunks.length;
    } else {
        chunkStat.style.display = 'none';
    }

    // Show project types if any
    const projectTypesSection = document.getElementById('successProjectTypesSection');
    const projectTypesContainer = document.getElementById('successProjectTypes');

    if (enabledProjectTypes.length > 0) {
        projectTypesSection.style.display = 'block';
        projectTypesContainer.innerHTML = '';

        enabledProjectTypes.forEach(typeInfo => {
            const typeElement = document.createElement('div');
            typeElement.className = 'success-project-type';

            if (typeInfo.includes('Django')) {
                typeElement.classList.add('django');
                typeElement.innerHTML = '🐍 ' + typeInfo;
            } else if (typeInfo.includes('React')) {
                typeElement.classList.add('react');
                typeElement.innerHTML = '⚛️ ' + typeInfo;
            }

            projectTypesContainer.appendChild(typeElement);
        });
    } else {
        projectTypesSection.style.display = 'none';
    }

    // Show/hide features based on settings
    const customPromptFeature = document.getElementById('successCustomPromptFeature');
    if (this.settings.customPrompt && this.settings.customPrompt.trim()) {
        customPromptFeature.style.display = 'flex';
    } else {
        customPromptFeature.style.display = 'none';
    }

    const dockerFeature = document.getElementById('successDockerFeature');
    if (this.dockerFiles.length > 0) {
        dockerFeature.style.display = 'flex';
    } else {
        dockerFeature.style.display = 'none';
    }

    const dependencyFeature = document.getElementById('successDependencyFeature');
    if (this.fileDependencies.size > 0) {
        dependencyFeature.style.display = 'flex';
    } else {
        dependencyFeature.style.display = 'none';
    }

    // Show the modal
    modal.classList.remove('hidden');
}

// Hide success modal
hideSuccessModal() {
    document.getElementById('successModal').classList.add('hidden');
}

// Open the output folder (platform-specific)
async openOutputFolder() {
    try {
        const { exec } = require('child_process');
        const path = require('path');
        const outputDir = path.join(process.cwd(), 'output_files_selected');

        const platform = process.platform;
        let command;

        if (platform === 'darwin') {
            command = `open "${outputDir}"`;
        } else if (platform === 'win32') {
            command = `explorer "${outputDir}"`;
        } else {
            command = `xdg-open "${outputDir}"`;
        }

        exec(command, (error) => {
            if (error) {
                console.error('Error opening folder:', error);
                alert('Could not open folder automatically. Please navigate to the output_files_selected directory manually.');
            }
        });
    } catch (error) {
        console.error('Error opening folder:', error);
        alert('Could not open folder automatically. Please navigate to the output_files_selected directory manually.');
    }
}

// Setup success modal event listeners (add this to your setupEventListeners method)
setupSuccessModalListeners() {

        const successPreviewBtn = document.getElementById('successPreviewBtn');
    console.log('successPreviewBtn found:', !!successPreviewBtn);
    if (successPreviewBtn) {
        successPreviewBtn.addEventListener('click', () => {
            console.log('Preview button clicked, opening content modal');
            this.hideSuccessModal();
            this.showContentModal();
        });
    }
    const closeSuccessModal = document.getElementById('closeSuccessModal');
    if (closeSuccessModal) {
        closeSuccessModal.addEventListener('click', () => this.hideSuccessModal());
    }


    const successCloseBtn = document.getElementById('successCloseBtn');
    if (successCloseBtn) {
        successCloseBtn.addEventListener('click', () => this.hideSuccessModal());
    }

    const successOpenFolderBtn = document.getElementById('successOpenFolderBtn');
    if (successOpenFolderBtn) {
        successOpenFolderBtn.addEventListener('click', () => this.openOutputFolder());
    }

    // Close modal when clicking outside
    const successModal = document.getElementById('successModal');
    if (successModal) {
        successModal.addEventListener('click', (e) => {
            if (e.target === successModal) {
                this.hideSuccessModal();
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !successModal.classList.contains('hidden')) {
            this.hideSuccessModal();
        }
    });
}

    // Modal Operations
    showContentModal() {
        const modal = document.getElementById('contentModal');
        const generatedContent = document.getElementById('generatedContent');
        const contentFileCount = document.getElementById('contentFileCount');
        const contentLineCount = document.getElementById('contentLineCount');
        const contentCharCount = document.getElementById('contentCharCount');
        const contentSizeCount = document.getElementById('contentSizeCount');

        const fullContent = this.generatedFileContent;
        const lines = fullContent.split('\n').length;
        const characters = fullContent.length;
        const size = new Blob([fullContent]).size;
        const fileCount = Array.from(this.selectedFiles).filter(path => {
            const item = document.querySelector(`[data-path="${path}"]`);
            return !item || item.dataset.type === 'file';
        }).length;

        contentFileCount.textContent = fileCount;
        contentLineCount.textContent = lines.toLocaleString();
        contentCharCount.textContent = characters.toLocaleString();
        contentSizeCount.textContent = this.formatFileSize(size);

        const firstChunk = this.fileChunks[0];
        generatedContent.textContent = firstChunk.content;

        const copyAllChunksBtn = document.getElementById('copyAllChunksBtn');
        const downloadAllChunks = document.getElementById('downloadAllChunks');

        if (this.fileChunks.length > 1) {
            if (copyAllChunksBtn) copyAllChunksBtn.style.display = 'inline-block';
            if (downloadAllChunks) downloadAllChunks.style.display = 'inline-block';
        } else {
            if (copyAllChunksBtn) copyAllChunksBtn.style.display = 'none';
            if (downloadAllChunks) downloadAllChunks.style.display = 'none';
        }

        const modalBody = modal.querySelector('.modal-body');
        const existingNav = modalBody.querySelector('.chunk-navigation');
        if (existingNav) {
            existingNav.remove();
        }

        if (this.fileChunks.length > 1) {
            const chunkNavigation = this.createChunkNavigation();
            modalBody.insertBefore(chunkNavigation, modalBody.querySelector('.content-display-modal'));

            this.fileChunks.forEach((chunk, index) => {
                const btn = document.getElementById(`chunkBtn${index}`);
                if (btn) {
                    btn.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
                    btn.setAttribute('title', `Switch to ${chunk.filename} (${this.formatFileSize(chunk.size)})`);
                    btn.addEventListener('click', () => this.switchToChunk(index));
                }
            });
        }

        const modalHeader = modal.querySelector('.modal-header h2');
        if (this.fileChunks.length > 1) {
            modalHeader.textContent = `📄 ${firstChunk.filename} (1/${this.fileChunks.length})`;
        } else {
            modalHeader.textContent = '📄 Generated File Content';
        }

        const copyBtn = document.getElementById('copyContentBtn');
        if (copyBtn && this.fileChunks.length > 1) {
            copyBtn.textContent = `📋 Copy ${firstChunk.filename}`;
            copyBtn.classList.add('chunk-copy');
        }

        this.updateChunkInfo();
        modal.classList.remove('hidden');
        document.getElementById('contentDisplayModal').scrollTop = 0;

        console.log(`📦 Content modal opened with ${this.fileChunks.length} chunks`);
        if (this.fileChunks.length > 1) {
            console.log(`📦 Use arrow keys (←/→) or click buttons to navigate between chunks`);
        }
    }

    async copyContentToClipboard() {
        try {
            const currentChunk = this.fileChunks[this.currentChunkIndex];
            const contentToCopy = currentChunk.content;

            await navigator.clipboard.writeText(contentToCopy);

            const copyBtn = document.getElementById('copyContentBtn');
            const originalText = copyBtn.textContent;

            copyBtn.textContent = `✅ ${currentChunk.filename} Copied!`;
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.classList.remove('copied');
            }, 2000);

        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            alert('❌ Failed to copy to clipboard. Please select and copy manually.');
        }
    }

    downloadContent() {
        const currentChunk = this.fileChunks[this.currentChunkIndex];
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `${currentChunk.filename}_${timestamp}.txt`;

        const blob = new Blob([currentChunk.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        alert(`📥 Download started: ${filename}`);
    }

    hideContentModal() {
        document.getElementById('contentModal').classList.add('hidden');
    }

    hideConfirmModal() {
        document.getElementById('confirmModal').classList.add('hidden');
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Basic modal listeners
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.showConfirmModal());
        }

        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideConfirmModal());
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideConfirmModal());
        }

        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.generateFile());
        }

        // Content modal listeners
        const closeContentModal = document.getElementById('closeContentModal');
        if (closeContentModal) {
            closeContentModal.addEventListener('click', () => this.hideContentModal());
        }

        const closeContentModal2 = document.getElementById('closeContentModal2');
        if (closeContentModal2) {
            closeContentModal2.addEventListener('click', () => this.hideContentModal());
        }

        const copyContentBtn = document.getElementById('copyContentBtn');
        if (copyContentBtn) {
            copyContentBtn.addEventListener('click', () => this.copyContentToClipboard());
        }

        const downloadContentBtn = document.getElementById('downloadContentBtn');
        if (downloadContentBtn) {
            downloadContentBtn.addEventListener('click', () => this.downloadContent());
        }

        // Chunking-specific event listeners
        const copyAllChunksBtn = document.getElementById('copyAllChunksBtn');
        if (copyAllChunksBtn) {
            copyAllChunksBtn.addEventListener('click', () => this.copyAllChunks());
        }

        const downloadAllChunks = document.getElementById('downloadAllChunks');
        if (downloadAllChunks) {
            downloadAllChunks.addEventListener('click', () => this.downloadAllChunks());
        }

        // Keyboard navigation for chunks
        document.addEventListener('keydown', (event) => this.handleChunkKeyNavigation(event));

        // Settings modal listeners
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettingsModal());
        }

        const closeSettingsModal = document.getElementById('closeSettingsModal');
        if (closeSettingsModal) {
            closeSettingsModal.addEventListener('click', () => this.hideSettingsModal());
        }

        const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
        if (cancelSettingsBtn) {
            cancelSettingsBtn.addEventListener('click', () => this.hideSettingsModal());
        }

        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveSettingsFromModal());
        }

        // Settings form listeners
        this.setupSettingsFormListeners();
    }

    setupSettingsFormListeners() {
        const browseDefaultPath = document.getElementById('browseDefaultPath');
        if (browseDefaultPath) {
            browseDefaultPath.addEventListener('click', async () => {
                const newPath = await this.openNativeFileBrowser();
                if (newPath) {
                    document.getElementById('defaultPath').value = newPath;
                    this.updateProjectTypesGridState();
                }
            });
        }

        const defaultPath = document.getElementById('defaultPath');
        if (defaultPath) {
            defaultPath.addEventListener('input', () => {
                this.updateProjectTypesGridState();
            });
        }

        const includeDockerFiles = document.getElementById('includeDockerFiles');
        if (includeDockerFiles) {
            includeDockerFiles.addEventListener('change', () => {
                this.updateDockerFilesPreview();
            });
        }

        const includeDjangoFiles = document.getElementById('includeDjangoFiles');
        if (includeDjangoFiles) {
            includeDjangoFiles.addEventListener('change', () => {
                this.updateProjectFilesPreview();
            });
        }

        const includeReactFiles = document.getElementById('includeReactFiles');
        if (includeReactFiles) {
            includeReactFiles.addEventListener('change', () => {
                this.updateProjectFilesPreview();
            });
        }
    }

    // Settings Modal Operations
    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const defaultPathInput = document.getElementById('defaultPath');
        const includeDockerCheckbox = document.getElementById('includeDockerFiles');
        const customPromptTextarea = document.getElementById('customPrompt');
        const currentDefaultPath = document.getElementById('currentDefaultPath');

        const djangoCheckbox = document.getElementById('includeDjangoFiles');
        const reactCheckbox = document.getElementById('includeReactFiles');

        if (!modal) {
            console.error('Settings modal not found');
            return;
        }

        if (defaultPathInput) defaultPathInput.value = this.settings.defaultPath || '';
        if (includeDockerCheckbox) includeDockerCheckbox.checked = this.settings.includeDockerFiles || false;
        if (customPromptTextarea) customPromptTextarea.value = this.settings.customPrompt || '';
        if (currentDefaultPath) currentDefaultPath.textContent = this.settings.defaultPath || 'Not set';

        if (djangoCheckbox) djangoCheckbox.checked = this.settings.projectTypes?.django || false;
        if (reactCheckbox) reactCheckbox.checked = this.settings.projectTypes?.react || false;

        this.updateProjectTypesGridState();
        this.updateDockerFilesPreview();
        this.updateProjectFilesPreview();

        modal.classList.remove('hidden');
    }

    hideSettingsModal() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    updateProjectTypesGridState() {
        const projectTypesGrid = document.getElementById('projectTypesGrid');
        const defaultPathInput = document.getElementById('defaultPath');
        const includeDjangoFiles = document.getElementById('includeDjangoFiles');
        const includeReactFiles = document.getElementById('includeReactFiles');

        if (!projectTypesGrid || !defaultPathInput) {
            console.log('Project types grid elements not found, skipping state update');
            return;
        }

        if (!defaultPathInput.value.trim()) {
            projectTypesGrid.classList.add('warning');
            if (includeDjangoFiles) includeDjangoFiles.disabled = true;
            if (includeReactFiles) includeReactFiles.disabled = true;
        } else {
            projectTypesGrid.classList.remove('warning');
            if (includeDjangoFiles) includeDjangoFiles.disabled = false;
            if (includeReactFiles) includeReactFiles.disabled = false;
        }
    }

    async updateProjectFilesPreview() {
        const djangoCheckbox = document.getElementById('includeDjangoFiles');
        const reactCheckbox = document.getElementById('includeReactFiles');
        const projectFilesPreview = document.getElementById('projectFilesPreview');
        const projectFilesList = document.getElementById('projectFilesList');

        if (!djangoCheckbox || !reactCheckbox || !projectFilesPreview || !projectFilesList) {
            console.log('Project files preview elements not found, skipping preview update');
            return;
        }

        const isDjangoChecked = djangoCheckbox.checked;
        const isReactChecked = reactCheckbox.checked;

        if (isDjangoChecked || isReactChecked) {
            projectFilesPreview.style.display = 'block';

            let previewHtml = '';

            if (isDjangoChecked) {
                previewHtml += '<div class="project-files-section">';
                previewHtml += '<h5>🐍 Django Files:</h5>';
                if (this.djangoFiles && this.djangoFiles.length > 0) {
                    this.djangoFiles.forEach(file => {
                        previewHtml += `<div class="project-file-item django">${file.relativePath} <span class="file-type">${file.type}</span></div>`;
                    });
                } else {
                    previewHtml += '<div class="project-file-item no-files">No Django files found in current directory tree</div>';
                }
                previewHtml += '</div>';
            }

            if (isReactChecked) {
                previewHtml += '<div class="project-files-section">';
                previewHtml += '<h5>⚛️ React Files:</h5>';
                if (this.reactFiles && this.reactFiles.length > 0) {
                    this.reactFiles.forEach(file => {
                        previewHtml += `<div class="project-file-item react">${file.relativePath} <span class="file-type">${file.type}</span></div>`;
                    });
                } else {
                    previewHtml += '<div class="project-file-item no-files">No React files found in current directory tree</div>';
                }
                previewHtml += '</div>';
            }

            projectFilesList.innerHTML = previewHtml;
        } else {
            projectFilesPreview.style.display = 'none';
        }
    }

    async updateDockerFilesPreview() {
        const includeDockerCheckbox = document.getElementById('includeDockerFiles');
        const dockerFilesPreview = document.getElementById('dockerFilesPreview');
        const dockerFilesList = document.getElementById('dockerFilesList');

        if (includeDockerCheckbox.checked) {
            dockerFilesPreview.style.display = 'block';

            if (this.dockerFiles.length > 0) {
                dockerFilesList.innerHTML = this.dockerFiles.map(file =>
                    `<div class="docker-file-item">${file.relativePath}</div>`
                ).join('');
            } else {
                dockerFilesList.innerHTML = '<div class="docker-file-item" style="color: #7d8590;">No Docker files found in current directory tree</div>';
            }
        } else {
            dockerFilesPreview.style.display = 'none';
        }
    }

    async saveSettingsFromModal() {
        const defaultPathInput = document.getElementById('defaultPath');
        const includeDockerCheckbox = document.getElementById('includeDockerFiles');
        const customPromptTextarea = document.getElementById('customPrompt');
        const djangoCheckbox = document.getElementById('includeDjangoFiles');
        const reactCheckbox = document.getElementById('includeReactFiles');

        const newSettings = {
            defaultPath: defaultPathInput ? defaultPathInput.value.trim() : '',
            includeDockerFiles: includeDockerCheckbox ? includeDockerCheckbox.checked : false,
            customPrompt: customPromptTextarea ? customPromptTextarea.value.trim() : '',
            projectTypes: {
                django: djangoCheckbox ? djangoCheckbox.checked : false,
                react: reactCheckbox ? reactCheckbox.checked : false
            }
        };

        if (newSettings.defaultPath && !await this.directoryExists(newSettings.defaultPath)) {
            alert('❌ The specified default path does not exist or is not accessible.');
            return false;
        }

        const oldSettings = { ...this.settings };
        this.settings = { ...this.settings, ...newSettings };

        const saved = await this.saveSettings();
        if (saved) {
            if (oldSettings.includeDockerFiles !== newSettings.includeDockerFiles) {
                if (newSettings.includeDockerFiles) {
                    await this.scanForDockerFiles();
                } else {
                    if (this.dockerFiles) {
                        this.dockerFiles.forEach(dockerFile => {
                            this.selectedFiles.delete(dockerFile.path);
                        });
                        this.dockerFiles = [];
                    }
                }
            }

            if (djangoCheckbox && reactCheckbox) {
                const djangoChanged = oldSettings.projectTypes?.django !== newSettings.projectTypes.django;
                const reactChanged = oldSettings.projectTypes?.react !== newSettings.projectTypes.react;

                if (djangoChanged || reactChanged) {
                    if (!newSettings.projectTypes.django && oldSettings.projectTypes?.django) {
                        if (this.djangoFiles) {
                            this.djangoFiles.forEach(djangoFile => {
                                this.selectedFiles.delete(djangoFile.path);
                            });
                            this.djangoFiles = [];
                        }
                    }

                    if (!newSettings.projectTypes.react && oldSettings.projectTypes?.react) {
                        if (this.reactFiles) {
                            this.reactFiles.forEach(reactFile => {
                                this.selectedFiles.delete(reactFile.path);
                            });
                            this.reactFiles = [];
                        }
                    }

                    if (newSettings.defaultPath &&
                        (newSettings.projectTypes.django || newSettings.projectTypes.react)) {
                        await this.scanForProjectFiles();
                    }
                }
            }

            this.updateValidateButton();
            this.updateVisibleCheckboxes();
            this.hideSettingsModal();
            alert('✅ Settings saved successfully!');
            return true;
        } else {
            alert('❌ Failed to save settings. Please try again.');
            return false;
        }
    }

    // Docker File Scanning
    async scanForDockerFiles() {
        try {
            const response = await fetch('/api/docker-files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ startPath: this.currentPath })
            });

            if (response.ok) {
                this.dockerFiles = await response.json();
                console.log(`🐳 Found ${this.dockerFiles.length} Docker files`);

                this.dockerFiles.forEach(dockerFile => {
                    this.selectedFiles.add(dockerFile.path);
                });

                this.updateValidateButton();
                this.updateVisibleCheckboxes();
            }
        } catch (error) {
            console.error('Error scanning for Docker files:', error);
        }
    }

    // Directory Tree Operations
    async toggleDirectory(item, path) {
        const arrow = item.querySelector('.directory-arrow');
        let children = item.nextElementSibling;

        if (children && children.classList.contains('children')) {
            children.classList.toggle('hidden');
            arrow.classList.toggle('expanded');

            if (children.classList.contains('hidden')) {
                this.expandedDirectories.delete(path);
            } else {
                this.expandedDirectories.add(path);
            }
        } else {
            try {
                const encodedPath = encodeURIComponent(path.substring(1));
                const response = await fetch(`/api/directory/${encodedPath}`);
                const files = await response.json();

                children = document.createElement('div');
                children.className = 'children';

                files.forEach(file => {
                    const childItem = this.createFileItem(file, path);
                    children.appendChild(childItem);
                });

                item.parentNode.insertBefore(children, item.nextSibling);
                arrow.classList.add('expanded');
                this.expandedDirectories.add(path);
            } catch (error) {
                console.error('Error loading directory contents:', error);
            }
        }
    }

    async selectDirectoryContents(dirPath) {
        try {
            const encodedPath = encodeURIComponent(dirPath.substring(1));
            const response = await fetch(`/api/directory/${encodedPath}`);
            const files = await response.json();

            for (const file of files) {
                this.selectedFiles.add(file.path);

                if (file.type === 'directory') {
                    await this.selectDirectoryContents(file.path);
                } else if (file.type === 'file') {
                    await this.analyzeFileDependencies(file);
                }
            }

            this.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error selecting directory contents:', error);
        }
    }

    async deselectDirectoryContents(dirPath) {
        try {
            const encodedPath = encodeURIComponent(dirPath.substring(1));
            const response = await fetch(`/api/directory/${encodedPath}`);
            const files = await response.json();

            for (const file of files) {
                this.selectedFiles.delete(file.path);

                if (file.type === 'directory') {
                    await this.deselectDirectoryContents(file.path);
                }
            }

            this.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error deselecting directory contents:', error);
        }
    }

    async removeDependencies(filePath) {
        const dependencies = this.fileDependencies.get(filePath);
        if (!dependencies) return;

        for (const depPath of dependencies) {
            const owners = this.dependencyOwners.get(depPath);
            if (owners) {
                owners.delete(filePath);

                if (owners.size === 0) {
                    this.selectedFiles.delete(depPath);
                    this.dependencyOwners.delete(depPath);

                    const fileItem = document.querySelector(`[data-path="${depPath}"]`);
                    if (fileItem) {
                        const indicator = fileItem.querySelector('.dependency-indicator');
                        if (indicator) {
                            indicator.remove();
                        }
                    }

                    await this.removeDependencies(depPath);
                }
            }
        }

        this.fileDependencies.delete(filePath);
    }

    // UI Update Methods
    updateVisibleCheckboxes() {
        document.querySelectorAll('.file-item').forEach(item => {
            const checkbox = item.querySelector('.checkbox');
            const path = item.dataset.path;
            if (checkbox && path) {
                checkbox.checked = this.selectedFiles.has(path);
            }
        });
    }

    updateValidateButton() {
        const btn = document.getElementById('validateBtn');
        const count = document.getElementById('selectedCount');
        const fileCount = Array.from(this.selectedFiles).filter(path => {
            const item = document.querySelector(`[data-path="${path}"]`);
            return !item || item.dataset.type === 'file';
        }).length;

        count.textContent = fileCount;
        btn.disabled = fileCount === 0;
    }

    updateBreadcrumb(path) {
        const breadcrumb = document.getElementById('breadcrumb');
        const parts = path.split('/').filter(p => p);

        breadcrumb.innerHTML = '';
        let currentPath = '';

        const rootItem = document.createElement('span');
        rootItem.className = 'breadcrumb-item';
        rootItem.textContent = '/';
        rootItem.dataset.path = '/';
        rootItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Breadcrumb ROOT clicked, navigating to: /');
            this.navigateToDirectory('/');
        });
        breadcrumb.appendChild(rootItem);

        parts.forEach((part, index) => {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '/';
            breadcrumb.appendChild(separator);

            currentPath += '/' + part;
            const item = document.createElement('span');
            item.className = 'breadcrumb-item';
            item.textContent = part;
            item.dataset.path = currentPath;

            const targetPath = currentPath;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Breadcrumb clicked, navigating to:', targetPath);
                this.navigateToDirectory(targetPath);
            });

            breadcrumb.appendChild(item);
        });
    }

    async navigateToDirectory(targetPath) {
        try {
            console.log('Attempting to navigate to:', targetPath);

            const tree = document.getElementById('fileTree');
            tree.innerHTML = '<div class="loading">🔄 Loading files...</div>';

            document.getElementById('currentPath').textContent = targetPath;

            await this.loadDirectory(targetPath);

            this.currentPath = targetPath;

            if (this.settings.includeDockerFiles) {
                await this.scanForDockerFiles();
            }

            console.log('Successfully navigated to:', targetPath);
        } catch (error) {
            console.error('Error navigating to directory:', error);
            alert(`Error accessing directory: ${error.message}\n\nPlease check that the path exists and you have permission to access it.`);
        }
    }

    async showConfirmModal() {
        const modal = document.getElementById('confirmModal');
        const totalFiles = document.getElementById('totalFiles');
        const totalLines = document.getElementById('totalLines');
        const totalSize = document.getElementById('totalSize');
        const filesList = document.getElementById('selectedFilesList');
        const progressFill = document.getElementById('progressFill');

        modal.classList.remove('hidden');
        progressFill.style.width = '0%';

        let lineCount = 0;
        let sizeCount = 0;
        const files = [];
        const selectedFilesList = Array.from(this.selectedFiles).filter(path => {
            const item = document.querySelector(`[data-path="${path}"]`);
            return !item || item.dataset.type === 'file';
        });

        totalFiles.textContent = selectedFilesList.length;
        totalLines.textContent = 'Calculating...';
        totalSize.textContent = 'Calculating...';

        for (let i = 0; i < selectedFilesList.length; i++) {
            const filePath = selectedFilesList[i];

            try {
                const content = await this.getFileContent(filePath);

                if (content && !content.isBinary) {
                    lineCount += content.lines;
                    sizeCount += new Blob([content.content]).size;
                }

                const fileName = filePath.split('/').pop();
                const directory = filePath.substring(0, filePath.lastIndexOf('/'));
                files.push({
                    fileName,
                    directory,
                    path: filePath,
                    lines: content ? content.lines : 0,
                    isBinary: content ? content.isBinary : false
                });

                const progress = ((i + 1) / selectedFilesList.length) * 100;
                progressFill.style.width = progress + '%';

                totalLines.textContent = lineCount.toLocaleString();
                totalSize.textContent = this.formatFileSize(sizeCount);

            } catch (error) {
                console.error(`Error processing file ${filePath}:`, error);
                files.push({
                    fileName: filePath.split('/').pop(),
                    directory: filePath.substring(0, filePath.lastIndexOf('/')),
                    path: filePath,
                    lines: 0,
                    error: true
                });
            }
        }

        filesList.innerHTML = '';
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-list-item';

            const pathDiv = document.createElement('div');
            pathDiv.className = 'file-list-path';
            pathDiv.innerHTML = `<strong>${file.fileName}</strong><br><small>${file.directory}</small>`;

            const linesDiv = document.createElement('div');
            linesDiv.className = 'file-list-lines';
            if (file.error) {
                linesDiv.textContent = 'Error';
                linesDiv.style.color = '#f85149';
            } else if (file.isBinary) {
                linesDiv.textContent = 'Binary';
                linesDiv.style.color = '#7d8590';
            } else {
                linesDiv.textContent = `${file.lines} lines`;
            }

            item.appendChild(pathDiv);
            item.appendChild(linesDiv);
            filesList.appendChild(item);
        });

        progressFill.style.width = '100%';
    }

    // Resizer Setup
    setupResizer() {
        try {
            const resizer = document.getElementById('resizer');
            const fileContent = document.querySelector('.file-content');
            const fileExplorer = document.querySelector('.file-explorer');
            const resizeIndicator = document.getElementById('resizeIndicator');

            if (!resizer || !fileContent || !fileExplorer) {
                console.warn('Resizer elements not found, skipping resizer setup');
                return;
            }

            let isResizing = false;
            let startX = 0;
            let startFileContentWidth = 0;
            let startFileExplorerWidth = 0;

            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startFileContentWidth = fileContent.offsetWidth;
                startFileExplorerWidth = fileExplorer.offsetWidth;

                resizer.classList.add('dragging');
                if (resizeIndicator) {
                    resizeIndicator.style.opacity = '1';
                }

                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';

                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const deltaX = e.clientX - startX;
                const mainContainer = document.querySelector('.main-container');
                if (!mainContainer) return;

                const containerWidth = mainContainer.offsetWidth;

                let newFileContentWidth = startFileContentWidth + deltaX;
                let newFileExplorerWidth = startFileExplorerWidth - deltaX;

                const minFileContentWidth = 300;
                const maxFileContentWidth = containerWidth - 250;
                const minFileExplorerWidth = 250;
                const maxFileExplorerWidth = 800;

                newFileContentWidth = Math.max(minFileContentWidth, Math.min(maxFileContentWidth, newFileContentWidth));
                newFileExplorerWidth = Math.max(minFileExplorerWidth, Math.min(maxFileExplorerWidth, containerWidth - newFileContentWidth));

                fileContent.style.flex = 'none';
                fileContent.style.width = newFileContentWidth + 'px';
                fileExplorer.style.width = newFileExplorerWidth + 'px';

                e.preventDefault();
            });

            document.addEventListener('mouseup', () => {
                if (!isResizing) return;

                isResizing = false;
                resizer.classList.remove('dragging');
                if (resizeIndicator) {
                    resizeIndicator.style.opacity = '0';
                }

                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            });

            resizer.addEventListener('dblclick', () => {
                fileContent.style.flex = '1';
                fileContent.style.width = '';
                fileExplorer.style.width = '400px';
            });

            console.log('✅ Resizer setup completed successfully');
        } catch (error) {
            console.error('❌ Error setting up resizer:', error);
        }
    }
}