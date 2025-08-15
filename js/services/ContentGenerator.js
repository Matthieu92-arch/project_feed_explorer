// js/services/ContentGenerator.js (Enhanced with AI-Optimized Output Format)
export class ContentGenerator {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.fileRelationships = new Map();
        this.entryPoints = [];
        this.architecturalDecisions = [];
    }

    async generateFile() {
        try {
            // Get all selected files
            const allSelectedFiles = Array.from(this.fileExplorer.selectedFiles);
            console.log(`🎯 All selected files (${allSelectedFiles.length}):`, allSelectedFiles.map(f => f.split('/').pop()));
            
            // Filter to only get actual files, not directories
            const selectedFilesList = allSelectedFiles.filter(path => {
                if (!path || typeof path !== 'string') {
                    console.log(`🚫 ${path} - invalid path`);
                    return false;
                }
                
                const fileName = path.split('/').pop();
                const hasExtension = fileName && fileName.includes('.');
                const isKnownFile = ['Dockerfile', 'Makefile', 'README', 'LICENSE'].includes(fileName);
                
                if (!hasExtension && !isKnownFile) {
                    console.log(`🚫 ${fileName} - likely directory (no extension)`);
                    return false;
                }
                
                const item = document.querySelector(`[data-path="${path}"]`);
                if (item) {
                    const isFile = item.dataset.type === 'file';
                    console.log(`${isFile ? '✅' : '🚫'} ${fileName} - ${item.dataset.type}`);
                    return isFile;
                } else {
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
                console.error('❌ No files survived filtering! Using emergency fallback');
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

            // NEW: Analyze file relationships and entry points
            console.log('🔗 Analyzing file relationships and entry points...');
            await this.analyzeFileRelationships(filteredFiles);
            this.identifyEntryPoints(filteredFiles, projectAnalysis);
            this.analyzeArchitecturalDecisions(filteredFiles, projectAnalysis);

            let output = '';

            // Generate enhanced header with AI-optimized metadata
            output += this.generateAIOptimizedHeader(filteredFiles, filteringSummary, projectAnalysis);

            // Generate file contents in priority order
            const fileInfoList = [];
            for (const fileData of filterResult.included) {
                console.log(`📝 Processing file: ${fileData.path.split('/').pop()}`);
                const fileOutput = await this.processFile(fileData.path, fileData.priority, fileInfoList);
                output += fileOutput;
            }

            // Generate footer with analysis summary
            output += this.generateAIOptimizedFooter(fileInfoList, filterResult, projectAnalysis);

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

    async analyzeFileRelationships(filePaths) {
        console.log('🔗 Analyzing file relationships...');
        this.fileRelationships.clear();

        for (const filePath of filePaths) {
            try {
                const content = await this.fileExplorer.fileManager.getFileContent(filePath);
                if (!content || content.isBinary) continue;

                const relationships = {
                    imports: [],
                    exports: [],
                    dependencies: [],
                    relatedFiles: []
                };

                // Analyze imports and dependencies
                relationships.imports = this.extractImports(content.content, filePath);
                relationships.exports = this.extractExports(content.content, filePath);
                relationships.dependencies = this.extractDependencies(content.content, filePath);
                relationships.relatedFiles = this.findRelatedFiles(filePath, filePaths);

                this.fileRelationships.set(filePath, relationships);
            } catch (error) {
                console.error(`Error analyzing relationships for ${filePath}:`, error);
            }
        }
    }

    // Fixed extractImports method for ContentGenerator.js
// Replace the existing extractImports method with this improved version

    extractImports(content, filePath) {
        const imports = [];
        const extension = filePath.split('.').pop().toLowerCase();

        // JavaScript/TypeScript imports
        if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            // Enhanced regex patterns to handle multi-line imports and better whitespace handling
            const importRegexes = [
                // Multi-line destructured imports: import { ... } from '...'
                /import\s*{\s*([^}]*)\s*}\s*from\s+['"]([^'"]+)['"];?/gs,
                // Default imports: import Something from '...'
                /import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g,
                // Namespace imports: import * as Something from '...'
                /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g,
                // Side-effect imports: import '...'
                /import\s+['"]([^'"]+)['"];?/g,
                // Dynamic imports: import('...')
                /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
                // CommonJS destructured require: const { ... } = require('...')
                /const\s*{\s*([^}]*)\s*}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\);?/gs,
                // CommonJS default require: const Something = require('...')
                /const\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\);?/g
            ];

            importRegexes.forEach((regex, regexIndex) => {
                let match;
                while ((match = regex.exec(content)) !== null) {
                    let importedNames = [];
                    let modulePath = '';

                    if (regexIndex === 0) {
                        // Multi-line destructured imports: import { ... } from '...'
                        const destructuredItems = match[1];
                        modulePath = match[2];
                        
                        // Clean up the destructured items and split them properly
                        importedNames = destructuredItems
                            .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
                            .split(',')
                            .map(item => item.trim())
                            .filter(item => item.length > 0)
                            .map(item => {
                                // Handle aliased imports like "ChartCard as Chart"
                                if (item.includes(' as ')) {
                                    return item.split(' as ')[0].trim();
                                }
                                return item;
                            });
                            
                    } else if (regexIndex === 1) {
                        // Default imports
                        importedNames = [match[1]];
                        modulePath = match[2];
                    } else if (regexIndex === 2) {
                        // Namespace imports
                        importedNames = [match[1]];
                        modulePath = match[2];
                    } else if (regexIndex === 3 || regexIndex === 4) {
                        // Side-effect imports or dynamic imports
                        modulePath = match[1];
                        importedNames = [];
                    } else if (regexIndex === 5) {
                        // CommonJS destructured require
                        const destructuredItems = match[1];
                        modulePath = match[2];
                        
                        importedNames = destructuredItems
                            .replace(/\s+/g, ' ')
                            .split(',')
                            .map(item => item.trim())
                            .filter(item => item.length > 0)
                            .map(item => {
                                if (item.includes(' as ')) {
                                    return item.split(' as ')[0].trim();
                                }
                                return item;
                            });
                            
                    } else if (regexIndex === 6) {
                        // CommonJS default require
                        importedNames = [match[1]];
                        modulePath = match[2];
                    }

                    // Only add if we have a valid module path
                    if (modulePath) {
                        imports.push({
                            type: regex.source.includes('import') ? 'import' : 'require',
                            module: modulePath,
                            items: importedNames,
                            line: this.getLineNumber(content, match.index),
                            originalStatement: match[0].replace(/\s+/g, ' ').trim()
                        });
                    }
                }
                // Reset regex lastIndex to ensure we catch all matches
                regex.lastIndex = 0;
            });
        }

        // Python imports (existing logic)
        if (extension === 'py') {
            const pythonImportRegexes = [
                /from\s+([^\s]+)\s+import\s+([^\n]+)/g,
                /import\s+([^\s\n]+)/g
            ];

            pythonImportRegexes.forEach(regex => {
                let match;
                while ((match = regex.exec(content)) !== null) {
                    imports.push({
                        type: regex.source.includes('from') ? 'from_import' : 'import',
                        module: match[1],
                        items: match[2] ? match[2].split(',').map(s => s.trim()) : [],
                        line: this.getLineNumber(content, match.index)
                    });
                }
                regex.lastIndex = 0;
            });
        }

        // Log debug info for multi-line imports
        const multiLineImports = imports.filter(imp => imp.items && imp.items.length > 3);
        if (multiLineImports.length > 0) {
            console.log(`🔍 Found ${multiLineImports.length} multi-line imports in ${filePath.split('/').pop()}:`);
            multiLineImports.forEach(imp => {
                console.log(`  └─ ${imp.module}: [${imp.items.join(', ')}]`);
            });
        }

        return imports;
        }

    extractExports(content, filePath) {
        const exports = [];
        const extension = filePath.split('.').pop().toLowerCase();

        // JavaScript/TypeScript exports
        if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            const exportRegexes = [
                /export\s+default\s+(\w+)/g,
                /export\s+{([^}]+)}/g,
                /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
                /module\.exports\s*=\s*(\w+)/g
            ];

            exportRegexes.forEach(regex => {
                let match;
                while ((match = regex.exec(content)) !== null) {
                    exports.push({
                        type: regex.source.includes('default') ? 'default' : 'named',
                        name: match[1],
                        line: this.getLineNumber(content, match.index)
                    });
                }
            });
        }

        return exports;
    }

    extractDependencies(content, filePath) {
        const dependencies = [];
        
        // Extract package.json dependencies
        if (filePath.endsWith('package.json')) {
            try {
                const pkg = JSON.parse(content);
                if (pkg.dependencies) {
                    Object.keys(pkg.dependencies).forEach(dep => {
                        dependencies.push({
                            name: dep,
                            version: pkg.dependencies[dep],
                            type: 'production'
                        });
                    });
                }
                if (pkg.devDependencies) {
                    Object.keys(pkg.devDependencies).forEach(dep => {
                        dependencies.push({
                            name: dep,
                            version: pkg.devDependencies[dep],
                            type: 'development'
                        });
                    });
                }
            } catch (error) {
                console.error('Error parsing package.json:', error);
            }
        }

        // Extract requirements.txt dependencies
        if (filePath.endsWith('requirements.txt')) {
            const lines = content.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const match = trimmed.match(/^([a-zA-Z0-9\-_.]+)([>=<~!]+.*)?$/);
                    if (match) {
                        dependencies.push({
                            name: match[1],
                            version: match[2] || '',
                            type: 'production'
                        });
                    }
                }
            });
        }

        return dependencies;
    }

    findRelatedFiles(filePath, allFilePaths) {
        const related = [];
        const fileName = filePath.split('/').pop();
        const baseName = fileName.split('.')[0];
        const directory = filePath.substring(0, filePath.lastIndexOf('/'));

        // Find files in the same directory
        const sameDirectoryFiles = allFilePaths.filter(path => 
            path !== filePath && 
            path.startsWith(directory) &&
            !path.substring(directory.length + 1).includes('/')
        );

        // Find files with similar names
        const similarNameFiles = allFilePaths.filter(path => {
            const otherFileName = path.split('/').pop();
            const otherBaseName = otherFileName.split('.')[0];
            return path !== filePath && (
                otherBaseName === baseName ||
                otherBaseName.includes(baseName) ||
                baseName.includes(otherBaseName)
            );
        });

        related.push(...sameDirectoryFiles, ...similarNameFiles);
        return [...new Set(related)]; // Remove duplicates
    }

    identifyEntryPoints(filePaths, projectAnalysis) {
        console.log('🎯 Identifying entry points...');
        this.entryPoints = [];

        const entryPointPatterns = [
            // JavaScript/Node.js entry points
            { pattern: /^(index|main|app|server)\.(js|jsx|ts|tsx)$/, priority: 100, type: 'main_entry' },
            { pattern: /package\.json$/, priority: 95, type: 'config_entry' },
            
            // Python entry points
            { pattern: /^(main|app|run|server)\.(py)$/, priority: 100, type: 'main_entry' },
            { pattern: /^manage\.py$/, priority: 95, type: 'django_entry' },
            { pattern: /^setup\.py$/, priority: 85, type: 'setup_entry' },
            
            // Web entry points
            { pattern: /^index\.html$/, priority: 90, type: 'web_entry' },
            
            // Configuration entry points
            { pattern: /^(docker-compose\.yml|Dockerfile)$/, priority: 80, type: 'deployment_entry' },
            { pattern: /^(webpack|vite|rollup)\.config\.(js|ts)$/, priority: 75, type: 'build_entry' },
            
            // Framework-specific entry points
            { pattern: /^gatsby-config\.js$/, priority: 85, type: 'gatsby_entry' },
            { pattern: /^next\.config\.js$/, priority: 85, type: 'nextjs_entry' },
            { pattern: /^nuxt\.config\.js$/, priority: 85, type: 'nuxt_entry' },
            
            // Documentation entry points
            { pattern: /^README\.(md|txt)$/i, priority: 70, type: 'docs_entry' }
        ];

        for (const filePath of filePaths) {
            const fileName = filePath.split('/').pop();
            
            for (const entryPattern of entryPointPatterns) {
                if (entryPattern.pattern.test(fileName)) {
                    this.entryPoints.push({
                        path: filePath,
                        fileName: fileName,
                        type: entryPattern.type,
                        priority: entryPattern.priority,
                        description: this.getEntryPointDescription(entryPattern.type, fileName)
                    });
                    break; // Only match the first pattern
                }
            }
        }

        // Sort by priority
        this.entryPoints.sort((a, b) => b.priority - a.priority);

        // Add project-specific entry points based on analysis
        if (projectAnalysis && projectAnalysis.projectTypes) {
            for (const [projectType, data] of projectAnalysis.projectTypes.entries()) {
                this.addProjectSpecificEntryPoints(projectType, data, filePaths);
            }
        }
    }

    getEntryPointDescription(type, fileName) {
        const descriptions = {
            'main_entry': `Main application entry point - start here to understand the application flow`,
            'config_entry': `Configuration file - contains project metadata and dependencies`,
            'django_entry': `Django management script - used for running Django commands`,
            'setup_entry': `Python package setup script - defines how the package is installed`,
            'web_entry': `Main HTML entry point - the root of the web application`,
            'deployment_entry': `Deployment configuration - defines how the application is containerized/deployed`,
            'build_entry': `Build tool configuration - defines how the project is compiled/bundled`,
            'gatsby_entry': `Gatsby configuration - defines static site generation settings`,
            'nextjs_entry': `Next.js configuration - defines React framework settings`,
            'nuxt_entry': `Nuxt.js configuration - defines Vue.js framework settings`,
            'docs_entry': `Project documentation - provides overview and setup instructions`
        };
        return descriptions[type] || `Entry point: ${fileName}`;
    }

    addProjectSpecificEntryPoints(projectType, data, filePaths) {
        // Add framework-specific entry points that might not match standard patterns
        if (projectType === 'react' && data.subType?.name === 'next.js') {
            const pagesIndex = filePaths.find(path => path.includes('pages/index.'));
            if (pagesIndex) {
                this.entryPoints.push({
                    path: pagesIndex,
                    fileName: pagesIndex.split('/').pop(),
                    type: 'nextjs_page_entry',
                    priority: 88,
                    description: 'Next.js homepage component - main user-facing entry point'
                });
            }
        }

        if (projectType === 'django') {
            const settingsPy = filePaths.find(path => path.endsWith('settings.py'));
            if (settingsPy && !this.entryPoints.find(e => e.path === settingsPy)) {
                this.entryPoints.push({
                    path: settingsPy,
                    fileName: 'settings.py',
                    type: 'django_settings_entry',
                    priority: 90,
                    description: 'Django settings - core configuration for the Django application'
                });
            }
        }
    }

    analyzeArchitecturalDecisions(filePaths, projectAnalysis) {
        console.log('🏗️ Analyzing architectural decisions...');
        this.architecturalDecisions = [];

        // Analyze directory structure
        const directories = new Set();
        filePaths.forEach(path => {
            const parts = path.split('/');
            for (let i = 1; i < parts.length; i++) {
                directories.add(parts.slice(0, i).join('/'));
            }
        });

        // Identify architectural patterns
        const dirArray = Array.from(directories);
        
        if (dirArray.some(dir => dir.includes('/components'))) {
            this.architecturalDecisions.push({
                pattern: 'Component-Based Architecture',
                confidence: 90,
                description: 'Uses component-based architecture for modular UI development',
                evidence: 'Components directory structure detected'
            });
        }

        if (dirArray.some(dir => dir.includes('/services')) || dirArray.some(dir => dir.includes('/api'))) {
            this.architecturalDecisions.push({
                pattern: 'Service Layer Architecture',
                confidence: 85,
                description: 'Implements service layer pattern for business logic separation',
                evidence: 'Services/API directory structure detected'
            });
        }

        if (dirArray.some(dir => dir.includes('/models')) && 
            dirArray.some(dir => dir.includes('/views')) && 
            dirArray.some(dir => dir.includes('/controllers'))) {
            this.architecturalDecisions.push({
                pattern: 'Model-View-Controller (MVC)',
                confidence: 95,
                description: 'Follows MVC architectural pattern for separation of concerns',
                evidence: 'Models, Views, and Controllers directories detected'
            });
        }

        // Analyze technology choices
        if (projectAnalysis && projectAnalysis.dependencies) {
            for (const [depType, depData] of projectAnalysis.dependencies.entries()) {
                this.analyzeFrameworkChoices(depType, depData.dependencies);
            }
        }

        // Analyze file patterns
        this.analyzeFilePatterns(filePaths);
    }

    analyzeFrameworkChoices(depType, dependencies) {
        if (depType === 'npm') {
            const frameworks = {
                'react': { name: 'React', category: 'UI Framework' },
                'vue': { name: 'Vue.js', category: 'UI Framework' },
                'angular': { name: 'Angular', category: 'UI Framework' },
                'express': { name: 'Express.js', category: 'Backend Framework' },
                'next': { name: 'Next.js', category: 'Full-Stack Framework' },
                'gatsby': { name: 'Gatsby', category: 'Static Site Generator' },
                'typescript': { name: 'TypeScript', category: 'Type System' },
                'tailwindcss': { name: 'Tailwind CSS', category: 'CSS Framework' },
                'styled-components': { name: 'Styled Components', category: 'CSS-in-JS' },
                'jest': { name: 'Jest', category: 'Testing Framework' },
                'eslint': { name: 'ESLint', category: 'Code Quality' }
            };

            dependencies.forEach(dep => {
                const framework = frameworks[dep.name];
                if (framework) {
                    this.architecturalDecisions.push({
                        pattern: `${framework.category} Choice`,
                        confidence: 100,
                        description: `Uses ${framework.name} for ${framework.category.toLowerCase()}`,
                        evidence: `${dep.name}@${dep.version} in package.json`,
                        technology: dep.name
                    });
                }
            });
        }
    }

    analyzeFilePatterns(filePaths) {
        const extensions = {};
        filePaths.forEach(path => {
            const ext = path.split('.').pop().toLowerCase();
            extensions[ext] = (extensions[ext] || 0) + 1;
        });

        // Analyze TypeScript usage
        if (extensions.ts || extensions.tsx) {
            const tsFiles = (extensions.ts || 0) + (extensions.tsx || 0);
            const jsFiles = (extensions.js || 0) + (extensions.jsx || 0);
            const confidence = Math.round((tsFiles / (tsFiles + jsFiles)) * 100);
            
            this.architecturalDecisions.push({
                pattern: 'TypeScript Adoption',
                confidence: confidence,
                description: `Uses TypeScript for type safety (${confidence}% of JS/TS files)`,
                evidence: `${tsFiles} TypeScript files vs ${jsFiles} JavaScript files`
            });
        }

        // Analyze test coverage
        const testFiles = filePaths.filter(path => 
            path.includes('.test.') || 
            path.includes('.spec.') || 
            path.includes('/test/') || 
            path.includes('/tests/')
        ).length;
        
        if (testFiles > 0) {
            const testCoverage = Math.round((testFiles / filePaths.length) * 100);
            this.architecturalDecisions.push({
                pattern: 'Test-Driven Development',
                confidence: testCoverage,
                description: `Implements testing practices (${testFiles} test files)`,
                evidence: `${testCoverage}% of files are test-related`
            });
        }
    }

    generateAIOptimizedHeader(filteredFiles, filteringSummary, projectAnalysis) {
        let output = 'AI-OPTIMIZED PROJECT ANALYSIS\n';
        output += '='.repeat(80) + '\n\n';
        
        // Project Overview Section
        output += 'PROJECT OVERVIEW\n';
        output += '-'.repeat(40) + '\n';
        output += `Generated: ${new Date().toISOString()}\n`;
        output += `Analysis Scope: ${filteredFiles.length} files processed\n`;
        output += `Root Directory: ${this.fileExplorer.currentPath}\n`;
        output += `Total Files Scanned: ${filteringSummary.totalOriginal}\n`;
        output += `Files Included: ${filteringSummary.totalIncluded}\n`;
        output += `Files Filtered: ${filteringSummary.totalExcluded}\n\n`;

        // Tech Stack Analysis
        if (projectAnalysis) {
            const summary = this.fileExplorer.projectAnalyzer.generateAnalysisSummary();
            
            output += 'TECHNOLOGY STACK\n';
            output += '-'.repeat(40) + '\n';
            
            if (summary.projectTypes.length > 0) {
                output += 'Primary Technologies:\n';
                summary.projectTypes.forEach((project, index) => {
                    const confidence = project.confidence;
                    const confidenceIndicator = confidence >= 80 ? '🟢' : confidence >= 60 ? '🟡' : '🟠';
                    output += `${index + 1}. ${confidenceIndicator} ${project.name.toUpperCase()}`;
                    if (project.subType) {
                        output += ` (${project.subType})`;
                    }
                    output += ` - ${confidence}% confidence\n`;
                    if (project.mainIndicators.length > 0) {
                        output += `   └─ Evidence: ${project.mainIndicators.slice(0, 2).join(', ')}\n`;
                    }
                });
            } else {
                output += 'No specific frameworks detected - analyzing as generic project\n';
            }
            output += '\n';

            // Dependencies Analysis
            if (summary.dependencies.length > 0) {
                output += 'DEPENDENCY ANALYSIS\n';
                output += '-'.repeat(40) + '\n';
                summary.dependencies.forEach(dep => {
                    output += `${dep.type.toUpperCase()} Dependencies (${dep.file}):\n`;
                    output += `  └─ Total: ${dep.count} packages\n`;
                    if (dep.mainDependencies.length > 0) {
                        output += `  └─ Key packages: ${dep.mainDependencies.slice(0, 5).join(', ')}\n`;
                    }
                });
                output += '\n';
            }
        }

        // Entry Points Section
        if (this.entryPoints.length > 0) {
            output += 'ENTRY POINTS ANALYSIS\n';
            output += '-'.repeat(40) + '\n';
            output += 'Recommended reading order for AI analysis:\n\n';
            
            this.entryPoints.forEach((entryPoint, index) => {
                const priorityEmoji = entryPoint.priority >= 90 ? '🚀' : entryPoint.priority >= 80 ? '⭐' : '📍';
                output += `${index + 1}. ${priorityEmoji} ${entryPoint.fileName}\n`;
                output += `   Path: ${entryPoint.path.replace(this.fileExplorer.currentPath, '').replace(/^\//, '')}\n`;
                output += `   Type: ${entryPoint.type.replace(/_/g, ' ').toUpperCase()}\n`;
                output += `   Description: ${entryPoint.description}\n`;
                output += `   Priority: ${entryPoint.priority}/100\n\n`;
            });
        }

        // File Relationships Mapping
        output += 'FILE RELATIONSHIP MAPPING\n';
        output += '-'.repeat(40) + '\n';
        
        const relationshipStats = this.generateRelationshipStats();
        output += `Total Import Statements: ${relationshipStats.totalImports}\n`;
        output += `Total Export Statements: ${relationshipStats.totalExports}\n`;
        output += `Dependency Files: ${relationshipStats.dependencyFiles}\n`;
        output += `Interconnected Files: ${relationshipStats.interconnectedFiles}\n\n`;

        if (relationshipStats.keyConnectors.length > 0) {
            output += 'Key Connector Files (most imported/referenced):\n';
            relationshipStats.keyConnectors.forEach((connector, index) => {
                output += `${index + 1}. ${connector.file} (${connector.connections} connections)\n`;
            });
            output += '\n';
        }

        // Architectural Decisions
        if (this.architecturalDecisions.length > 0) {
            output += 'ARCHITECTURAL DECISIONS\n';
            output += '-'.repeat(40) + '\n';
            
            // Group by confidence level
            const highConfidence = this.architecturalDecisions.filter(d => d.confidence >= 80);
            const mediumConfidence = this.architecturalDecisions.filter(d => d.confidence >= 60 && d.confidence < 80);
            const lowConfidence = this.architecturalDecisions.filter(d => d.confidence < 60);

            if (highConfidence.length > 0) {
                output += 'High Confidence Patterns:\n';
                highConfidence.forEach(decision => {
                    output += `🟢 ${decision.pattern} (${decision.confidence}%)\n`;
                    output += `   └─ ${decision.description}\n`;
                    output += `   └─ Evidence: ${decision.evidence}\n`;
                });
                output += '\n';
            }

            if (mediumConfidence.length > 0) {
                output += 'Medium Confidence Patterns:\n';
                mediumConfidence.forEach(decision => {
                    output += `🟡 ${decision.pattern} (${decision.confidence}%)\n`;
                    output += `   └─ ${decision.description}\n`;
                });
                output += '\n';
            }

            if (lowConfidence.length > 0) {
                output += 'Potential Patterns:\n';
                lowConfidence.forEach(decision => {
                    output += `🟠 ${decision.pattern} (${decision.confidence}%)\n`;
                    output += `   └─ ${decision.description}\n`;
                });
                output += '\n';
            }
        }

        // AI Analysis Instructions
        output += 'AI ANALYSIS INSTRUCTIONS\n';
        output += '-'.repeat(40) + '\n';
        output += 'This codebase has been optimized for AI analysis with the following features:\n';
        output += '• 🎯 Entry points identified and prioritized for systematic code review\n';
        output += '• 🔗 File relationships mapped to understand code dependencies\n';
        output += '• 🏗️ Architectural patterns detected and documented\n';
        output += '• 📊 Technology stack analysis with confidence scoring\n';
        output += '• 🧠 Smart content filtering to focus on essential code\n';
        output += '• 📋 Comprehensive project metadata for context understanding\n\n';

        output += 'CODE OUTPUT REQUIREMENTS\n';
        output += '-'.repeat(40) + '\n';
        output += 'IMPORTANT: When writing code or creating files, you MUST:\n';
        output += '• ✅ Always use code artifacts for any code/file output\n';
        output += '• ✅ Only write code when the user specifically requests it\n';
        output += '• ✅ Create separate artifacts for different files/components\n';
        output += '• ✅ Use appropriate file extensions and naming conventions\n';
        output += '• ❌ DO NOT write code for general analysis or discussion\n';
        output += '• ❌ DO NOT provide code unless explicitly asked\n';
        output += '• ❌ DO NOT include code snippets in regular text responses\n\n';
        output += 'Code should only be provided when the user makes requests like:\n';
        output += '- "Write a function to..."\n';
        output += '- "Create a component for..."\n';
        output += '- "Generate a script that..."\n';
        output += '- "Build a [specific feature]..."\n';
        output += '- "Fix this bug in..."\n';
        output += '- "Refactor this code..."\n\n';

        if (this.fileExplorer.settingsManager.settings.customPrompt?.trim()) {
            output += 'CUSTOM ANALYSIS INSTRUCTIONS\n';
            output += '-'.repeat(40) + '\n';
            output += this.fileExplorer.settingsManager.settings.customPrompt.trim() + '\n\n';
        }

        output += 'RECOMMENDED ANALYSIS APPROACH\n';
        output += '-'.repeat(40) + '\n';
        output += '1. Start with the highest-priority entry points listed above\n';
        output += '2. Follow import/dependency chains to understand data flow\n';
        output += '3. Review architectural patterns for design understanding\n';
        output += '4. Examine file relationships to grasp system interactions\n';
        output += '5. Use the technology stack info for context-aware suggestions\n';
        output += '6. Provide analysis and recommendations WITHOUT writing code\n';
        output += '7. Only write code when specifically requested by the user\n\n';

        return output;
    }

    generateRelationshipStats() {
        let totalImports = 0;
        let totalExports = 0;
        let dependencyFiles = 0;
        const connectionCounts = new Map();

        for (const [filePath, relationships] of this.fileRelationships.entries()) {
            totalImports += relationships.imports.length;
            totalExports += relationships.exports.length;
            
            if (relationships.dependencies.length > 0) {
                dependencyFiles++;
            }

            // Count connections for this file
            const connections = relationships.imports.length + 
                             relationships.exports.length + 
                             relationships.relatedFiles.length;
            
            if (connections > 0) {
                const fileName = filePath.split('/').pop();
                connectionCounts.set(fileName, connections);
            }
        }

        // Find key connector files (most connected)
        const keyConnectors = Array.from(connectionCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([file, connections]) => ({ file, connections }));

        return {
            totalImports,
            totalExports,
            dependencyFiles,
            interconnectedFiles: connectionCounts.size,
            keyConnectors
        };
    }

    async processFile(filePath, priority, fileInfoList) {
        try {
            if (typeof filePath !== 'string') {
                console.error('Invalid filePath type:', typeof filePath, filePath);
                return '';
            }

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

            // Add AI-optimized metadata
            const relationships = this.fileRelationships.get(filePath);
            if (relationships) {
                output += `imports_count: ${relationships.imports.length}\n`;
                output += `exports_count: ${relationships.exports.length}\n`;
                output += `dependencies_count: ${relationships.dependencies.length}\n`;
                output += `related_files_count: ${relationships.relatedFiles.length}\n`;
            }

            const entryPoint = this.entryPoints.find(ep => ep.path === filePath);
            if (entryPoint) {
                output += `entry_point: true\n`;
                output += `entry_point_type: ${entryPoint.type}\n`;
                output += `entry_point_priority: ${entryPoint.priority}\n`;
                output += `entry_point_description: ${entryPoint.description}\n`;
            }

            const classifications = this.getFileClassifications(filePath);
            if (classifications.length > 0) {
                output += `classification: ${classifications.join(', ')}\n`;
            }

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

            // Add file relationships metadata
            if (relationships) {
                if (relationships.imports.length > 0) {
                    output += `imports: ${relationships.imports.map(imp => imp.module).join(', ')}\n`;
                }
                if (relationships.exports.length > 0) {
                    output += `exports: ${relationships.exports.map(exp => exp.name || exp.type).join(', ')}\n`;
                }
                if (relationships.dependencies.length > 0) {
                    output += `package_dependencies: ${relationships.dependencies.slice(0, 10).map(dep => dep.name).join(', ')}\n`;
                }
                if (relationships.relatedFiles.length > 0) {
                    const relatedFileNames = relationships.relatedFiles.map(path => path.split('/').pop()).slice(0, 5);
                    output += `related_files: ${relatedFileNames.join(', ')}\n`;
                }
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
        if (projectTypes && projectTypes.has('react') && (fileName.endsWith('.jsx') || fileName.endsWith('.tsx'))) {
            analysis.framework = 'React component';
        } else if (projectTypes && projectTypes.has('vue') && fileName.endsWith('.vue')) {
            analysis.framework = 'Vue.js component';
        } else if (projectTypes && projectTypes.has('nodejs') && fileName.endsWith('.js')) {
            analysis.framework = 'Node.js module';
        } else if (projectTypes && projectTypes.has('python') && fileName.endsWith('.py')) {
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
        
        if (this.fileExplorer.dockerFiles && this.fileExplorer.dockerFiles.some(dockerFile => dockerFile.path === filePath)) {
            classifications.push('docker');
        }
        
        if (this.fileExplorer.djangoFiles && this.fileExplorer.djangoFiles.some(djangoFile => djangoFile.path === filePath)) {
            const djangoFile = this.fileExplorer.djangoFiles.find(df => df.path === filePath);
            classifications.push(`django-${djangoFile.type}`);
        }
        
        if (this.fileExplorer.reactFiles && this.fileExplorer.reactFiles.some(reactFile => reactFile.path === filePath)) {
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

    generateAIOptimizedFooter(fileInfoList, filterResult, projectAnalysis) {
        let output = '\n' + '='.repeat(80) + '\n\n';
        output += 'AI-OPTIMIZED ANALYSIS COMPLETE\n\n';

        // Project Analysis Summary
        if (projectAnalysis) {
            const summary = this.fileExplorer.projectAnalyzer.generateAnalysisSummary();
            
            output += 'FINAL PROJECT ANALYSIS\n';
            output += '-'.repeat(40) + '\n';
            if (summary.projectTypes.length > 0) {
                const mainProject = summary.projectTypes[0];
                output += `Primary Technology Stack: ${mainProject.name}`;
                if (mainProject.subType) {
                    output += ` (${mainProject.subType})`;
                }
                output += ` - ${mainProject.confidence}% confidence\n`;
                
                if (summary.projectTypes.length > 1) {
                    output += `Secondary Technologies: ${summary.projectTypes.slice(1).map(p => p.name).join(', ')}\n`;
                }
            }
            
            if (summary.dependencies.length > 0) {
                const totalDeps = summary.dependencies.reduce((sum, dep) => sum + dep.count, 0);
                output += `Dependency Ecosystem: ${totalDeps} packages across ${summary.dependencies.length} managers\n`;
            }
            
            if (summary.structure) {
                output += `Project Scale: ${summary.structure.maxDepth} directory levels, ${summary.structure.totalFiles} total files\n`;
                if (summary.structure.patterns.length > 0) {
                    output += `Architecture Patterns: ${summary.structure.patterns.join(', ')}\n`;
                }
            }
            output += '\n';
        }

        // Entry Points Summary
        if (this.entryPoints.length > 0) {
            output += 'ENTRY POINTS SUMMARY\n';
            output += '-'.repeat(40) + '\n';
            output += 'For optimal AI analysis, examine files in this priority order:\n';
            this.entryPoints.slice(0, 5).forEach((ep, index) => {
                output += `${index + 1}. ${ep.fileName} (${ep.type.replace(/_/g, ' ')})\n`;
            });
            output += '\n';
        }

        // File Relationship Summary
        const relationshipStats = this.generateRelationshipStats();
        if (relationshipStats.interconnectedFiles > 0) {
            output += 'FILE RELATIONSHIP SUMMARY\n';
            output += '-'.repeat(40) + '\n';
            output += `Code Connectivity: ${relationshipStats.interconnectedFiles} interconnected files\n`;
            output += `Import/Export Flow: ${relationshipStats.totalImports} imports, ${relationshipStats.totalExports} exports\n`;
            
            if (relationshipStats.keyConnectors.length > 0) {
                output += `Key Architecture Files: ${relationshipStats.keyConnectors.slice(0, 3).map(kc => kc.file).join(', ')}\n`;
            }
            output += '\n';
        }

        // Architectural Decisions Summary
        if (this.architecturalDecisions.length > 0) {
            output += 'ARCHITECTURAL DECISIONS SUMMARY\n';
            output += '-'.repeat(40) + '\n';
            const highConfidenceDecisions = this.architecturalDecisions.filter(d => d.confidence >= 80);
            if (highConfidenceDecisions.length > 0) {
                output += 'Confirmed Architectural Patterns:\n';
                highConfidenceDecisions.forEach(decision => {
                    output += `• ${decision.pattern} (${decision.confidence}% confidence)\n`;
                });
            }
            output += '\n';
        }

        // Files Included by Priority
        if (fileInfoList.length > 0) {
            const filesByCategory = {};
            for (const file of fileInfoList) {
                const category = file.priority.category;
                if (!filesByCategory[category]) {
                    filesByCategory[category] = [];
                }
                filesByCategory[category].push(file.path);
            }

            output += 'FILES ANALYZED BY PRIORITY\n';
            output += '-'.repeat(40) + '\n';
            
            const categoryOrder = ['core', 'business', 'config', 'source', 'styles', 'tests', 'docs', 'assets', 'other', 'fallback', 'error'];
            for (const category of categoryOrder) {
                if (filesByCategory[category]) {
                    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                    output += `${categoryName} Files: ${filesByCategory[category].join(', ')}\n`;
                }
            }
            output += '\n';
        }

        // Smart Filtering Summary
        if (filterResult.excluded.length > 0) {
            output += 'SMART FILTERING APPLIED\n';
            output += '-'.repeat(40) + '\n';
            const excludedPaths = filterResult.excluded.map(f => f.path.replace(this.fileExplorer.currentPath, '').replace(/^\//, ''));
            output += `${excludedPaths.length} files automatically filtered for focused analysis\n`;
            output += `Common exclusions: build artifacts, dependencies, generated files\n\n`;
        }

        // AI Analysis Features Summary
        output += 'AI OPTIMIZATION FEATURES APPLIED\n';
        output += '-'.repeat(40) + '\n';
        output += '✅ Entry Point Identification - Files prioritized by architectural importance\n';
        output += '✅ File Relationship Mapping - Import/export dependencies tracked\n';
        output += '✅ Technology Stack Detection - Frameworks and tools identified\n';
        output += '✅ Architectural Pattern Analysis - Design patterns documented\n';
        output += '✅ Smart Content Filtering - Non-essential files excluded\n';
        output += '✅ Project Role Classification - Each file\'s purpose explained\n';
        output += '✅ Dependency Analysis - Package relationships mapped\n';
        output += '✅ Code Compression - Boilerplate reduced for clarity\n\n';

        output += 'DONE PASTING\n\n';
        
        output += 'This AI-optimized codebase analysis includes:\n';
        output += '• 🎯 Systematic entry points for logical code exploration\n';
        output += '• 🔗 Complete file relationship mapping for dependency understanding\n';
        output += '• 🏗️ Architectural pattern detection with confidence scoring\n';
        output += '• 📊 Comprehensive technology stack analysis\n';
        output += '• 🧠 Intelligent content filtering and prioritization\n';
        output += '• 📋 Rich metadata for enhanced AI comprehension\n\n';

        if (this.fileExplorer.settingsManager.settings.customPrompt?.trim()) {
            output += 'CUSTOM ANALYSIS INSTRUCTIONS\n';
            output += '-'.repeat(40) + '\n';
            output += this.fileExplorer.settingsManager.settings.customPrompt.trim() + '\n\n';
        }

        output += 'This codebase is now optimized for AI analysis with comprehensive context and structured metadata.\n';

        return output;
    }

    getEnabledProjectTypes() {
        const enabledProjectTypes = [];
        
        if (this.fileExplorer.settingsManager.settings.projectTypes?.django && this.fileExplorer.djangoFiles?.length > 0) {
            enabledProjectTypes.push(`Django (${this.fileExplorer.djangoFiles.length} files)`);
        }
        
        if (this.fileExplorer.settingsManager.settings.projectTypes?.react && this.fileExplorer.reactFiles?.length > 0) {
            enabledProjectTypes.push(`React (${this.fileExplorer.reactFiles.length} files)`);
        }
        
        return enabledProjectTypes;
    }

    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
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