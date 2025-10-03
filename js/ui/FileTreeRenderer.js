// js/ui/FileTreeRenderer.js
export class FileTreeRenderer {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
    }

    createFileItem(file, parentPath) {
        const item = document.createElement('div');
        item.className = `file-item ${file.type}`;
        item.dataset.path = file.path;
        item.dataset.type = file.type;
        if (file.isHidden) {
            item.classList.add('hidden-file');
        }
        
        // Add file extension for styling
        if (file.type === 'file') {
            const extension = this.getFileExtension(file.name);
            if (extension) {
                item.dataset.extension = extension;
            }
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'file-item-wrapper';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox';
        checkbox.checked = this.fileExplorer.selectedFiles.has(file.path);

        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = file.name;
        name.title = file.path; // Tooltip with full path

        if (file.type === 'directory') {
            const arrow = this.createDirectoryArrow(file);
            wrapper.appendChild(arrow);
        } else {
            const fileIcon = this.getFileIcon(file);
            wrapper.appendChild(fileIcon);
        }

        wrapper.appendChild(name);

        if (file.type === 'file') {
            const size = document.createElement('span');
            size.className = 'file-size';
            size.textContent = this.fileExplorer.formatFileSize(file.size);
            wrapper.appendChild(size);
        }

        item.appendChild(checkbox);
        item.appendChild(wrapper);

        this.setupFileItemEvents(item, checkbox, wrapper, file);
        this.addFileItemAnimations(item);

        return item;
    }

    getFileExtension(filename) {
        const parts = filename.split('.');
        if (parts.length > 1) {
            return parts[parts.length - 1].toLowerCase();
        }
        return null;
    }

    createDirectoryArrow(file) {
        const arrow = document.createElement('span');
        arrow.className = 'directory-arrow';
        arrow.innerHTML = this.fileExplorer.expandedDirectories.has(file.path) ? '📂' : '📁';
        arrow.title = `${this.fileExplorer.expandedDirectories.has(file.path) ? 'Collapse' : 'Expand'} directory`;
        return arrow;
    }

    getFileIcon(file) {
        const fileIcon = document.createElement('span');
        fileIcon.className = 'file-icon';
        
        const extension = file.name.split('.').pop().toLowerCase();
        let icon = '📄';
        let title = 'File';
        
        // Project-specific files first
        if (this.fileExplorer.dockerFiles.some(dockerFile => dockerFile.path === file.path)) {
            icon = '🐳';
            title = 'Docker file';
            fileIcon.dataset.type = 'docker';
        } else if (this.fileExplorer.djangoFiles.some(djangoFile => djangoFile.path === file.path)) {
            icon = '🐍';
            title = 'Django file';
            fileIcon.dataset.type = 'django';
        } else if (this.fileExplorer.reactFiles.some(reactFile => reactFile.path === file.path)) {
            icon = '⚛️';
            title = 'React file';
            fileIcon.dataset.type = 'react';
        } 
        // File type detection
        else if (extension === 'py') {
            icon = '🐍';
            title = 'Python file';
        } else if (['js', 'jsx', 'mjs'].includes(extension)) {
            icon = '🟨';
            title = 'JavaScript file';
        } else if (['ts', 'tsx'].includes(extension)) {
            icon = '🔷';
            title = 'TypeScript file';
        } else if (extension === 'json') {
            icon = '📋';
            title = 'JSON configuration file';
        } else if (['md', 'markdown'].includes(extension)) {
            icon = '📝';
            title = 'Markdown documentation';
        } else if (['txt', 'log'].includes(extension)) {
            icon = '📄';
            title = 'Text file';
        } else if (['css', 'scss', 'sass', 'less'].includes(extension)) {
            icon = '🎨';
            title = 'Stylesheet';
        } else if (['html', 'htm'].includes(extension)) {
            icon = '🌐';
            title = 'HTML file';
        } else if (['xml', 'svg'].includes(extension)) {
            icon = '📰';
            title = 'XML/SVG file';
        } else if (['yaml', 'yml'].includes(extension)) {
            icon = '⚙️';
            title = 'YAML configuration';
        } else if (['toml', 'ini', 'conf', 'config'].includes(extension)) {
            icon = '🔧';
            title = 'Configuration file';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
            icon = '🖼️';
            title = 'Image file';
        } else if (['mp4', 'avi', 'mov', 'webm'].includes(extension)) {
            icon = '🎬';
            title = 'Video file';
        } else if (['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
            icon = '🎵';
            title = 'Audio file';
        } else if (['zip', 'tar', 'gz', 'rar', '7z'].includes(extension)) {
            icon = '📦';
            title = 'Archive file';
        } else if (['pdf'].includes(extension)) {
            icon = '📕';
            title = 'PDF document';
        } else if (['doc', 'docx'].includes(extension)) {
            icon = '📘';
            title = 'Word document';
        } else if (['xls', 'xlsx'].includes(extension)) {
            icon = '📗';
            title = 'Excel spreadsheet';
        } else if (['sh', 'bash', 'zsh', 'fish'].includes(extension)) {
            icon = '⚡';
            title = 'Shell script';
        } else if (file.name.startsWith('.')) {
            icon = '👁️';
            title = 'Hidden file';
        }

        // Special files
        if (file.name === 'package.json') {
            icon = '📦';
            title = 'Node.js package configuration';
        } else if (file.name === 'requirements.txt') {
            icon = '📋';
            title = 'Python requirements';
        } else if (file.name === 'Dockerfile') {
            icon = '🐳';
            title = 'Docker container configuration';
        } else if (file.name.includes('docker-compose')) {
            icon = '🐳';
            title = 'Docker Compose configuration';
        } else if (file.name === '.gitignore') {
            icon = '🚫';
            title = 'Git ignore rules';
        } else if (file.name === 'README.md') {
            icon = '📖';
            title = 'Project documentation';
        } else if (file.name === 'LICENSE') {
            icon = '⚖️';
            title = 'License file';
        }

        // Critical project files get special treatment
        if ((file.name === 'settings.py' && this.fileExplorer.settingsManager.settings.projectTypes?.django) ||
            (file.name === 'package.json' && this.fileExplorer.settingsManager.settings.projectTypes?.react)) {
            icon = '🛠️';
            title = 'Critical project file';
            fileIcon.classList.add('critical-file');
        }

        fileIcon.textContent = icon;
        fileIcon.title = title;
        return fileIcon;
    }

    setupFileItemEvents(item, checkbox, wrapper, file) {
        // Checkbox event handler
        checkbox.addEventListener('change', async (e) => {
            e.stopPropagation();
            
            // Add selection animation
            item.classList.add('selecting');
            setTimeout(() => item.classList.remove('selecting'), 300);
            
            if (checkbox.checked) {
                this.fileExplorer.selectedFiles.add(file.path);
                if (file.type === 'file') {
                    await this.fileExplorer.dependencyAnalyzer.analyzeFileDependencies(file);
                } else {
                    await this.fileExplorer.fileManager.selectDirectoryContents(file.path);
                }
            } else {
                this.fileExplorer.selectedFiles.delete(file.path);
                if (file.type === 'file') {
                    await this.fileExplorer.dependencyAnalyzer.removeDependencies(file.path);
                } else {
                    await this.fileExplorer.fileManager.deselectDirectoryContents(file.path);
                }
            }
            this.fileExplorer.updateValidateButton();
        });

        // Main item click handler - click anywhere on the line
        item.addEventListener('click', async (e) => {
            // Don't trigger if clicking on the checkbox
            if (e.target === checkbox) {
                return;
            }
            
            e.stopPropagation();
            
            if (file.type === 'directory') {
                // For directories: expand/collapse
                await this.fileExplorer.fileManager.toggleDirectory(item, file.path);
                this.updateDirectoryArrow(item, file.path);
            } else {
                // For files: load content and highlight
                await this.fileExplorer.uiManager.loadFileContent(file);
                this.highlightSelectedFile(item);
            }
        });

        // Optional: Double-click to toggle checkbox
        item.addEventListener('dblclick', async (e) => {
            if (e.target === checkbox) {
                return;
            }
            
            e.stopPropagation();
            
            // Toggle checkbox programmatically
            checkbox.checked = !checkbox.checked;
            
            // Trigger the checkbox change event
            const changeEvent = new Event('change', { bubbles: true });
            checkbox.dispatchEvent(changeEvent);
        });

        // Add hover effects
        item.addEventListener('mouseenter', () => {
            if (!item.classList.contains('selected')) {
                item.style.transform = 'translateX(4px)';
            }
        });

        item.addEventListener('mouseleave', () => {
            if (!item.classList.contains('selected')) {
                item.style.transform = '';
            }
        });
    }

    updateDirectoryArrow(item, path) {
        const arrow = item.querySelector('.directory-arrow');
        if (arrow) {
            const isExpanded = this.fileExplorer.expandedDirectories.has(path);
            arrow.innerHTML = isExpanded ? '📂' : '📁';
            arrow.title = `${isExpanded ? 'Collapse' : 'Expand'} directory`;
            arrow.classList.toggle('expanded', isExpanded);
        }
    }

    highlightSelectedFile(item) {
        // Remove previous selection
        document.querySelectorAll('.file-item.selected').forEach(el => {
            el.classList.remove('selected');
            el.style.transform = '';
        });
        
        // Add selection to current item
        item.classList.add('selected');
        item.style.transform = 'translateX(4px)';
    }

    addFileItemAnimations(item) {
        // Add entrance animation
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';
        
        // Trigger animation
        requestAnimationFrame(() => {
            item.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        });
    }

    updateBreadcrumb(path) {
        const breadcrumb = document.getElementById('breadcrumb');
        const parts = path.split('/').filter(p => p);

        breadcrumb.innerHTML = '';
        let currentPath = '';

        // Root item with home icon
        const rootItem = document.createElement('span');
        rootItem.className = 'breadcrumb-item';
        rootItem.innerHTML = '🏠';
        rootItem.dataset.path = '/';
        rootItem.title = 'Root directory';
        rootItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.fileExplorer.navigateToDirectory('/');
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
            item.title = currentPath;

            // Last item gets special styling
            if (index === parts.length - 1) {
                item.style.fontWeight = '600';
                item.style.color = '#a5d6a7';
            }

            const targetPath = currentPath;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.fileExplorer.navigateToDirectory(targetPath);
            });

            breadcrumb.appendChild(item);
        });

        // Add animation to breadcrumb
        breadcrumb.style.opacity = '0';
        requestAnimationFrame(() => {
            breadcrumb.style.transition = 'opacity 0.3s ease';
            breadcrumb.style.opacity = '1';
        });
    }
}