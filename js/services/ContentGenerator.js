export class ContentGenerator {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.contentFilter = fileExplorer.contentFilter;
    }

    async generateFile() {
        try {
            const selectedFilesList = Array.from(this.fileExplorer.selectedFiles).filter(path => {
                const item = document.querySelector(`[data-path="${path}"]`);
                return !item || item.dataset.type === 'file';
            });

            // Apply smart filtering and prioritization
            const filterResult = this.contentFilter.filterAndPrioritizeFiles(selectedFilesList);
            const filteredFiles = filterResult.included.map(f => f.path);
            const filteringSummary = this.contentFilter.generateFilteringSummary(filterResult);

            let output = '';

            // Generate enhanced header with filtering info
            output += this.generateEnhancedHeader(filteredFiles, filteringSummary);

            // Generate file contents in priority order
            const fileInfoList = [];
            for (const fileData of filterResult.included) {
                const fileOutput = await this.processFile(fileData.path, fileData.priority, fileInfoList);
                output += fileOutput;
            }

            // Generate footer with excluded files info
            output += this.generateEnhancedFooter(fileInfoList, filterResult);

            this.fileExplorer.generatedFileContent = output;

            // Process content into chunks
            this.fileExplorer.chunkManager.processContent(output);

            // Save to server
            const result = await this.saveToServer(output);

            if (result.success) {
                const enabledProjectTypes = this.getEnabledProjectTypes();
                return { 
                    ...result, 
                    enabledProjectTypes,
                    filteringSummary 
                };
            } else {
                return result;
            }

        } catch (error) {
            console.error('Error generating file:', error);
            throw error;
        }
    }

    generateEnhancedHeader(selectedFilesList, filteringSummary) {
        let output = 'SMART FILE COLLECTION\n';
        output += '='.repeat(80) + '\n\n';
        output += `Generated: ${new Date().toISOString()}\n`;
        output += `Total files processed: ${filteringSummary.totalOriginal}\n`;
        output += `Files included: ${filteringSummary.totalIncluded}\n`;
        output += `Files filtered out: ${filteringSummary.totalExcluded}\n`;
        output += `Root directory: ${this.fileExplorer.currentPath}\n`;

        // Show file prioritization breakdown
        output += '\nFILE PRIORITIZATION:\n';
        output += '-'.repeat(40) + '\n';
        
        const categoryOrder = ['core', 'business', 'config', 'docs', 'tests', 'assets', 'other'];
        for (const category of categoryOrder) {
            const files = filteringSummary.categories[category];
            if (files && files.length > 0) {
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                output += `${categoryName} files (${files.length}): Priority ${files[0].priority.score}\n`;
            }
        }

        const enabledProjectTypes = this.getEnabledProjectTypes();
        if (enabledProjectTypes.length > 0) {
            output += `Project types detected: ${enabledProjectTypes.join(', ')}\n`;
        }

        if (this.fileExplorer.dockerFiles.length > 0) {
            output += `Docker files included: ${this.fileExplorer.dockerFiles.length}\n`;
        }
        
        output += `Output saved to: output_files_selected/ directory\n\n`;
        
        output += 'COMPRESSION APPLIED:\n';
        output += '-'.repeat(40) + '\n';
        output += '- Removed auto-generated headers and boilerplate\n';
        output += '- Compressed package.json to essential fields\n';
        output += '- Filtered out build artifacts and lock files\n';
        output += '- Prioritized core business logic files\n\n';

        return output;
    }

    async processFile(filePath, priority, fileInfoList) {
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
            fileInfoList.push({
                path: displayPath,
                priority: priority
            });

            let output = '='.repeat(80) + '\n';
            output += `filename: ${fileName}\n`;
            output += `directory: ${directory}\n`;
            output += `relative_path: ${relativePath}\n`;
            output += `full_path: ${filePath}\n`;
            output += `priority: ${priority.score} (${priority.category})\n`;
            output += `priority_reason: ${priority.reason}\n`;

            const classifications = this.getFileClassifications(filePath);
            if (classifications.length > 0) {
                output += `classification: ${classifications.join(', ')}\n`;
            }

            if (content && content.isBinary) {
                output += `type: binary\n`;
                output += `size: ${this.fileExplorer.formatFileSize(new Blob(['']).size)}\n`;
            } else if (content) {
                // Apply content compression
                const originalContent = content.content;
                const compressedContent = this.contentFilter.compressBoilerplate(originalContent, filePath);
                
                const originalLines = originalContent.split('\n').length;
                const compressedLines = compressedContent.split('\n').length;
                const compressionRatio = originalLines > 0 ? ((originalLines - compressedLines) / originalLines * 100).toFixed(1) : 0;
                
                output += `type: text\n`;
                output += `original_lines: ${originalLines}\n`;
                output += `compressed_lines: ${compressedLines}\n`;
                output += `compression_ratio: ${compressionRatio}%\n`;
                output += `size: ${this.fileExplorer.formatFileSize(new Blob([compressedContent]).size)}\n`;
            }

            output += '='.repeat(80) + '\n\n';

            if (content && !content.isBinary) {
                const compressedContent = this.contentFilter.compressBoilerplate(content.content, filePath);
                output += compressedContent;
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
                fileInfoList.push({
                    path: displayPath,
                    priority: { score: 0, category: 'error', reason: 'Processing error' }
                });
            }

            let output = '='.repeat(80) + '\n';
            output += `filename: ${fileName}\n`;
            output += `directory: ${directory}\n`;
            output += `full_path: ${filePath}\n`;
            output += `priority: 0 (error)\n`;
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

    generateEnhancedFooter(fileInfoList, filterResult) {
        let output = '\n' + '='.repeat(80) + '\n\n';
        output += 'SMART COLLECTION COMPLETE\n\n';

        if (fileInfoList.length > 0) {
            // Group files by priority category
            const filesByCategory = {};
            for (const file of fileInfoList) {
                const category = file.priority.category;
                if (!filesByCategory[category]) {
                    filesByCategory[category] = [];
                }
                filesByCategory[category].push(file.path);
            }

            output += 'FILES INCLUDED BY PRIORITY:\n';
            output += '-'.repeat(40) + '\n';
            
            const categoryOrder = ['core', 'business', 'config', 'docs', 'tests', 'assets', 'other', 'error'];
            for (const category of categoryOrder) {
                if (filesByCategory[category]) {
                    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                    output += `${categoryName}: ${filesByCategory[category].join(', ')}\n`;
                }
            }
            output += '\n';
        }

        if (filterResult.excluded.length > 0) {
            output += 'FILES AUTOMATICALLY EXCLUDED:\n';
            output += '-'.repeat(40) + '\n';
            const excludedPaths = filterResult.excluded.map(f => f.path.replace(this.fileExplorer.currentPath, '').replace(/^\//, ''));
            output += `${excludedPaths.length} files filtered out: ${excludedPaths.slice(0, 5).join(', ')}`;
            if (excludedPaths.length > 5) {
                output += ` and ${excludedPaths.length - 5} more...`;
            }
            output += '\n\n';
        }

        output += 'DONE PASTING\n\n';
        output += 'This collection has been optimized for AI analysis with:\n';
        output += '- Smart boilerplate removal and compression\n';
        output += '- Intelligent file prioritization\n';
        output += '- Automatic exclusion of generated/build files\n';
        output += '- Enhanced metadata for better context understanding\n\n';

        if (this.fileExplorer.settingsManager.settings.customPrompt?.trim()) {
            output += 'CUSTOM INSTRUCTIONS:\n';
            output += '-'.repeat(40) + '\n';
            output += this.fileExplorer.settingsManager.settings.customPrompt.trim() + '\n\n';
        }

        output += 'Please analyze this optimized codebase and provide insights as needed.\n';

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