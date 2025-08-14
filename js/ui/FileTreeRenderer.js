export class FileTreeRenderer {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
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
        checkbox.checked = this.fileExplorer.selectedFiles.has(file.path);

        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = file.name;

        if (file.type === 'directory') {
            const arrow = document.createElement('span');
            arrow.className = 'directory-arrow';
            arrow.textContent = this.fileExplorer.expandedDirectories.has(file.path) ? '➡️' : '🗂️';
            wrapper.appendChild(arrow);
        } else {
            const fileIcon = this.getFileIcon(file);
            wrapper.appendChild(fileIcon);
        }

        wrapper.appendChild(name);

        if (file.type === 'file') {
            const size = document.createElement('span');
            size.className = 'size';
            size.textContent = this.fileExplorer.formatFileSize(file.size);
            wrapper.appendChild(size);
        }

        item.appendChild(checkbox);
        item.appendChild(wrapper);

        this.setupFileItemEvents(item, checkbox, wrapper, file);

        return item;
    }

    getFileIcon(file) {
        const fileIcon = document.createElement('span');
        fileIcon.className = 'file-icon';
        
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (this.fileExplorer.dockerFiles.some(dockerFile => dockerFile.path === file.path)) {
            fileIcon.textContent = '🐳';
            fileIcon.title = 'Docker file';
        } else if (this.fileExplorer.djangoFiles.some(djangoFile => djangoFile.path === file.path)) {
            fileIcon.textContent = '🐍';
            fileIcon.title = 'Django file';
        } else if (this.fileExplorer.reactFiles.some(reactFile => reactFile.path === file.path)) {
            fileIcon.textContent = '⚛️';
            fileIcon.title = 'React file';
        } else if (extension === 'py') {
            fileIcon.textContent = '🐍';
            fileIcon.title = 'Python file';
        } else if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            fileIcon.textContent = '⚛️';
            fileIcon.title = 'JavaScript/TypeScript file';
        } else if (extension === 'json') {
            fileIcon.textContent = '📋';
            fileIcon.title = 'JSON configuration file';
        } else if (extension === 'md') {
            fileIcon.textContent = '📝';
            fileIcon.title = 'Markdown documentation';
        } else if (extension === 'txt') {
            fileIcon.textContent = '📄';
            fileIcon.title = 'Text file';
        } else {
            fileIcon.textContent = '📎';
            fileIcon.title = 'Other file type';
        }

        // Highlight critical project files
        if ((file.name === 'settings.py' && this.fileExplorer.settingsManager.settings.projectTypes?.django) ||
            (file.name === 'package.json' && this.fileExplorer.settingsManager.settings.projectTypes?.react)) {
            fileIcon.textContent = '🛠️';
            fileIcon.title = 'Critical project file';
        }

        return fileIcon;
    }

    setupFileItemEvents(item, checkbox, wrapper, file) {
        checkbox.addEventListener('change', async () => {
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

        wrapper.addEventListener('click', async (e) => {
            if (file.type === 'directory') {
                await this.fileExplorer.fileManager.toggleDirectory(item, file.path);
            } else {
                await this.fileExplorer.uiManager.loadFileContent(file);
            }
            e.stopPropagation();
        });
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

            const targetPath = currentPath;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.fileExplorer.navigateToDirectory(targetPath);
            });

            breadcrumb.appendChild(item);
        });
    }
}