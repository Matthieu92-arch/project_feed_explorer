// js/services/ContentGenerator.js (Updated with emergency fallback)
export class ContentGenerator {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
    }

    async generateFile() {
        try {
            // Get all selected files
            const allSelectedFiles = Array.from(this.fileExplorer.selectedFiles);
            console.log(`🎯 All selected files (${allSelectedFiles.length}):`, allSelectedFiles.map(f => f.split('/').pop()));
            
            // Filter to only get actual files, not directories - BUT be more careful about checking
            const selectedFilesList = allSelectedFiles.filter(path => {
                // First check: is it a valid path?
                if (!path || typeof path !== 'string') {
                    console.log(`🚫 ${path} - invalid path`);
                    return false;
                }
                
                // Second check: does it look like a file (has extension or known filename)?
                const fileName = path.split('/').pop();
                const hasExtension = fileName && fileName.includes('.');
                const isKnownFile = ['Dockerfile', 'Makefile', 'README', 'LICENSE'].includes(fileName);
                
                if (!hasExtension && !isKnownFile) {
                    console.log(`🚫 ${fileName} - likely directory (no extension)`);
                    return false;
                }
                
                // Third check: DOM check as backup
                const item = document.querySelector(`[data-path="${path}"]`);
                if (item) {
                    const isFile = item.dataset.type === 'file';
                    console.log(`${isFile ? '✅' : '🚫'} ${fileName} - ${item.dataset.type}`);
                    return isFile;
                } else {
                    // If DOM element not found, assume it's a file if it has an extension
                    console.log(`✅ ${fileName} - assuming file (not in DOM but has extension)`);
                    return hasExtension || isKnownFile;
                }
            });

            console.log(`📁 Actual files to process (${selectedFilesList.length}):`, selectedFilesList.map(f => f.split('/').pop()));

            // Emergency check: if we have no files, that's a problem
            if (selectedFilesList.length === 0) {
                console.error('❌ No files to process! Using all selected files as fallback.');
                selectedFilesList.push(...allSelectedFiles);
            }

            // Apply smart filtering and prioritization
            const filterResult = this.fileExplorer.contentFilter.filterAndPrioritizeFiles(selectedFilesList);
            console.log(`📊 After filtering: ${filterResult.included.length} included, ${filterResult.excluded.length} excluded`);
            
            // Emergency fallback: if filtering removed everything, bypass filtering
            if (filterResult.included.length === 0 && selectedFilesList.length > 0) {
                console.error('❌ No files survived filtering! Using emergency fallback: processing all files without filtering');
                const fallbackResult = {
                    included: selectedFilesList.map(path => ({
                        path: path,
                        priority: { score: 50, category: 'fallback', reason: 'Emergency processing - filtering bypassed' }
                    })),
                    excluded: []
                };
                filterResult.included = fallbackResult.included;
                filterResult.excluded = fallbackResult.excluded;
            }

            const filteredFiles = filterResult.included.map(f => f.path);
            const filteringSummary = this.fileExplorer.contentFilter.generateFilteringSummary(filterResult);

            // Perform comprehensive project analysis
            console.log('🔍 Analyzing project structure and dependencies...');
            const projectAnalysis = await this.fileExplorer.projectAnalyzer.analyzeProject();

            let output = '';

            // Generate enhanced header with project analysis
            output += this.generateEnhancedHeader(filteredFiles, filteringSummary, projectAnalysis);

            // Generate file contents in priority order
            const fileInfoList = [];
            for (const fileData of filterResult.included) {
                console.log(`📝 Processing file: ${fileData.path.split('/').pop()}`);
                const fileOutput = await this.processFile(fileData.path, fileData.priority, fileInfoList);
                output += fileOutput;
            }

            // Generate footer with analysis summary
            output += this.generateEnhancedFooter(fileInfoList, filterResult, projectAnalysis);

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
                    filteringSummary,
                    projectAnalysis 
                };
            } else {
                return result;
            }

        } catch (error) {
            console.error('Error generating file:', error);
            throw error;
        }
    }

    generateEnhancedHeader(selectedFilesList, filteringSummary, projectAnalysis) {
        let output = 'COMPREHENSIVE PROJECT ANALYSIS\n';
        output += '='.repeat(80) + '\n\n';
        output += `Generated: ${new Date().toISOString()}\n`;
        output += `Total files processed: ${filteringSummary.totalOriginal}\n`;
        output += `Files included: ${filteringSummary.totalIncluded}\n`;
        output += `Files filtered out: ${filteringSummary.totalExcluded}\n`;
        output += `Root directory: ${this.fileExplorer.currentPath}\n\n`;

        // Project Analysis Section
        if (projectAnalysis) {
            const summary = this.fileExplorer.projectAnalyzer.generateAnalysisSummary();
            
            output += 'PROJECT TYPE ANALYSIS:\n';
            output += '-'.repeat(40) + '\n';
            
            if (summary.projectTypes.length > 0) {
                for (const project of summary.projectTypes) {
                    output += `${project.name.toUpperCase()}: ${project.confidence}% confidence`;
                    if (project.subType) {
                        output += ` (${project.subType})`;
                    }
                    output += '\n';
                    if (project.mainIndicators.length > 0) {
                        output += `  └─ Key indicators: ${project.mainIndicators.join(', ')}\n`;
                    }
                }
            } else {
                output += 'No specific project types detected\n';
            }
            output += '\n';

            // Dependencies Analysis
            if (summary.dependencies.length > 0) {
                output += 'DEPENDENCY ANALYSIS:\n';
                output += '-'.repeat(40) + '\n';
                for (const dep of summary.dependencies) {
                    output += `${dep.type.toUpperCase()} (${dep.file}): ${dep.count} dependencies\n`;
                    if (dep.mainDependencies.length > 0) {
                        output += `  └─ Key packages: ${dep.mainDependencies.join(', ')}\n`;
                    }
                }
                output += '\n';
            }

            // Project Structure
            if (summary.structure) {
                output += 'PROJECT STRUCTURE:\n';
                output += '-'.repeat(40) + '\n';
                output += `Total files: ${summary.structure.totalFiles}\n`;
                output += `Directory depth: ${summary.structure.maxDepth} levels\n`;
                output += `Architecture patterns: ${summary.structure.patterns.join(', ') || 'Standard structure'}\n`;
                
                if (summary.structure.mainDirectories.length > 0) {
                    output += 'Main directories:\n';
                    for (const dir of summary.structure.mainDirectories) {
                        output += `  └─ ${dir.path}/ (${dir.type}, ${dir.fileCount} files)\n`;
                    }
                }
                output += '\n';
            }

            // Recommendations
            if (summary.recommendations.length > 0) {
                output += 'PROJECT RECOMMENDATIONS:\n';
                output += '-'.repeat(40) + '\n';
                const priorityOrder = ['high', 'medium', 'low'];
                for (const priority of priorityOrder) {
                    const recs = summary.recommendations.filter(r => r.priority === priority);
                    if (recs.length > 0) {
                        output += `${priority.toUpperCase()} PRIORITY:\n`;
                        for (const rec of recs) {
                            output += `  • ${rec.message}\n`;
                        }
                    }
                }
                output += '\n';
            }
        }

        // File Prioritization
        output += 'FILE PRIORITIZATION:\n';
        output += '-'.repeat(40) + '\n';
        
        const categoryOrder = ['core', 'business', 'config', 'source', 'styles', 'tests', 'docs', 'assets', 'other'];
        for (const category of categoryOrder) {
            const files = filteringSummary.categories[category];
            if (files && files.length > 0) {
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                output += `${categoryName} files (${files.length}): Priority ${files[0].priority.score}\n`;
            }
        }

        const enabledProjectTypes = this.getEnabledProjectTypes();
        if (enabledProjectTypes.length > 0) {
            output += `\nLegacy project types detected: ${enabledProjectTypes.join(', ')}\n`;
        }

        if (this.fileExplorer.dockerFiles.length > 0) {
            output += `Docker files included: ${this.fileExplorer.dockerFiles.length}\n`;
        }
        
        output += `\nOutput saved to: output_files_selected/ directory\n\n`;
        
        output += 'SMART OPTIMIZATIONS APPLIED:\n';
        output += '-'.repeat(40) + '\n';
        output += '• Comprehensive project type detection (20+ frameworks)\n';
        output += '• Dependency analysis and framework identification\n';
        output += '• Intelligent project structure mapping\n';
        output += '• Automated code quality recommendations\n';
        output += '• Boilerplate removal and content compression\n';
        output += '• Priority-based file organization\n';
        output += '• Exclusion of build artifacts and generated files\n\n';

        return output;
    }

    async processFile(filePath, priority, fileInfoList) {
        try {
            if (typeof filePath !== 'string') {
                console.error('Invalid filePath type:', typeof filePath, filePath);
                return '';
            }

            // Additional safety check: verify this is actually a file
            const fileName = filePath.split('/').pop();
            if (!fileName) {
                console.log(`⚠️ Skipping invalid file path: ${filePath}`);
                return '';
            }

            const content = await this.fileExplorer.fileManager.getFileContent(filePath);
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

            // Add project analysis context for this file
            const fileAnalysis = this.analyzeIndividualFile(filePath, fileName, relativePath);
            if (fileAnalysis.projectRole) {
                output += `project_role: ${fileAnalysis.projectRole}\n`;
            }
            if (fileAnalysis.framework) {
                output += `framework_context: ${fileAnalysis.framework}\n`;
            }

            if (content && content.isBinary) {
                output += `type: binary\n`;
                output += `size: ${this.fileExplorer.formatFileSize(new Blob(['']).size)}\n`;
            } else if (content) {
                // Apply content compression
                const originalContent = content.content;
                const compressedContent = this.fileExplorer.contentFilter.compressBoilerplate(originalContent, filePath);
                
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
                const compressedContent = this.fileExplorer.contentFilter.compressBoilerplate(content.content, filePath);
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
            
            // More robust error handling
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

    analyzeIndividualFile(filePath, fileName, relativePath) {
        const analysis = {
            projectRole: null,
            framework: null
        };

        // Determine file role in project
        if (fileName === 'package.json') {
            analysis.projectRole = 'Project configuration and dependency management';
        } else if (fileName === 'README.md') {
            analysis.projectRole = 'Project documentation and setup guide';
        } else if (fileName.includes('config') || fileName.includes('setting')) {
            analysis.projectRole = 'Configuration file';
        } else if (relativePath.includes('test') || fileName.includes('test') || fileName.includes('spec')) {
            analysis.projectRole = 'Test file for quality assurance';
        } else if (relativePath.includes('component') || relativePath.includes('page')) {
            analysis.projectRole = 'UI component or page implementation';
        } else if (relativePath.includes('service') || relativePath.includes('api')) {
            analysis.projectRole = 'Business logic or API service';
        } else if (relativePath.includes('model') || relativePath.includes('schema')) {
            analysis.projectRole = 'Data model or schema definition';
        } else if (fileName.includes('index') || fileName.includes('main') || fileName.includes('app')) {
            analysis.projectRole = 'Entry point or main application file';
        }

        // Determine framework context
        const projectTypes = this.fileExplorer.projectAnalyzer.projectTypes;
        if (projectTypes.has('react') && (fileName.endsWith('.jsx') || fileName.endsWith('.tsx'))) {
            analysis.framework = 'React component';
        } else if (projectTypes.has('vue') && fileName.endsWith('.vue')) {
            analysis.framework = 'Vue.js component';
        } else if (projectTypes.has('nodejs') && fileName.endsWith('.js')) {
            analysis.framework = 'Node.js module';
        } else if (projectTypes.has('python') && fileName.endsWith('.py')) {
            if (projectTypes.get('python').subType?.name === 'django') {
                analysis.framework = 'Django Python module';
            } else if (projectTypes.get('python').subType?.name === 'flask') {
                analysis.framework = 'Flask Python module';
            } else {
                analysis.framework = 'Python module';
            }
        }

        return analysis;
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
        
        // Add new project type classifications
        if (this.fileExplorer.projectAnalyzer.projectTypes) {
            for (const [projectType, data] of this.fileExplorer.projectAnalyzer.projectTypes.entries()) {
                if (data.subType && data.subType.name) {
                    classifications.push(`${projectType}-${data.subType.name}`);
                } else {
                    classifications.push(projectType);
                }
            }
        }
        
        return classifications;
    }

    generateEnhancedFooter(fileInfoList, filterResult, projectAnalysis) {
        let output = '\n' + '='.repeat(80) + '\n\n';
        output += 'COMPREHENSIVE ANALYSIS COMPLETE\n\n';

        if (projectAnalysis) {
            const summary = this.fileExplorer.projectAnalyzer.generateAnalysisSummary();
            
            output += 'PROJECT SUMMARY:\n';
            output += '-'.repeat(40) + '\n';
            if (summary.projectTypes.length > 0) {
                const mainProject = summary.projectTypes[0];
                output += `Primary Technology: ${mainProject.name}`;
                if (mainProject.subType) {
                    output += ` (${mainProject.subType})`;
                }
                output += ` - ${mainProject.confidence}% confidence\n`;
                
                if (summary.projectTypes.length > 1) {
                    output += `Additional Technologies: ${summary.projectTypes.slice(1).map(p => p.name).join(', ')}\n`;
                }
            }
            
            if (summary.dependencies.length > 0) {
                const totalDeps = summary.dependencies.reduce((sum, dep) => sum + dep.count, 0);
                output += `Total Dependencies: ${totalDeps} across ${summary.dependencies.length} package managers\n`;
            }
            
            if (summary.structure) {
                output += `Project Complexity: ${summary.structure.maxDepth} directory levels, ${summary.structure.totalFiles} files\n`;
                if (summary.structure.patterns.length > 0) {
                    output += `Architecture: ${summary.structure.patterns.join(', ')}\n`;
                }
            }
            output += '\n';
        }

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
            
            const categoryOrder = ['core', 'business', 'config', 'source', 'styles', 'tests', 'docs', 'assets', 'other', 'fallback', 'error'];
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
        output += 'This collection has been enhanced with comprehensive project analysis:\n';
        output += '• Automatic detection of 20+ project types and frameworks\n';
        output += '• Deep dependency analysis and version tracking\n';
        output += '• Intelligent project structure mapping\n';
        output += '• Context-aware file classification and prioritization\n';
        output += '• Smart boilerplate removal and content optimization\n';
        output += '• Automated code quality and architecture recommendations\n\n';

        if (this.fileExplorer.settingsManager.settings.customPrompt?.trim()) {
            output += 'CUSTOM INSTRUCTIONS:\n';
            output += '-'.repeat(40) + '\n';
            output += this.fileExplorer.settingsManager.settings.customPrompt.trim() + '\n\n';
        }

        output += 'Please analyze this comprehensive, AI-optimized codebase with full project context.\n';

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