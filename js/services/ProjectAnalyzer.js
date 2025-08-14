// js/services/ProjectAnalyzer.js (Enhanced with Relationship Analysis)
export class ProjectAnalyzer {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.projectTypes = new Map();
        this.dependencies = new Map();
        this.projectStructure = null;
        this.recommendations = [];
        this.fileRelationships = new Map();
        this.codeArchitecture = {
            modules: new Map(),
            dataFlow: [],
            layerStructure: {},
            couplingAnalysis: {}
        };
    }

    async analyzeProject() {
        console.log('🔍 Starting comprehensive project analysis...');
        
        try {
            // Get all files from selected files and the current directory
            const allFiles = await this.getAllProjectFiles();
            
            // Analyze project types
            await this.detectProjectTypes(allFiles);
            
            // Analyze dependencies
            await this.analyzeDependencies(allFiles);
            
            // Analyze project structure
            this.analyzeProjectStructure(allFiles);
            
            // NEW: Analyze code relationships and architecture
            await this.analyzeCodeArchitecture(allFiles);
            
            // Generate recommendations
            this.generateRecommendations();
            
            const detectedTypes = Array.from(this.projectTypes.keys());
            console.log(`🎯 Detected ${detectedTypes.length} project types:`, detectedTypes);
            
            console.log('✅ Project analysis complete');
            return {
                projectTypes: this.projectTypes,
                dependencies: this.dependencies,
                structure: this.projectStructure,
                recommendations: this.recommendations,
                architecture: this.codeArchitecture,
                relationships: this.fileRelationships
            };
        } catch (error) {
            console.error('❌ Error in project analysis:', error);
            return null;
        }
    }

    async analyzeCodeArchitecture(files) {
        console.log('🏗️ Analyzing code architecture and relationships...');
        
        // Analyze each file for relationships
        for (const file of files) {
            try {
                const content = await this.getFileContent(file.path);
                if (!content || this.isBinaryFile(file.name)) continue;

                const relationships = await this.analyzeFileRelationships(file, content, files);
                this.fileRelationships.set(file.path, relationships);
                
                // Build module structure
                this.buildModuleStructure(file, relationships);
                
            } catch (error) {
                console.warn(`Error analyzing ${file.path}:`, error);
            }
        }

        // Analyze data flow patterns
        this.analyzeDataFlow();
        
        // Analyze layer structure
        this.analyzeLayerStructure(files);
        
        // Analyze coupling between components
        this.analyzeCoupling();
    }

    async analyzeFileRelationships(file, content, allFiles) {
        const relationships = {
            imports: [],
            exports: [],
            dependencies: [],
            calls: [],
            inheritance: [],
            interfaces: [],
            types: []
        };

        const extension = file.name.split('.').pop().toLowerCase();

        // Analyze based on file type
        if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            this.analyzeJavaScriptRelationships(content, relationships);
        } else if (extension === 'py') {
            this.analyzePythonRelationships(content, relationships);
        } else if (['java', 'kt'].includes(extension)) {
            this.analyzeJavaRelationships(content, relationships);
        } else if (['cs'].includes(extension)) {
            this.analyzeCSharpRelationships(content, relationships);
        }

        // Find related files in the same directory or with similar names
        relationships.relatedFiles = this.findRelatedFiles(file.path, allFiles);

        return relationships;
    }

    analyzeJavaScriptRelationships(content, relationships) {
        // Import analysis
        const importPatterns = [
            // ES6 imports
            /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+['"]([^'"]+)['"]/g,
            // Dynamic imports
            /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            // CommonJS
            /const\s+{([^}]+)}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            /const\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
        ];

        importPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                relationships.imports.push({
                    type: pattern.source.includes('import') ? 'import' : 'require',
                    module: match[2] || match[1],
                    items: match[1] && match[2] ? match[1].split(',').map(s => s.trim()) : [],
                    line: this.getLineNumber(content, match.index)
                });
            }
        });

        // Export analysis
        const exportPatterns = [
            /export\s+default\s+(\w+)/g,
            /export\s+{([^}]+)}/g,
            /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
            /module\.exports\s*=\s*(\w+)/g,
            /exports\.(\w+)\s*=/g
        ];

        exportPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                relationships.exports.push({
                    type: pattern.source.includes('default') ? 'default' : 'named',
                    name: match[1],
                    line: this.getLineNumber(content, match.index)
                });
            }
        });

        // Function calls analysis
        const callPattern = /(\w+)\s*\(/g;
        let match;
        while ((match = callPattern.exec(content)) !== null) {
            if (this.isSignificantCall(match[1])) {
                relationships.calls.push({
                    function: match[1],
                    line: this.getLineNumber(content, match.index)
                });
            }
        }

        // Class inheritance (ES6)
        const inheritancePattern = /class\s+(\w+)\s+extends\s+(\w+)/g;
        while ((match = inheritancePattern.exec(content)) !== null) {
            relationships.inheritance.push({
                child: match[1],
                parent: match[2],
                line: this.getLineNumber(content, match.index)
            });
        }

        // TypeScript interfaces
        const interfacePattern = /interface\s+(\w+)(?:\s+extends\s+(\w+))?/g;
        while ((match = interfacePattern.exec(content)) !== null) {
            relationships.interfaces.push({
                name: match[1],
                extends: match[2],
                line: this.getLineNumber(content, match.index)
            });
        }
    }

    analyzePythonRelationships(content, relationships) {
        // Import analysis
        const importPatterns = [
            /from\s+([^\s]+)\s+import\s+([^\n]+)/g,
            /import\s+([^\s\n]+)/g
        ];

        importPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                relationships.imports.push({
                    type: pattern.source.includes('from') ? 'from_import' : 'import',
                    module: match[1],
                    items: match[2] ? match[2].split(',').map(s => s.trim()) : [],
                    line: this.getLineNumber(content, match.index)
                });
            }
        });

        // Class inheritance
        const inheritancePattern = /class\s+(\w+)\(([^)]+)\):/g;
        let match;
        while ((match = inheritancePattern.exec(content)) !== null) {
            const parents = match[2].split(',').map(s => s.trim());
            parents.forEach(parent => {
                relationships.inheritance.push({
                    child: match[1],
                    parent: parent,
                    line: this.getLineNumber(content, match.index)
                });
            });
        }

        // Function definitions (for export analysis)
        const functionPattern = /def\s+(\w+)\(/g;
        while ((match = functionPattern.exec(content)) !== null) {
            relationships.exports.push({
                type: 'function',
                name: match[1],
                line: this.getLineNumber(content, match.index)
            });
        }

        // Class definitions
        const classPattern = /class\s+(\w+)[\(:]?/g;
        while ((match = classPattern.exec(content)) !== null) {
            relationships.exports.push({
                type: 'class',
                name: match[1],
                line: this.getLineNumber(content, match.index)
            });
        }
    }

    analyzeJavaRelationships(content, relationships) {
        // Package and imports
        const packageMatch = content.match(/package\s+([^;]+);/);
        if (packageMatch) {
            relationships.package = packageMatch[1];
        }

        const importPattern = /import\s+(?:static\s+)?([^;]+);/g;
        let match;
        while ((match = importPattern.exec(content)) !== null) {
            relationships.imports.push({
                type: 'import',
                module: match[1],
                line: this.getLineNumber(content, match.index)
            });
        }

        // Class inheritance and interfaces
        const classPattern = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g;
        while ((match = classPattern.exec(content)) !== null) {
            relationships.exports.push({
                type: 'class',
                name: match[1],
                line: this.getLineNumber(content, match.index)
            });

            if (match[2]) {
                relationships.inheritance.push({
                    child: match[1],
                    parent: match[2],
                    line: this.getLineNumber(content, match.index)
                });
            }

            if (match[3]) {
                const interfaces = match[3].split(',').map(s => s.trim());
                interfaces.forEach(interfaceName => {
                    relationships.interfaces.push({
                        implementer: match[1],
                        interface: interfaceName,
                        line: this.getLineNumber(content, match.index)
                    });
                });
            }
        }
    }

    analyzeCSharpRelationships(content, relationships) {
        // Using statements
        const usingPattern = /using\s+([^;]+);/g;
        let match;
        while ((match = usingPattern.exec(content)) !== null) {
            relationships.imports.push({
                type: 'using',
                module: match[1],
                line: this.getLineNumber(content, match.index)
            });
        }

        // Class inheritance and interfaces
        const classPattern = /class\s+(\w+)(?:\s*:\s*([^{]+))?/g;
        while ((match = classPattern.exec(content)) !== null) {
            relationships.exports.push({
                type: 'class',
                name: match[1],
                line: this.getLineNumber(content, match.index)
            });

            if (match[2]) {
                const inheritance = match[2].split(',').map(s => s.trim());
                inheritance.forEach(parent => {
                    if (parent.includes('I') && parent[0] === 'I' && parent[1] === parent[1].toUpperCase()) {
                        // Likely an interface
                        relationships.interfaces.push({
                            implementer: match[1],
                            interface: parent,
                            line: this.getLineNumber(content, match.index)
                        });
                    } else {
                        // Likely a base class
                        relationships.inheritance.push({
                            child: match[1],
                            parent: parent,
                            line: this.getLineNumber(content, match.index)
                        });
                    }
                });
            }
        }
    }

    buildModuleStructure(file, relationships) {
        const modulePath = this.getModulePath(file.path);
        
        if (!this.codeArchitecture.modules.has(modulePath)) {
            this.codeArchitecture.modules.set(modulePath, {
                files: [],
                exports: [],
                imports: [],
                responsibilities: new Set(),
                complexity: 0
            });
        }

        const module = this.codeArchitecture.modules.get(modulePath);
        module.files.push(file.path);
        module.exports.push(...relationships.exports);
        module.imports.push(...relationships.imports);

        // Determine module responsibility
        this.determineModuleResponsibility(file, module);
        
        // Calculate complexity
        module.complexity += relationships.imports.length + relationships.exports.length + relationships.calls.length;
    }

    determineModuleResponsibility(file, module) {
        const fileName = file.name.toLowerCase();
        const filePath = file.path.toLowerCase();

        // UI/Presentation layer
        if (filePath.includes('/component') || filePath.includes('/page') || filePath.includes('/view') || 
            fileName.includes('component') || fileName.includes('page') || fileName.endsWith('.jsx') || fileName.endsWith('.vue')) {
            module.responsibilities.add('presentation');
        }

        // Business logic layer
        if (filePath.includes('/service') || filePath.includes('/business') || filePath.includes('/logic') ||
            fileName.includes('service') || fileName.includes('manager') || fileName.includes('handler')) {
            module.responsibilities.add('business_logic');
        }

        // Data layer
        if (filePath.includes('/model') || filePath.includes('/data') || filePath.includes('/repository') ||
            fileName.includes('model') || fileName.includes('repository') || fileName.includes('dao')) {
            module.responsibilities.add('data_access');
        }

        // API layer
        if (filePath.includes('/api') || filePath.includes('/controller') || filePath.includes('/route') ||
            fileName.includes('api') || fileName.includes('controller') || fileName.includes('route')) {
            module.responsibilities.add('api');
        }

        // Configuration
        if (fileName.includes('config') || fileName.includes('setting') || fileName === 'package.json') {
            module.responsibilities.add('configuration');
        }

        // Testing
        if (filePath.includes('/test') || fileName.includes('test') || fileName.includes('spec')) {
            module.responsibilities.add('testing');
        }

        // Utilities
        if (filePath.includes('/util') || filePath.includes('/helper') || filePath.includes('/common') ||
            fileName.includes('util') || fileName.includes('helper') || fileName.includes('common')) {
            module.responsibilities.add('utility');
        }
    }

    analyzeDataFlow() {
        console.log('📊 Analyzing data flow patterns...');
        
        for (const [filePath, relationships] of this.fileRelationships.entries()) {
            // Track data flow through imports/exports
            relationships.imports.forEach(imp => {
                if (imp.module.startsWith('./') || imp.module.startsWith('../')) {
                    // Local module import - creates data flow
                    this.codeArchitecture.dataFlow.push({
                        from: this.resolveRelativePath(filePath, imp.module),
                        to: filePath,
                        type: 'import',
                        items: imp.items || [],
                        strength: imp.items ? imp.items.length : 1
                    });
                }
            });

            // Track function calls that might indicate data flow
            relationships.calls.forEach(call => {
                if (this.isDataFlowCall(call.function)) {
                    this.codeArchitecture.dataFlow.push({
                        from: filePath,
                        to: 'external',
                        type: 'call',
                        function: call.function,
                        strength: 1
                    });
                }
            });
        }

        // Analyze flow patterns
        this.identifyDataFlowPatterns();
    }

    analyzeLayerStructure(files) {
        console.log('🏛️ Analyzing architectural layers...');
        
        const layers = {
            presentation: { files: [], dependencies: [] },
            business: { files: [], dependencies: [] },
            data: { files: [], dependencies: [] },
            api: { files: [], dependencies: [] },
            configuration: { files: [], dependencies: [] },
            utility: { files: [], dependencies: [] }
        };

        // Classify files into layers
        for (const [modulePath, moduleData] of this.codeArchitecture.modules.entries()) {
            for (const responsibility of moduleData.responsibilities) {
                if (responsibility === 'presentation') {
                    layers.presentation.files.push(...moduleData.files);
                } else if (responsibility === 'business_logic') {
                    layers.business.files.push(...moduleData.files);
                } else if (responsibility === 'data_access') {
                    layers.data.files.push(...moduleData.files);
                } else if (responsibility === 'api') {
                    layers.api.files.push(...moduleData.files);
                } else if (responsibility === 'configuration') {
                    layers.configuration.files.push(...moduleData.files);
                } else if (responsibility === 'utility') {
                    layers.utility.files.push(...moduleData.files);
                }
            }
        }

        // Analyze dependencies between layers
        this.analyzeLayerDependencies(layers);
        
        this.codeArchitecture.layerStructure = layers;
    }

    analyzeLayerDependencies(layers) {
        for (const [layerName, layerData] of Object.entries(layers)) {
            for (const filePath of layerData.files) {
                const relationships = this.fileRelationships.get(filePath);
                if (!relationships) continue;

                relationships.imports.forEach(imp => {
                    const importedFilePath = this.resolveImportPath(filePath, imp.module);
                    if (importedFilePath) {
                        const targetLayer = this.findFileLayer(importedFilePath, layers);
                        if (targetLayer && targetLayer !== layerName) {
                            layerData.dependencies.push({
                                target: targetLayer,
                                file: filePath,
                                import: imp.module
                            });
                        }
                    }
                });
            }
        }
    }

    analyzeCoupling() {
        console.log('🔗 Analyzing component coupling...');
        
        const coupling = {
            afferent: new Map(), // Who depends on this file
            efferent: new Map(), // What this file depends on
            instability: new Map(), // Instability metric (Ce / (Ca + Ce))
            abstractness: new Map() // How abstract vs concrete
        };

        // Calculate afferent and efferent coupling
        for (const [filePath, relationships] of this.fileRelationships.entries()) {
            if (!coupling.afferent.has(filePath)) coupling.afferent.set(filePath, new Set());
            if (!coupling.efferent.has(filePath)) coupling.efferent.set(filePath, new Set());

            // Efferent coupling (outgoing dependencies)
            relationships.imports.forEach(imp => {
                const importedFile = this.resolveImportPath(filePath, imp.module);
                if (importedFile) {
                    coupling.efferent.get(filePath).add(importedFile);
                    
                    // Afferent coupling (incoming dependencies)
                    if (!coupling.afferent.has(importedFile)) {
                        coupling.afferent.set(importedFile, new Set());
                    }
                    coupling.afferent.get(importedFile).add(filePath);
                }
            });
        }

        // Calculate instability metric
        for (const filePath of this.fileRelationships.keys()) {
            const ca = coupling.afferent.get(filePath)?.size || 0; // Afferent coupling
            const ce = coupling.efferent.get(filePath)?.size || 0; // Efferent coupling
            const instability = (ca + ce === 0) ? 0 : ce / (ca + ce);
            coupling.instability.set(filePath, instability);
        }

        // Calculate abstractness (simplified - based on exports vs concrete implementations)
        for (const [filePath, relationships] of this.fileRelationships.entries()) {
            const exports = relationships.exports.length;
            const implementations = relationships.calls.length + relationships.inheritance.length;
            const abstractness = exports === 0 ? 0 : implementations / (exports + implementations);
            coupling.abstractness.set(filePath, abstractness);
        }

        this.codeArchitecture.couplingAnalysis = coupling;
    }

    identifyDataFlowPatterns() {
        const patterns = [];
        const flowMap = new Map();

        // Build flow map
        this.codeArchitecture.dataFlow.forEach(flow => {
            if (!flowMap.has(flow.from)) flowMap.set(flow.from, []);
            flowMap.get(flow.from).push(flow);
        });

        // Identify common patterns
        for (const [source, flows] of flowMap.entries()) {
            if (flows.length > 3) {
                patterns.push({
                    type: 'hub',
                    file: source,
                    connections: flows.length,
                    description: 'Central component with many outgoing dependencies'
                });
            }

            const importFlows = flows.filter(f => f.type === 'import');
            if (importFlows.length > 5) {
                patterns.push({
                    type: 'aggregator',
                    file: source,
                    imports: importFlows.length,
                    description: 'Component that aggregates many dependencies'
                });
            }
        }

        this.codeArchitecture.dataFlowPatterns = patterns;
    }

    // Utility methods
    getModulePath(filePath) {
        const parts = filePath.split('/');
        if (parts.length <= 2) return filePath;
        return parts.slice(0, -1).join('/'); // Directory path
    }

    resolveRelativePath(currentPath, relativePath) {
        const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
        if (relativePath.startsWith('./')) {
            return currentDir + '/' + relativePath.substring(2);
        } else if (relativePath.startsWith('../')) {
            const parts = currentDir.split('/');
            const relativeParts = relativePath.split('/');
            let upCount = 0;
            for (const part of relativeParts) {
                if (part === '..') upCount++;
                else break;
            }
            const resolvedParts = parts.slice(0, -upCount).concat(relativeParts.slice(upCount));
            return resolvedParts.join('/');
        }
        return relativePath;
    }

    resolveImportPath(currentPath, importPath) {
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            return this.resolveRelativePath(currentPath, importPath);
        }
        return null; // External dependency
    }

    findFileLayer(filePath, layers) {
        for (const [layerName, layerData] of Object.entries(layers)) {
            if (layerData.files.includes(filePath)) {
                return layerName;
            }
        }
        return null;
    }

    isSignificantCall(functionName) {
        // Filter out common/built-in functions to focus on significant calls
        const builtIns = ['console', 'require', 'import', 'export', 'return', 'if', 'for', 'while', 'switch'];
        return !builtIns.includes(functionName) && functionName.length > 2;
    }

    isDataFlowCall(functionName) {
        const dataFlowFunctions = ['fetch', 'axios', 'get', 'post', 'put', 'delete', 'query', 'save', 'update', 'create'];
        return dataFlowFunctions.some(flow => functionName.toLowerCase().includes(flow));
    }

    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    isBinaryFile(fileName) {
        const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll'];
        return binaryExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    // Enhanced analysis summary generation
    generateAnalysisSummary() {
        const projectTypes = Array.from(this.projectTypes.entries())
            .map(([name, data]) => ({
                name,
                confidence: data.confidence,
                subType: data.subType?.name,
                mainIndicators: data.indicators.slice(0, 3)
            }))
            .sort((a, b) => b.confidence - a.confidence);

        const dependencies = Array.from(this.dependencies.entries())
            .map(([type, data]) => ({
                type,
                file: data.file,
                count: data.count,
                mainDependencies: data.dependencies
                    .filter(dep => dep.type === 'production')
                    .slice(0, 5)
                    .map(dep => dep.name)
            }));

        // Enhanced architecture summary
        const architecture = {
            modules: this.codeArchitecture.modules.size,
            dataFlowConnections: this.codeArchitecture.dataFlow.length,
            layers: Object.keys(this.codeArchitecture.layerStructure).filter(
                layer => this.codeArchitecture.layerStructure[layer].files.length > 0
            ),
            couplingStats: this.getCouplingStats(),
            patterns: this.codeArchitecture.dataFlowPatterns || []
        };

        return {
            projectTypes,
            dependencies,
            structure: this.projectStructure,
            recommendations: this.recommendations,
            architecture,
            relationships: this.fileRelationships
        };
    }

    getCouplingStats() {
        if (!this.codeArchitecture.couplingAnalysis.instability) return {};

        const instabilities = Array.from(this.codeArchitecture.couplingAnalysis.instability.values());
        const avgInstability = instabilities.reduce((sum, val) => sum + val, 0) / instabilities.length;
        
        const highlyUnstable = instabilities.filter(i => i > 0.8).length;
        const stable = instabilities.filter(i => i < 0.2).length;

        return {
            averageInstability: Math.round(avgInstability * 100) / 100,
            highlyUnstableFiles: highlyUnstable,
            stableFiles: stable,
            totalAnalyzed: instabilities.length
        };
    }

    // Rest of the existing methods remain the same...
    async getAllProjectFiles() {
        const files = [];
        const selectedFiles = Array.from(this.fileExplorer.selectedFiles);
        
        for (const filePath of selectedFiles) {
            try {
                const fileName = filePath.split('/').pop();
                if (fileName && fileName.includes('.')) {
                    files.push({
                        path: filePath,
                        name: fileName,
                        relativePath: filePath.replace(this.fileExplorer.currentPath, '').replace(/^\//, ''),
                        directory: filePath.substring(0, filePath.lastIndexOf('/'))
                    });
                }
            } catch (error) {
                console.warn(`Skipping invalid file: ${filePath}`);
            }
        }
        
        return files;
    }

    // ... (include all other existing methods from the original ProjectAnalyzer)
    // detectProjectTypes, calculateProjectTypeScore, analyzeDependencies, etc.
    // (These would be the same as in the original file)

    async detectProjectTypes(files) {
        // Framework detection patterns (same as original)
        const detectionPatterns = {
            react: {
                patterns: [
                    { file: 'package.json', content: ['react'] },
                    { extension: '.jsx' },
                    { extension: '.tsx' },
                    { file: 'src/App.js' },
                    { file: 'src/App.jsx' },
                    { content: ['import React', 'from "react"', "from 'react'"] }
                ],
                subTypes: ['next.js', 'gatsby', 'create-react-app']
            },
            // ... (include all other patterns from original)
        };

        for (const [projectType, config] of Object.entries(detectionPatterns)) {
            const score = await this.calculateProjectTypeScore(projectType, config, files);
            
            if (score.confidence > 30) {
                const subType = await this.detectSubType(projectType, config, files);
                this.projectTypes.set(projectType, {
                    confidence: score.confidence,
                    indicators: score.indicators,
                    subType: subType,
                    mainFiles: score.mainFiles
                });
            }
        }
    }

    // ... (continue with all other original methods)
    // For brevity, I'm not repeating all the existing methods, but they should all be included

    async getFileContent(filePath) {
        try {
            const content = await this.fileExplorer.fileManager.getFileContent(filePath);
            return content?.content || null;
        } catch (error) {
            return null;
        }
    }
}