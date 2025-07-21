class FileExplorer {
    constructor() {
        this.currentPath = '/';
        this.selectedFiles = new Set();
        this.expandedDirectories = new Set();
        this.fileContents = new Map();
        this.fileDependencies = new Map();
        this.dependencyOwners = new Map();
        this.dockerFiles = [];
        this.djangoFiles = [];
        this.reactFiles = [];
        this.fileChunks = [];
        this.currentChunkIndex = 0;
        this.chunkSize = 30000;
        this.settings = {
            defaultPath: '',
            includeDockerFiles: false,
            customPrompt: '',
            projectTypes: {
                django: false,
                react: false
            }
        };
        this.audio = new Audio('/paper-245786.mp3'); // Initialize audio object
    }

    async init() {
        await this.loadSettings();
        await this.loadDirectory(this.currentPath);
        this.setupEventListeners();
        this.setupResizer();
        this.setupSuccessModalListeners();
        this.updateValidateButton();
    }

    // Utility Methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    splitIntoChunks(content, chunkSize) {
        const chunks = [];
        let startPos = 0;
        let index = 0;

        while (startPos < content.length) {
            let endPos = startPos + chunkSize;

            if (endPos < content.length) {
                const lastNewline = content.lastIndexOf('\n', endPos);
                if (lastNewline > startPos) {
                    endPos = lastNewline + 1;
                }
            } else {
                endPos = content.length;
            }

            const chunkContent = content.slice(startPos, endPos);
            chunks.push({
                index,
                label: String.fromCharCode(97 + index),
                filename: `file_${String.fromCharCode(97 + index)}`,
                content: chunkContent,
                size: chunkContent.length,
                startPos,
                endPos
            });

            startPos = endPos;
            index++;
        }

        return chunks;
    }

    createChunkNavigation() {
        const nav = document.createElement('div');
        nav.className = 'chunk-navigation';
        this.fileChunks.forEach((chunk, index) => {
            const btn = document.createElement('button');
            btn.className = 'chunk-btn';
            btn.id = `chunkBtn${index}`;
            btn.textContent = chunk.label.toUpperCase();
            nav.appendChild(btn);
        });
        return nav;
    }

    updateChunkInfo() {
        const chunkInfo = document.getElementById('chunkInfo');
        if (chunkInfo && this.fileChunks.length > 1) {
            const currentChunk = this.fileChunks[this.currentChunkIndex];
            chunkInfo.textContent = `Part ${currentChunk.label.toUpperCase()} (${this.currentChunkIndex + 1}/${this.fileChunks.length}) • ${this.formatFileSize(currentChunk.size)}`;
        }
    }

    switchToChunk(index) {
        this.currentChunkIndex = index;
        const generatedContent = document.getElementById('generatedContent');
        const currentChunk = this.fileChunks[index];
        generatedContent.textContent = currentChunk.content;

        const modalHeader = document.querySelector('#contentModal .modal-header h2');
        modalHeader.textContent = `📄 ${currentChunk.filename} (${this.currentChunkIndex + 1}/${this.fileChunks.length})`;

        const copyBtn = document.getElementById('copyContentBtn');
        copyBtn.textContent = `📋 Copy ${currentChunk.filename}`;
        copyBtn.classList.add('chunk-copy');

        document.querySelectorAll('.chunk-btn').forEach((btn, i) => {
            btn.setAttribute('aria-pressed', i === index ? 'true' : 'false');
        });

        this.updateChunkInfo();
        document.getElementById('contentDisplayModal').scrollTop = 0;
    }

    async copyAllChunks() {
        try {
            const allContent = this.fileChunks.map(chunk => chunk.content).join('\n');
            await navigator.clipboard.writeText(allContent);

            const copyBtn = document.getElementById('copyAllChunksBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ All Chunks Copied!';
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.classList.remove('copied');
            }, 2000);
        } catch (error) {
            console.error('Failed to copy all chunks:', error);
            alert('❌ Failed to copy all chunks. Please copy manually.');
        }
    }

    downloadAllChunks() {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const zip = new JSZip();

        this.fileChunks.forEach(chunk => {
            zip.file(`${chunk.filename}.txt`, chunk.content);
        });

        zip.generateAsync({ type: 'blob' }).then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `file_collection_${timestamp}.zip`;
            a.style.display = 'none';

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`📥 Download started: file_collection_${timestamp}.zip`);
        });
    }

    handleChunkKeyNavigation(event) {
        if (event.target.closest('#contentModal') && this.fileChunks.length > 1) {
            if (event.key === 'ArrowRight' && this.currentChunkIndex < this.fileChunks.length - 1) {
                this.switchToChunk(this.currentChunkIndex + 1);
                this.playChunkSound(); // Play sound on chunk switch
            } else if (event.key === 'ArrowLeft' && this.currentChunkIndex > 0) {
                this.switchToChunk(this.currentChunkIndex - 1);
                this.playChunkSound(); // Play sound on chunk switch
            }
        }
    }

    // New method to play sound
    playChunkSound() {
        this.audio.currentTime = 0; // Reset to start
        this.audio.play().catch(error => {
            console.error('Error playing sound:', error);
        });
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            this.settings = await response.json();
            console.log('Settings loaded:', this.settings);

            if (this.settings.defaultPath) {
                this.currentPath = this.settings.defaultPath;
                await this.loadDirectory(this.currentPath);
            }

            if (this.settings.includeDockerFiles) {
                await this.scanForDockerFiles();
            }

            if (this.settings.projectTypes?.django || this.settings.projectTypes?.react) {
                await this.scanForProjectFiles();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
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
            return response.ok;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    async openNativeFileBrowser() {
        try {
            const response = await fetch('/api/browse-directory', {
                method: 'POST'
            });
            const result = await response.json();
            if (result.success) {
                return result.path;
            }
            return null;
        } catch (error) {
            console.error('Error opening file browser:', error);
            return null;
        }
    }

    createFileItem(file, parentPath) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.path = file.path;
    item.dataset.type = file.type;

    const wrapper = document.createElement('div');
    wrapper.className = 'file-item-wrapper';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox';
    checkbox.checked = this.selectedFiles.has(file.path);

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = file.name;

    if (file.type === 'directory') {
        const arrow = document.createElement('span');
        arrow.className = 'directory-arrow';
        arrow.textContent = this.expandedDirectories.has(file.path) ? '➡️' : '🗂️'; // Use 🗂️ for directories, ➡️ for expanded
        wrapper.appendChild(arrow);
    } else {
        const fileIcon = document.createElement('span');
        fileIcon.className = 'file-icon';

        // Determine icon based on file extension or project type
        const extension = file.name.split('.').pop().toLowerCase();
        let isProjectFile = false;

        if (this.dockerFiles.some(dockerFile => dockerFile.path === file.path)) {
            fileIcon.textContent = '🐳'; // Docker file
            fileIcon.title = 'Docker file';
        } else if (this.djangoFiles.some(djangoFile => djangoFile.path === file.path)) {
            fileIcon.textContent = '🐍'; // Django file
            fileIcon.title = 'Django file';
            isProjectFile = true;
        } else if (this.reactFiles.some(reactFile => reactFile.path === file.path)) {
            fileIcon.textContent = '⚛️'; // React file
            fileIcon.title = 'React file';
            isProjectFile = true;
        } else if (extension === 'py') {
            fileIcon.textContent = '🐍'; // Python file
            fileIcon.title = 'Python file';
        } else if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            fileIcon.textContent = '⚛️'; // JavaScript/TypeScript file
            fileIcon.title = 'JavaScript/TypeScript file';
        } else if (extension === 'json') {
            fileIcon.textContent = '📋'; // JSON file
            fileIcon.title = 'JSON configuration file';
        } else if (extension === 'md') {
            fileIcon.textContent = '📝'; // Markdown file
            fileIcon.title = 'Markdown documentation';
        } else if (extension === 'txt') {
            fileIcon.textContent = '📄'; // Text file
            fileIcon.title = 'Text file';
        } else {
            fileIcon.textContent = '📎'; // Generic file
            fileIcon.title = 'Other file type';
        }

        // Highlight critical project files (e.g., settings.py, package.json)
        if ((file.name === 'settings.py' && this.settings.projectTypes?.django) ||
            (file.name === 'package.json' && this.settings.projectTypes?.react)) {
            fileIcon.textContent = '🛠️';
            fileIcon.title = 'Critical project file';
        }

        wrapper.appendChild(fileIcon);
    }

    wrapper.appendChild(name);

    if (file.type === 'file') {
        const size = document.createElement('span');
        size.className = 'size';
        size.textContent = this.formatFileSize(file.size);
        wrapper.appendChild(size);
    }

    item.appendChild(checkbox);
    item.appendChild(wrapper);

    checkbox.addEventListener('change', async () => {
        if (checkbox.checked) {
            this.selectedFiles.add(file.path);
            if (file.type === 'file') {
                await this.analyzeFileDependencies(file);
            } else {
                await this.selectDirectoryContents(file.path);
            }
        } else {
            this.selectedFiles.delete(file.path);
            if (file.type === 'file') {
                await this.removeDependencies(file.path);
            } else {
                await this.deselectDirectoryContents(file.path);
            }
        }
        this.updateValidateButton();
    });

    wrapper.addEventListener('click', async (e) => {
        if (file.type === 'directory') {
            await this.toggleDirectory(item, file.path);
        } else {
            await this.loadFileContent(file);
        }
        e.stopPropagation();
    });

    return item;
}

    async loadDirectory(dirPath) {
        try {
            const encodedPath = encodeURIComponent(dirPath.substring(1));
            const response = await fetch(`/api/directory/${encodedPath}`);
            const files = await response.json();

            const tree = document.getElementById('fileTree');
            tree.innerHTML = '';

            files.forEach(file => {
                const item = this.createFileItem(file, dirPath);
                tree.appendChild(item);

                if (file.type === 'directory' && this.expandedDirectories.has(file.path)) {
                    this.toggleDirectory(item, file.path);
                }
            });

            this.updateBreadcrumb(dirPath);
            this.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error loading directory:', error);
            const tree = document.getElementById('fileTree');
            tree.innerHTML = `<div class="error">❌ Error loading directory: ${error.message}</div>`;
        }
    }

    async scanForProjectFiles() {
        try {
            const projectTypes = [];
            if (this.settings.projectTypes?.django) projectTypes.push('django');
            if (this.settings.projectTypes?.react) projectTypes.push('react');

            for (const projectType of projectTypes) {
                const response = await fetch('/api/project-files', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ projectType, startPath: this.currentPath })
                });

                if (response.ok) {
                    const files = await response.json();
                    console.log(`🔧 Found ${files.length} ${projectType} files`);

                    if (projectType === 'django') {
                        this.djangoFiles = files;
                        files.forEach(file => this.selectedFiles.add(file.path));
                    } else if (projectType === 'react') {
                        this.reactFiles = files;
                        files.forEach(file => this.selectedFiles.add(file.path));
                    }
                }
            }

            this.updateValidateButton();
            this.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error scanning for project files:', error);
        }
    }

    async analyzeFileDependencies(file) {
        try {
            const content = await this.getFileContent(file.path);
            if (!content || content.isBinary) return;

            const dependencies = this.parseDependencies(content.content, file.path);
            if (dependencies.length === 0) return;

            this.fileDependencies.set(file.path, new Set());

            for (const dep of dependencies) {
                const resolvedPaths = await this.resolvePath(file.path, dep);
                resolvedPaths.forEach(depPath => {
                    this.fileDependencies.get(file.path).add(depPath);

                    if (!this.dependencyOwners.has(depPath)) {
                        this.dependencyOwners.set(depPath, new Set());
                    }
                    this.dependencyOwners.get(depPath).add(file.path);

                    if (!this.selectedFiles.has(depPath)) {
                        this.selectedFiles.add(depPath);

                        const fileItem = document.querySelector(`[data-path="${depPath}"]`);
                        if (fileItem) {
                            const indicator = document.createElement('span');
                            indicator.className = 'dependency-indicator';
                            indicator.textContent = '🔗';
                            indicator.title = `Dependency of ${file.path}`;
                            fileItem.querySelector('.file-item-wrapper').appendChild(indicator);
                        }
                    }
                });
            }

            this.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error analyzing dependencies:', error);
        }
    }

    parseDependencies(content, filePath) {
        const dependencies = [];
        const regexes = [
            // ES Module imports
            /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+['"]([^'"]+)['"]/g,
            // Dynamic imports
            /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            // CommonJS require
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            // Assignment with require
            /const\s+{([^}]+)}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
        ];

        regexes.forEach((regex, regexIndex) => {
            let match;
            let importedNames = [];
            let relativePath;

            while ((match = regex.exec(content)) !== null) {
                if (regexIndex === 0) {
                    importedNames = match[1].split(',').map(name => name.trim());
                    relativePath = match[2];
                } else if (regexIndex === 1) {
                    importedNames = [match[1]];
                    relativePath = match[2];
                } else if (regexIndex === 2 || regexIndex === 3 || regexIndex === 4) {
                    relativePath = match[1];
                    importedNames = [];
                } else if (regexIndex === 5) {
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

            const parseIndexFile = async (indexPath) => {
                try {
                    const content = await this.getFileContent(indexPath);
                    if (!content || content.isBinary) return [];

                    const reExports = [];
                    const lines = content.content.split('\n');

                    for (const line of lines) {
                        const defaultAsMatch = line.match(/export\s*\{\s*default\s+as\s+(\w+)\s*\}\s*from\s*['"`]([^'"`]+)['"`]/);
                        if (defaultAsMatch) {
                            reExports.push({
                                exportedName: defaultAsMatch[1],
                                stewardsPath: defaultAsMatch[2]
                            });
                            continue;
                        }

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

            let foundPath = await checkFileExists(resolvedPath);
            if (foundPath) {
                resolvedPaths.add(foundPath);
            }

            const hasNoExtension = (str) => {
                const lastSlash = str.lastIndexOf('/');
                const lastDot = str.lastIndexOf('.');
                return lastDot === -1 || lastDot < lastSlash;
            };

            if (hasNoExtension(relativePath)) {
                const extensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];

                for (const ext of extensions) {
                    const pathWithExt = resolvedPath + ext;
                    foundPath = await checkFileExists(pathWithExt);
                    if (foundPath) {
                        resolvedPaths.add(foundPath);
                    }
                }

                for (const ext of extensions) {
                    const indexPath = resolvedPath + '/index' + ext;
                    foundPath = await checkFileExists(indexPath);
                    if (foundPath) {
                        resolvedPaths.add(foundPath);

                        if (importedNames && importedNames.length > 0) {
                            const reExports = await parseIndexFile(foundPath);
                            const indexDir = foundPath.substring(0, foundPath.lastIndexOf('/'));

                            for (const importedName of importedNames) {
                                if (importedName) {
                                    const matchingExport = reExports.find(reExport =>
                                        reExport.exportedName === importedName || reExport.exportedName === '*'
                                    );

                                    if (matchingExport) {
                                        const reExportPath = resolveRelativeToIndex(indexDir, matchingExport.relativePath);

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

            return Array.from(resolvedPaths);
        } catch (error) {
            console.error('❌ Error resolving path:', error);
            return [];
        }
    }

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

        // Add file-type-specific icon to header
        let icon = '📄';
        const extension = file.name.split('.').pop().toLowerCase();
        if (this.dockerFiles.some(dockerFile => dockerFile.path === file.path)) {
            icon = '🐳';
        } else if (this.djangoFiles.some(djangoFile => djangoFile.path === file.path)) {
            icon = '🐍';
        } else if (this.reactFiles.some(reactFile => reactFile.path === file.path)) {
            icon = '⚛️';
        } else if (extension === 'py') {
            icon = '🐍';
        } else if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            icon = '⚛️';
        } else if (extension === 'json') {
            icon = '📋';
        } else if (extension === 'md') {
            icon = '📝';
        } else if (content && content.isBinary) {
            icon = '🔢';
        }
        if (file.name === 'settings.py' || file.name === 'package.json') {
            icon = '🛠️';
        }

        header.firstChild.textContent = `${icon} ${file.name}`;

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
            fileInfo.textContent = `🔢 Binary file (${this.formatFileSize(file.size)})`;
            display.innerHTML = `
                <div class="empty-state">
                    <p>🔢 Binary file</p>
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

    async generateFile() {
        try {
            const selectedFilesList = Array.from(this.selectedFiles).filter(path => {
                const item = document.querySelector(`[data-path="${path}"]`);
                return !item || item.dataset.type === 'file';
            });

            let output = '';

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

            output += '\n' + '='.repeat(80) + '\n\n';
            output += 'DONE PASTING\n\n';

            if (fileInfoList.length > 0) {
                output += `I just gave you ${fileInfoList.length} files that are: ${fileInfoList.join(', ')}\n\n`;
            }

            output += 'Now here are your instructions:\n\n';

            if (this.settings.customPrompt && this.settings.customPrompt.trim()) {
                output += this.settings.customPrompt.trim() + '\n';
            } else {
                output += 'Please analyze the provided project files and provide insights or assistance as needed.\n';
            }

            this.generatedFileContent = output;

            if (output.length > this.chunkSize) {
                this.fileChunks = this.splitIntoChunks(output, this.chunkSize);
                console.log(`📦 Created ${this.fileChunks.length} chunks from ${output.length} characters`);

                this.fileChunks = this.fileChunks.map((chunk, index) => {
                    let chunkContent = chunk.content;
                    if (index < this.fileChunks.length - 1) {
                        chunkContent = `I'm going to paste multiple parts of my Django/React project files. IMPORTANT: Just respond with "Ready for part ${index + 2}" after each part until I say "DONE PASTING". Do not analyze, suggest changes, or provide any code until I finish providing all parts.\n\n${chunkContent}`;
                    } else {
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

    showSuccessModal(result, enabledProjectTypes) {
    const modal = document.getElementById('successModal');

    document.getElementById('successFilename').textContent = result.filename;
    document.getElementById('successDirectory').textContent = '📂 output_files_selected/';
    document.getElementById('successFullPath').textContent = result.relativePath;

    const fileSize = new Blob([this.generatedFileContent]).size;
    document.getElementById('successFileSize').textContent = this.formatFileSize(fileSize);

    const selectedFilesList = Array.from(this.selectedFiles).filter(path => {
        const item = document.querySelector(`[data-path="${path}"]`);
        return !item || item.dataset.type === 'file';
    });

    const lines = this.generatedFileContent.split('\n').length;
    const characters = this.generatedFileContent.length;

    document.getElementById('successTotalFiles').textContent = selectedFilesList.length;
    document.getElementById('successTotalLines').textContent = lines.toLocaleString();
    document.getElementById('successTotalChars').textContent = characters.toLocaleString();

    const chunkStat = document.getElementById('successChunkStat');
    if (this.fileChunks.length > 1) {
        chunkStat.style.display = 'flex';
        document.getElementById('successChunkCount').textContent = this.fileChunks.length;
    } else {
        chunkStat.style.display = 'none';
    }

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

    const customPromptFeature = document.getElementById('successCustomPromptFeature');
    if (this.settings.customPrompt && this.settings.customPrompt.trim()) {
        customPromptFeature.style.display = 'flex';
        customPromptFeature.innerHTML = '✍️ Custom Prompt Included';
    } else {
        customPromptFeature.style.display = 'none';
    }

    const dockerFeature = document.getElementById('successDockerFeature');
    if (this.dockerFiles.length > 0) {
        dockerFeature.style.display = 'flex';
        dockerFeature.innerHTML = '🐳 Docker Files Included';
    } else {
        dockerFeature.style.display = 'none';
    }

    const dependencyFeature = document.getElementById('successDependencyFeature');
    if (this.fileDependencies.size > 0) {
        dependencyFeature.style.display = 'flex';
        dependencyFeature.innerHTML = '🔗 Dependencies Analyzed';
    } else {
        dependencyFeature.style.display = 'none';
    }

    modal.classList.remove('hidden');
}

    hideSuccessModal() {
        document.getElementById('successModal').classList.add('hidden');
    }

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

        const successModal = document.getElementById('successModal');
        if (successModal) {
            successModal.addEventListener('click', (e) => {
                if (e.target === successModal) {
                    this.hideSuccessModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !successModal.classList.contains('hidden')) {
                this.hideSuccessModal();
            }
        });
    }

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
                    btn.addEventListener('click', () => {
                        this.switchToChunk(index);
                        this.playChunkSound(); // Play sound on chunk button click
                    });
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

    setupEventListeners() {
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

        const copyAllChunksBtn = document.getElementById('copyAllChunksBtn');
        if (copyAllChunksBtn) {
            copyAllChunksBtn.addEventListener('click', () => this.copyAllChunks());
        }

        const downloadAllChunks = document.getElementById('downloadAllChunks');
        if (downloadAllChunks) {
            downloadAllChunks.addEventListener('click', () => this.downloadAllChunks());
        }

        document.addEventListener('keydown', (event) => this.handleChunkKeyNavigation(event));

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
                    const icon = file.name === 'settings.py' ? '🛠️' : '🐍';
                    previewHtml += `<div class="project-file-item django">${icon} ${file.relativePath} <span class="file-type">${file.type}</span></div`;
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
                    const icon = file.name === 'package.json' ? '🛠️' : '⚛️';
                    previewHtml += `<div class="project-file-item react">${icon} ${file.relativePath} <span class="file-type">${file.type}</span></div>`;
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

const explorer = new FileExplorer();
document.addEventListener('DOMContentLoaded', () => explorer.init());