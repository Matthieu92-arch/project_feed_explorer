export class ContentGenerator {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
    }

    async generateFile() {
        try {
            const selectedFilesList = Array.from(this.fileExplorer.selectedFiles).filter(path => {
                const item = document.querySelector(`[data-path="${path}"]`);
                return !item || item.dataset.type === 'file';
            });

            let output = '';

            // Generate header
            output += this.generateHeader(selectedFilesList);

            // Generate file contents
            const fileInfoList = [];
            for (const filePath of selectedFilesList.sort()) {
                const fileOutput = await this.processFile(filePath, fileInfoList);
                output += fileOutput;
            }

            // Generate footer
            output += this.generateFooter(fileInfoList);

            this.fileExplorer.generatedFileContent = output;

            // Process content into chunks
            this.fileExplorer.chunkManager.processContent(output);

            // Save to server
            const result = await this.saveToServer(output);

            if (result.success) {
                const enabledProjectTypes = this.getEnabledProjectTypes();
                return { ...result, enabledProjectTypes };
            } else {
                return result;
            }

        } catch (error) {
            console.error('Error generating file:', error);
            throw error;
        }
    }

    generateHeader(selectedFilesList) {
        let output = 'FILE COLLECTION\n';
        output += '='.repeat(80) + '\n\n';
        output += `Generated: ${new Date().toISOString()}\n`;
        output += `Total files: ${selectedFilesList.length}\n`;
        output += `Root directory: ${this.fileExplorer.currentPath}\n`;

        const enabledProjectTypes = this.getEnabledProjectTypes();
        if (enabledProjectTypes.length > 0) {
            output += `Project types detected: ${enabledProjectTypes.join(', ')}\n`;
        }

        if (this.fileExplorer.dockerFiles.length > 0) {
            output += `Docker files included: ${this.fileExplorer.dockerFiles.length}\n`;
        }
        
        output += `Output saved to: output_files_selected/ directory\n\n`;

        return output;
    }

    async processFile(filePath, fileInfoList) {
        try {
            if (typeof filePath !== 'string') {
                console.error('Invalid filePath type:', typeof filePath, filePath);
                return '';
            }

            const content = await this.fileExplorer.fileManager.getFileContent(filePath);
            const fileName = filePath.split('/').pop();
            const directory = filePath.substring(0, filePath.lastIndexOf('/'));
            const relativePath = filePath.replace(this.fileExplorer.currentPath, '').replace(/^\//, '');

            const displayPath = relativePath || fileName;
            fileInfoList.push(displayPath);

            let output = '='.repeat(80) + '\n';
            output += `filename: ${fileName}\n`;
            output += `directory: ${directory}\n`;
            output += `relative_path: ${relativePath}\n`;
            output += `full_path: ${filePath}\n`;

            const classifications = this.getFileClassifications(filePath);
            if (classifications.length > 0) {
                output += `classification: ${classifications.join(', ')}\n`;
            }

            if (content && content.isBinary) {
                output += `type: binary\n`;
                output += `size: ${this.fileExplorer.formatFileSize(new Blob(['']).size)}\n`;
            } else if (content) {
                output += `type: text\n`;
                output += `lines: ${content.lines}\n`;
                output += `size: ${this.fileExplorer.formatFileSize(new Blob([content.content]).size)}\n`;
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
            return output;

        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            const fileName = typeof filePath === 'string' ? filePath.split('/').pop() : 'unknown';
            const directory = typeof filePath === 'string' ? filePath.substring(0, filePath.lastIndexOf('/')) : 'unknown';

            if (typeof filePath === 'string') {
                const relativePath = filePath.replace(this.fileExplorer.currentPath, '').replace(/^\//, '');
                const displayPath = relativePath || fileName;
                fileInfoList.push(displayPath);
            }

            let output = '='.repeat(80) + '\n';
            output += `filename: ${fileName}\n`;
            output += `directory: ${directory}\n`;
            output += `full_path: ${filePath}\n`;
            output += `error: ${error.message}\n`;
            output += '='.repeat(80) + '\n\n';
            output += '// Error reading file\n\n';
            return output;
        }
    }

    getFileClassifications(filePath) {
        const classifications = [];
        
        if (this.fileExplorer.dockerFiles.some(dockerFile => dockerFile.path === filePath)) {
            classifications.push('docker');
        }
        
        if (this.fileExplorer.djangoFiles.some(djangoFile => djangoFile.path === filePath)) {
            const djangoFile = this.fileExplorer.djangoFiles.find(df => df.path === filePath);
            classifications.push(`django-${djangoFile.type}`);
        }
        
        if (this.fileExplorer.reactFiles.some(reactFile => reactFile.path === filePath)) {
            const reactFile = this.fileExplorer.reactFiles.find(rf => rf.path === filePath);
            classifications.push(`react-${reactFile.type}`);
        }
        
        return classifications;
    }

    generateFooter(fileInfoList) {
        let output = '\n' + '='.repeat(80) + '\n\n';
        output += 'DONE PASTING\n\n';

        if (fileInfoList.length > 0) {
            output += `I just gave you ${fileInfoList.length} files that are: ${fileInfoList.join(', ')}\n\n`;
        }

        output += 'Now here are your instructions:\n\n';

        if (this.fileExplorer.settingsManager.settings.customPrompt?.trim()) {
            output += this.fileExplorer.settingsManager.settings.customPrompt.trim() + '\n';
        } else {
            output += 'Please analyze the provided project files and provide insights or assistance as needed.\n';
        }

        return output;
    }

    getEnabledProjectTypes() {
        const enabledProjectTypes = [];
        
        if (this.fileExplorer.settingsManager.settings.projectTypes.django && this.fileExplorer.djangoFiles.length > 0) {
            enabledProjectTypes.push(`Django (${this.fileExplorer.djangoFiles.length} files)`);
        }
        
        if (this.fileExplorer.settingsManager.settings.projectTypes.react && this.fileExplorer.reactFiles.length > 0) {
            enabledProjectTypes.push(`React (${this.fileExplorer.reactFiles.length} files)`);
        }
        
        return enabledProjectTypes;
    }

    async saveToServer(content) {
        try {
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                },
                body: content
            });

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error saving to server:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}