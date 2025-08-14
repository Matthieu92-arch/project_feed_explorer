// js/services/ProjectAnalyzer.js (Complete with all missing methods)
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
            
            // Analyze code relationships and architecture
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

    async detectProjectTypes(files) {
        console.log('🔍 Detecting project types...');
        
        // Framework detection patterns
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
            vue: {
                patterns: [
                    { file: 'package.json', content: ['vue'] },
                    { extension: '.vue' },
                    { content: ['Vue', 'createApp'] }
                ],
                subTypes: ['nuxt.js', 'quasar', 'vue-cli']
            },
            angular: {
                patterns: [
                    { file: 'package.json', content: ['@angular'] },
                    { file: 'angular.json' },
                    { content: ['@Component', '@Injectable', '@NgModule'] }
                ],
                subTypes: ['angular-cli', 'ionic']
            },
            nodejs: {
                patterns: [
                    { file: 'package.json', content: ['express', 'node'] },
                    { file: 'server.js' },
                    { file: 'app.js' },
                    { content: ['require(', 'module.exports'] }
                ],
                subTypes: ['express', 'fastify', 'koa']
            },
            python: {
                patterns: [
                    { extension: '.py' },
                    { file: 'requirements.txt' },
                    { file: 'setup.py' },
                    { file: 'pyproject.toml' }
                ],
                subTypes: ['django', 'flask', 'fastapi']
            },
            django: {
                patterns: [
                    { file: 'manage.py' },
                    { file: 'settings.py' },
                    { content: ['django', 'Django'] }
                ],
                subTypes: ['django-rest-framework']
            },
            flask: {
                patterns: [
                    { content: ['from flask', 'Flask('] },
                    { file: 'app.py', content: ['flask'] }
                ],
                subTypes: ['flask-restful', 'flask-api']
            },
            java: {
                patterns: [
                    { extension: '.java' },
                    { file: 'pom.xml' },
                    { file: 'build.gradle' }
                ],
                subTypes: ['spring-boot', 'maven', 'gradle']
            },
            dotnet: {
                patterns: [
                    { extension: '.cs' },
                    { extension: '.csproj' },
                    { file: 'Program.cs' }
                ],
                subTypes: ['asp.net-core', 'blazor', 'wpf']
            },
            php: {
                patterns: [
                    { extension: '.php' },
                    { file: 'composer.json' },
                    { content: ['<?php'] }
                ],
                subTypes: ['laravel', 'symfony', 'wordpress']
            },
            ruby: {
                patterns: [
                    { extension: '.rb' },
                    { file: 'Gemfile' },
                    { content: ['require'] }
                ],
                subTypes: ['rails', 'sinatra']
            },
            go: {
                patterns: [
                    { extension: '.go' },
                    { file: 'go.mod' },
                    { content: ['package main', 'import ('] }
                ],
                subTypes: ['gin', 'echo', 'fiber']
            },
            rust: {
                patterns: [
                    { extension: '.rs' },
                    { file: 'Cargo.toml' },
                    { content: ['fn main()', 'use std::'] }
                ],
                subTypes: ['actix-web', 'warp', 'rocket']
            }
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

    async calculateProjectTypeScore(projectType, config, files) {
        let score = 0;
        const indicators = [];
        const mainFiles = [];
        let totalPatterns = config.patterns.length;

        for (const pattern of config.patterns) {
            const matchResult = await this.checkPattern(pattern, files);
            if (matchResult.matches) {
                let patternScore = 0;
                
                if (pattern.file) {
                    patternScore = 25; // File existence is strong indicator
                    mainFiles.push(pattern.file);
                } else if (pattern.extension) {
                    patternScore = 15; // Extension match is moderate indicator
                } else if (pattern.content) {
                    patternScore = 20; // Content match is strong indicator
                }

                score += patternScore;
                indicators.push(matchResult.indicator);
            }
        }

        // Normalize score to percentage
        const maxPossibleScore = totalPatterns * 25;
        const confidence = Math.min(100, Math.round((score / maxPossibleScore) * 100));

        return {
            confidence,
            indicators: indicators.slice(0, 5), // Limit to top 5 indicators
            mainFiles: mainFiles.slice(0, 3) // Limit to top 3 main files
        };
    }

    async checkPattern(pattern, files) {
        if (pattern.file) {
            const file = files.find(f => f.name === pattern.file || f.relativePath.endsWith(pattern.file));
            if (file) {
                if (pattern.content) {
                    const content = await this.getFileContent(file.path);
                    if (content && this.containsAnyContent(content, pattern.content)) {
                        return { matches: true, indicator: `${pattern.file} with matching content` };
                    }
                } else {
                    return { matches: true, indicator: `Found ${pattern.file}` };
                }
            }
        }

        if (pattern.extension) {
            const hasExtension = files.some(f => f.name.endsWith(pattern.extension));
            if (hasExtension) {
                return { matches: true, indicator: `Found ${pattern.extension} files` };
            }
        }

        if (pattern.content) {
            for (const file of files) {
                const content = await this.getFileContent(file.path);
                if (content && this.containsAnyContent(content, pattern.content)) {
                    return { matches: true, indicator: `Found content patterns in ${file.name}` };
                }
            }
        }

        return { matches: false, indicator: null };
    }

    containsAnyContent(content, contentPatterns) {
        return contentPatterns.some(pattern => 
            content.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    async detectSubType(projectType, config, files) {
        if (!config.subTypes) return null;

        const subTypePatterns = {
            'next.js': ['next.config.js', 'next'],
            'gatsby': ['gatsby-config.js', 'gatsby'],
            'create-react-app': ['react-scripts', 'public/index.html'],
            'nuxt.js': ['nuxt.config.js', 'nuxt'],
            'vue-cli': ['vue.config.js', '@vue/cli'],
            'angular-cli': ['angular.json', '@angular/cli'],
            'ionic': ['ionic.config.json', '@ionic'],
            'express': ['express'],
            'fastify': ['fastify'],
            'koa': ['koa'],
            'django': ['django', 'manage.py'],
            'flask': ['flask', 'Flask'],
            'fastapi': ['fastapi', 'FastAPI'],
            'django-rest-framework': ['rest_framework'],
            'flask-restful': ['flask_restful'],
            'spring-boot': ['@SpringBootApplication', 'spring-boot'],
            'maven': ['pom.xml'],
            'gradle': ['build.gradle'],
            'asp.net-core': ['Microsoft.AspNetCore', 'Program.cs'],
            'blazor': ['@page', 'Blazor'],
            'wpf': ['System.Windows', '.xaml'],
            'laravel': ['artisan', 'laravel'],
            'symfony': ['symfony', 'Symfony'],
            'wordpress': ['wp-config.php', 'wordpress'],
            'rails': ['Gemfile', 'rails'],
            'sinatra': ['sinatra'],
            'gin': ['gin-gonic'],
            'echo': ['labstack/echo'],
            'fiber': ['gofiber'],
            'actix-web': ['actix-web'],
            'warp': ['warp'],
            'rocket': ['rocket']
        };

        for (const subType of config.subTypes) {
            const patterns = subTypePatterns[subType];
            if (patterns) {
                for (const pattern of patterns) {
                    const hasPattern = await this.checkSubTypePattern(pattern, files);
                    if (hasPattern) {
                        return { name: subType, confidence: 85 };
                    }
                }
            }
        }

        return null;
    }

    async checkSubTypePattern(pattern, files) {
        // Check file names
        if (files.some(f => f.name === pattern || f.relativePath.includes(pattern))) {
            return true;
        }

        // Check file contents
        for (const file of files) {
            const content = await this.getFileContent(file.path);
            if (content && content.toLowerCase().includes(pattern.toLowerCase())) {
                return true;
            }
        }

        return false;
    }

    async analyzeDependencies(files) {
        console.log('📦 Analyzing dependencies...');
        
        // Analyze package.json files
        await this.analyzeNpmDependencies(files);
        
        // Analyze requirements.txt files
        await this.analyzePythonDependencies(files);
        
        // Analyze other dependency files
        await this.analyzeOtherDependencies(files);
    }

    async analyzeNpmDependencies(files) {
        const packageJsonFiles = files.filter(f => f.name === 'package.json');
        
        for (const file of packageJsonFiles) {
            try {
                const content = await this.getFileContent(file.path);
                if (content) {
                    const packageData = JSON.parse(content);
                    const dependencies = [];
                    
                    if (packageData.dependencies) {
                        Object.entries(packageData.dependencies).forEach(([name, version]) => {
                            dependencies.push({ name, version, type: 'production' });
                        });
                    }
                    
                    if (packageData.devDependencies) {
                        Object.entries(packageData.devDependencies).forEach(([name, version]) => {
                            dependencies.push({ name, version, type: 'development' });
                        });
                    }
                    
                    this.dependencies.set('npm', {
                        file: file.relativePath,
                        dependencies,
                        count: dependencies.length
                    });
                }
            } catch (error) {
                console.warn(`Error parsing package.json: ${error.message}`);
            }
        }
    }

    async analyzePythonDependencies(files) {
        const requirementFiles = files.filter(f => 
            f.name === 'requirements.txt' || 
            f.name === 'requirements-dev.txt' ||
            f.name === 'Pipfile' ||
            f.name === 'pyproject.toml'
        );
        
        for (const file of requirementFiles) {
            try {
                const content = await this.getFileContent(file.path);
                if (content) {
                    const dependencies = this.parsePythonDependencies(content, file.name);
                    
                    this.dependencies.set('python', {
                        file: file.relativePath,
                        dependencies,
                        count: dependencies.length
                    });
                }
            } catch (error) {
                console.warn(`Error parsing Python dependencies: ${error.message}`);
            }
        }
    }

    parsePythonDependencies(content, fileName) {
        const dependencies = [];
        const lines = content.split('\n');
        
        if (fileName === 'requirements.txt' || fileName === 'requirements-dev.txt') {
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
                    const match = trimmed.match(/^([a-zA-Z0-9\-_.]+)([>=<~!]+.*)?$/);
                    if (match) {
                        dependencies.push({
                            name: match[1],
                            version: match[2] || '',
                            type: fileName.includes('dev') ? 'development' : 'production'
                        });
                    }
                }
            });
        } else if (fileName === 'Pipfile') {
            // Basic Pipfile parsing
            const packageMatch = content.match(/\[packages\]([\s\S]*?)(?=\[|$)/);
            if (packageMatch) {
                const packageSection = packageMatch[1];
                const packages = packageSection.match(/^(\w+)\s*=\s*"([^"]+)"/gm);
                if (packages) {
                    packages.forEach(pkg => {
                        const match = pkg.match(/^(\w+)\s*=\s*"([^"]+)"/);
                        if (match) {
                            dependencies.push({
                                name: match[1],
                                version: match[2],
                                type: 'production'
                            });
                        }
                    });
                }
            }
        }
        
        return dependencies;
    }

    async analyzeOtherDependencies(files) {
        // Analyze other dependency files like Gemfile, Cargo.toml, etc.
        const otherDepFiles = files.filter(f => 
            f.name === 'Gemfile' ||
            f.name === 'Cargo.toml' ||
            f.name === 'composer.json' ||
            f.name === 'go.mod'
        );
        
        for (const file of otherDepFiles) {
            try {
                const content = await this.getFileContent(file.path);
                if (content) {
                    const dependencies = this.parseOtherDependencies(content, file.name);
                    
                    const depType = this.getDepTypeFromFile(file.name);
                    this.dependencies.set(depType, {
                        file: file.relativePath,
                        dependencies,
                        count: dependencies.length
                    });
                }
            } catch (error) {
                console.warn(`Error parsing ${file.name}: ${error.message}`);
            }
        }
    }

    parseOtherDependencies(content, fileName) {
        const dependencies = [];
        
        // Simple parsing for different file types
        // This is a basic implementation and can be enhanced
        
        if (fileName === 'Gemfile') {
            const gemMatches = content.match(/gem\s+['"]([^'"]+)['"]/g);
            if (gemMatches) {
                gemMatches.forEach(match => {
                    const name = match.match(/gem\s+['"]([^'"]+)['"]/)[1];
                    dependencies.push({ name, version: '', type: 'production' });
                });
            }
        } else if (fileName === 'go.mod') {
            const requireMatches = content.match(/require\s+([^\s]+)\s+([^\s]+)/g);
            if (requireMatches) {
                requireMatches.forEach(match => {
                    const parts = match.replace('require', '').trim().split(/\s+/);
                    if (parts.length >= 2) {
                        dependencies.push({ 
                            name: parts[0], 
                            version: parts[1], 
                            type: 'production' 
                        });
                    }
                });
            }
        }
        
        return dependencies;
    }

    getDepTypeFromFile(fileName) {
        const mapping = {
            'Gemfile': 'ruby',
            'Cargo.toml': 'rust',
            'composer.json': 'php',
            'go.mod': 'go'
        };
        return mapping[fileName] || 'unknown';
    }

    analyzeProjectStructure(files) {
        console.log('🏗️ Analyzing project structure...');
        
        const structure = {
            totalFiles: files.length,
            directories: new Set(),
            fileTypes: new Map(),
            maxDepth: 0,
            patterns: []
        };

        // Analyze directory structure
        files.forEach(file => {
            const pathParts = file.relativePath.split('/').filter(p => p);
            structure.maxDepth = Math.max(structure.maxDepth, pathParts.length);
            
            // Add all parent directories
            for (let i = 0; i < pathParts.length - 1; i++) {
                const dirPath = pathParts.slice(0, i + 1).join('/');
                structure.directories.add(dirPath);
            }
            
            // Analyze file types
            const extension = file.name.split('.').pop().toLowerCase();
            if (extension && extension !== file.name) {
                structure.fileTypes.set(extension, (structure.fileTypes.get(extension) || 0) + 1);
            }
        });

        // Detect common patterns
        const commonPatterns = [
            'src', 'lib', 'app', 'components', 'pages', 'views', 
            'controllers', 'models', 'services', 'utils', 'helpers',
            'test', 'tests', '__tests__', 'spec', 'config', 'public',
            'assets', 'static', 'docs', 'documentation'
        ];

        commonPatterns.forEach(pattern => {
            if (Array.from(structure.directories).some(dir => 
                dir.toLowerCase().includes(pattern.toLowerCase())
            )) {
                structure.patterns.push(pattern);
            }
        });

        this.projectStructure = {
            totalFiles: structure.totalFiles,
            totalDirectories: structure.directories.size,
            maxDepth: structure.maxDepth,
            fileTypes: Object.fromEntries(structure.fileTypes),
            patterns: structure.patterns
        };
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

        // Function and class definitions (for export analysis)
        const defPatterns = [
            /def\s+(\w+)\(/g,
            /class\s+(\w+)[\(:]?/g
        ];

        defPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                relationships.exports.push({
                    type: pattern.source.includes('def') ? 'function' : 'class',
                    name: match[1],
                    line: this.getLineNumber(content, match.index)
                });
            }
        });
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

        // Calculate abstractness (simplified)
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

    generateRecommendations() {
        console.log('💡 Generating recommendations...');
        
        this.recommendations = [];

        // Analyze project types for recommendations
        if (this.projectTypes.size === 0) {
            this.recommendations.push({
                type: 'project_type',
                priority: 'medium',
                message: 'No specific project type detected. Consider adding framework-specific configuration files.'
            });
        }

        // Analyze dependencies
        for (const [depType, depData] of this.dependencies.entries()) {
            if (depData.count > 100) {
                this.recommendations.push({
                    type: 'dependencies',
                    priority: 'medium',
                    message: `Large number of ${depType} dependencies (${depData.count}). Consider dependency audit and cleanup.`
                });
            }
        }

        // Analyze structure
        if (this.projectStructure && this.projectStructure.maxDepth > 8) {
            this.recommendations.push({
                type: 'structure',
                priority: 'low',
                message: `Deep directory structure (${this.projectStructure.maxDepth} levels). Consider flattening for better maintainability.`
            });
        }

        // Analyze coupling
        if (this.codeArchitecture.couplingAnalysis.instability) {
            const highInstabilityFiles = Array.from(this.codeArchitecture.couplingAnalysis.instability.entries())
                .filter(([, instability]) => instability > 0.8).length;
            
            if (highInstabilityFiles > 0) {
                this.recommendations.push({
                    type: 'coupling',
                    priority: 'medium',
                    message: `${highInstabilityFiles} files with high instability. Consider refactoring for better stability.`
                });
            }
        }
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

    findRelatedFiles(filePath, allFiles) {
        const related = [];
        const fileName = filePath.split('/').pop();
        const baseName = fileName.split('.')[0];
        const directory = filePath.substring(0, filePath.lastIndexOf('/'));

        // Find files in the same directory
        const sameDirectoryFiles = allFiles.filter(file => 
            file.path !== filePath && 
            file.path.startsWith(directory) &&
            !file.path.substring(directory.length + 1).includes('/')
        );

        // Find files with similar names
        const similarNameFiles = allFiles.filter(file => {
            const otherFileName = file.path.split('/').pop();
            const otherBaseName = otherFileName.split('.')[0];
            return file.path !== filePath && (
                otherBaseName === baseName ||
                otherBaseName.includes(baseName) ||
                baseName.includes(otherBaseName)
            );
        });

        related.push(...sameDirectoryFiles.map(f => f.path), ...similarNameFiles.map(f => f.path));
        return [...new Set(related)]; // Remove duplicates
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

    async getFileContent(filePath) {
        try {
            const content = await this.fileExplorer.fileManager.getFileContent(filePath);
            return content?.content || null;
        } catch (error) {
            return null;
        }
    }
}