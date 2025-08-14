export class ContentViewer {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
    }

    setupEventListeners() {
        // Any specific content viewer event listeners can go here
    }

    async loadFileContent(file) {
        try {
            const content = await this.fileExplorer.fileManager.getFileContent(file.path);
            const header = document.getElementById('contentHeader');
            const fileInfo = document.getElementById('fileInfo');
            const display = document.getElementById('contentDisplay');

            // Add file-type-specific icon to header
            const icon = this.getFileIcon(file, content);
            header.firstChild.textContent = `${icon} ${file.name}`;

            if (!content) {
                this.showErrorState(display, 'Could not load file');
                return;
            }

            if (content.isBinary) {
                fileInfo.textContent = `🔢 Binary file (${this.fileExplorer.formatFileSize(file.size)})`;
                this.showBinaryState(display);
            } else {
                fileInfo.textContent = `${content.lines} lines • ${this.fileExplorer.formatFileSize(file.size)}`;
                this.showTextContent(display, content);
            }
        } catch (error) {
            console.error('Error loading file content:', error);
            this.showErrorState(document.getElementById('contentDisplay'), error.message);
        }
    }

    getFileIcon(file, content) {
        let icon = '📄';
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (this.fileExplorer.dockerFiles.some(dockerFile => dockerFile.path === file.path)) {
            icon = '🐳';
        } else if (this.fileExplorer.djangoFiles.some(djangoFile => djangoFile.path === file.path)) {
            icon = '🐍';
        } else if (this.fileExplorer.reactFiles.some(reactFile => reactFile.path === file.path)) {
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
        
        return icon;
    }

    showErrorState(display, message) {
        display.innerHTML = `
            <div class="empty-state">
                <p>❌ ${message}</p>
                <p style="font-size: 12px; margin-top: 8px;">File may not exist or be inaccessible</p>
            </div>
        `;
    }

    showBinaryState(display) {
        display.innerHTML = `
            <div class="empty-state">
                <p>🔢 Binary file</p>
                <p style="font-size: 12px; margin-top: 8px;">Cannot display binary content</p>
            </div>
        `;
    }

    showTextContent(display, content) {
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
}