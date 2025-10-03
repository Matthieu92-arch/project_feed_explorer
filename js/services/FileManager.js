// js/services/FileManager.js
export class FileManager {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
    }

    async loadDirectory(dirPath) {
        try {
            // Remove leading slash and encode each path segment separately
            const pathWithoutLeadingSlash = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
            const pathSegments = pathWithoutLeadingSlash.split('/');
            const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
            const encodedPath = encodedSegments.join('/');
            
            // NEW: Add showHidden query parameter
            const showHidden = this.fileExplorer.settingsManager.settings.showHiddenFiles || false;
            const response = await fetch(`/api/directory/${encodedPath}?showHidden=${showHidden}`);
            
            const files = await response.json();

            const tree = document.getElementById('fileTree');
            tree.innerHTML = '';

            files.forEach(file => {
                const item = this.fileExplorer.uiManager.createFileItem(file, dirPath);
                tree.appendChild(item);

                if (file.type === 'directory' && this.fileExplorer.expandedDirectories.has(file.path)) {
                    this.toggleDirectory(item, file.path);
                }
            });

            this.fileExplorer.uiManager.updateBreadcrumb(dirPath);
            this.fileExplorer.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error loading directory:', error);
            const tree = document.getElementById('fileTree');
            tree.innerHTML = `<div class="error">❌ Error loading directory: ${error.message}</div>`;
        }
    }


    async toggleDirectory(item, path) {
        const arrow = item.querySelector('.directory-arrow');
        let children = item.nextElementSibling;

        if (children && children.classList.contains('children')) {
            children.classList.toggle('hidden');
            arrow.classList.toggle('expanded');

            if (children.classList.contains('hidden')) {
                this.fileExplorer.expandedDirectories.delete(path);
            } else {
                this.fileExplorer.expandedDirectories.add(path);
            }
        } else {
            try {
                // Remove leading slash and encode each path segment separately
                const pathWithoutLeadingSlash = path.startsWith('/') ? path.substring(1) : path;
                const pathSegments = pathWithoutLeadingSlash.split('/');
                const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
                const encodedPath = encodedSegments.join('/');
                
                // NEW: Add showHidden query parameter
                const showHidden = this.fileExplorer.settingsManager.settings.showHiddenFiles || false;
                const response = await fetch(`/api/directory/${encodedPath}?showHidden=${showHidden}`);
                
                const files = await response.json();

                children = document.createElement('div');
                children.className = 'children';

                files.forEach(file => {
                    const childItem = this.fileExplorer.uiManager.createFileItem(file, path);
                    children.appendChild(childItem);
                });

                item.parentNode.insertBefore(children, item.nextSibling);
                arrow.classList.add('expanded');
                this.fileExplorer.expandedDirectories.add(path);
            } catch (error) {
                console.error('Error loading directory contents:', error);
            }
        }
    }

    async selectDirectoryContents(dirPath) {
        try {
            // Remove leading slash and encode each path segment separately
            const pathWithoutLeadingSlash = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
            const pathSegments = pathWithoutLeadingSlash.split('/');
            const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
            const encodedPath = encodedSegments.join('/');
            
            const response = await fetch(`/api/directory/${encodedPath}`);
            const files = await response.json();

            for (const file of files) {
                this.fileExplorer.selectedFiles.add(file.path);

                if (file.type === 'directory') {
                    await this.selectDirectoryContents(file.path);
                } else if (file.type === 'file') {
                    await this.fileExplorer.dependencyAnalyzer.analyzeFileDependencies(file);
                }
            }

            this.fileExplorer.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error selecting directory contents:', error);
        }
    }

    async deselectDirectoryContents(dirPath) {
        try {
            // Remove leading slash and encode each path segment separately
            const pathWithoutLeadingSlash = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
            const pathSegments = pathWithoutLeadingSlash.split('/');
            const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
            const encodedPath = encodedSegments.join('/');
            
            const response = await fetch(`/api/directory/${encodedPath}`);
            const files = await response.json();

            for (const file of files) {
                this.fileExplorer.selectedFiles.delete(file.path);

                if (file.type === 'directory') {
                    await this.deselectDirectoryContents(file.path);
                }
            }

            this.fileExplorer.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error deselecting directory contents:', error);
        }
    }

    async getFileContent(filePath) {
        if (this.fileExplorer.fileContents.has(filePath)) {
            return this.fileExplorer.fileContents.get(filePath);
        }

        try {
            // Remove leading slash and encode each path segment separately
            const pathWithoutLeadingSlash = filePath.startsWith('/') ? filePath.substring(1) : filePath;
            const pathSegments = pathWithoutLeadingSlash.split('/');
            const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
            const encodedPath = encodedSegments.join('/');
            
            const response = await fetch(`/api/file/${encodedPath}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.json();
            this.fileExplorer.fileContents.set(filePath, content);
            return content;
        } catch (error) {
            console.error('Error reading file:', error);
            return null;
        }
    }

    async checkFileExists(filePath) {
        try {
            // Remove leading slash and encode each path segment separately
            const pathWithoutLeadingSlash = filePath.startsWith('/') ? filePath.substring(1) : filePath;
            const pathSegments = pathWithoutLeadingSlash.split('/');
            const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
            const encodedPath = encodedSegments.join('/');
            
            const response = await fetch(`/api/exists/${encodedPath}`);
            const result = await response.json();
            return result.exists && result.isFile;
        } catch (error) {
            console.error('Error checking file existence:', error);
            return false;
        }
    }

    async directoryExists(dirPath) {
        try {
            // Remove leading slash and encode each path segment separately
            const pathWithoutLeadingSlash = dirPath.startsWith('/') ? dirPath.substring(1) : dirPath;
            const pathSegments = pathWithoutLeadingSlash.split('/');
            const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
            const encodedPath = encodedSegments.join('/');
            
            const response = await fetch(`/api/exists/${encodedPath}`);
            const result = await response.json();
            return result.exists && result.isDirectory;
        } catch (error) {
            console.error('Error checking directory existence:', error);
            return false;
        }
    }
}