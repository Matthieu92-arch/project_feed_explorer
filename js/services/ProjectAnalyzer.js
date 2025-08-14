// js/services/ProjectAnalyzer.js
export class ProjectAnalyzer {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.projectTypes = new Map();
        this.dependencies = new Map();
        this.projectStructure = null;
        this.recommendations = [];
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
            
            // Generate recommendations
            this.generateRecommendations();
            
            const detectedTypes = Array.from(this.projectTypes.keys());
            console.log(`🎯 Detected ${detectedTypes.length} project types:`, detectedTypes);
            
            console.log('✅ Project analysis complete');
            return {
                projectTypes: this.projectTypes,
                dependencies: this.dependencies,
                structure: this.projectStructure,
                recommendations: this.recommendations
            };
        } catch (error) {
            console.error('❌ Error in project analysis:', error);
            return null;
        }
    }

    async getAllProjectFiles() {
        const files = [];
        const selectedFiles = Array.from(this.fileExplorer.selectedFiles);
        
        // Add selected files
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
        // Framework detection patterns
        const detectionPatterns = {
            // JavaScript/Node.js frameworks
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
                    { file: 'vue.config.js' },
                    { content: ['import Vue', 'createApp'] }
                ],
                subTypes: ['nuxt.js', 'quasar', 'vue-cli']
            },
            angular: {
                patterns: [
                    { file: 'angular.json' },
                    { file: 'package.json', content: ['@angular'] },
                    { extension: '.component.ts' },
                    { content: ['@Component', '@Injectable', '@NgModule'] }
                ],
                subTypes: ['angular-cli', 'ionic']
            },
            nodejs: {
                patterns: [
                    { file: 'package.json' },
                    { file: 'server.js' },
                    { file: 'app.js' },
                    { file: 'index.js' },
                    { content: ['require(', 'module.exports', 'const express'] }
                ],
                subTypes: ['express', 'koa', 'fastify', 'nestjs']
            },
            
            // Python frameworks
            python: {
                patterns: [
                    { extension: '.py' },
                    { file: 'requirements.txt' },
                    { file: 'setup.py' },
                    { file: 'pyproject.toml' },
                    { file: '__init__.py' }
                ],
                subTypes: ['django', 'flask', 'fastapi', 'streamlit']
            },
            django: {
                patterns: [
                    { file: 'manage.py' },
                    { file: 'settings.py' },
                    { file: 'urls.py' },
                    { content: ['from django', 'import django'] }
                ]
            },
            flask: {
                patterns: [
                    { content: ['from flask', 'Flask(__name__)'] },
                    { file: 'app.py', content: ['Flask'] }
                ]
            },
            fastapi: {
                patterns: [
                    { content: ['from fastapi', 'FastAPI()'] }
                ]
            },
            
            // Mobile frameworks
            'react-native': {
                patterns: [
                    { file: 'package.json', content: ['react-native'] },
                    { file: 'metro.config.js' },
                    { content: ['react-native'] }
                ]
            },
            flutter: {
                patterns: [
                    { file: 'pubspec.yaml' },
                    { extension: '.dart' },
                    { content: ['import "package:flutter'] }
                ]
            },
            ionic: {
                patterns: [
                    { file: 'ionic.config.json' },
                    { file: 'capacitor.config.ts' }
                ]
            },
            
            // Other frameworks
            go: {
                patterns: [
                    { file: 'go.mod' },
                    { extension: '.go' },
                    { content: ['package main', 'import ('] }
                ],
                subTypes: ['gin', 'echo', 'fiber']
            },
            rust: {
                patterns: [
                    { file: 'Cargo.toml' },
                    { extension: '.rs' },
                    { content: ['fn main()', 'use std::'] }
                ]
            },
            java: {
                patterns: [
                    { file: 'pom.xml' },
                    { file: 'build.gradle' },
                    { extension: '.java' },
                    { content: ['public class', 'import java.'] }
                ],
                subTypes: ['spring-boot', 'maven', 'gradle']
            },
            csharp: {
                patterns: [
                    { extension: '.cs' },
                    { file: '*.csproj' },
                    { content: ['using System', 'namespace'] }
                ],
                subTypes: ['asp.net', 'blazor', 'xamarin']
            },
            php: {
                patterns: [
                    { extension: '.php' },
                    { file: 'composer.json' },
                    { content: ['<?php'] }
                ],
                subTypes: ['laravel', 'symfony', 'wordpress']
            },
            
            // Static site generators
            gatsby: {
                patterns: [
                    { file: 'gatsby-config.js' },
                    { file: 'package.json', content: ['gatsby'] }
                ]
            },
            nextjs: {
                patterns: [
                    { file: 'next.config.js' },
                    { file: 'package.json', content: ['next'] },
                    { directory: 'pages' }
                ]
            },
            nuxtjs: {
                patterns: [
                    { file: 'nuxt.config.js' },
                    { file: 'package.json', content: ['nuxt'] }
                ]
            }
        };

        // Analyze each project type
        for (const [projectType, config] of Object.entries(detectionPatterns)) {
            const score = await this.calculateProjectTypeScore(projectType, config, files);
            
            if (score.confidence > 30) { // 30% threshold
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
        let confidence = 0;
        const indicators = [];
        const mainFiles = [];
        const maxScore = config.patterns.length * 100;

        for (const pattern of config.patterns) {
            const result = await this.checkPattern(pattern, files);
            if (result.matched) {
                confidence += result.weight;
                indicators.push(result.indicator);
                if (result.file) {
                    mainFiles.push(result.file);
                }
            }
        }

        // Normalize confidence to percentage
        confidence = Math.min(100, (confidence / maxScore) * 100);

        return {
            confidence: Math.round(confidence),
            indicators,
            mainFiles
        };
    }

    async checkPattern(pattern, files) {
        if (pattern.file) {
            // Check for specific file
            const file = files.find(f => 
                f.name === pattern.file || 
                f.relativePath === pattern.file ||
                f.path.endsWith(pattern.file)
            );
            
            if (file) {
                if (pattern.content) {
                    // Check file content
                    const content = await this.getFileContent(file.path);
                    if (content && this.contentContains(content, pattern.content)) {
                        return {
                            matched: true,
                            weight: 100,
                            indicator: `${pattern.file} with required content`,
                            file: file.relativePath
                        };
                    }
                } else {
                    return {
                        matched: true,
                        weight: 80,
                        indicator: `Contains ${pattern.file}`,
                        file: file.relativePath
                    };
                }
            }
        }

        if (pattern.extension) {
            // Check for file extensions
            const matchingFiles = files.filter(f => f.name.endsWith(pattern.extension));
            if (matchingFiles.length > 0) {
                return {
                    matched: true,
                    weight: 60 + Math.min(40, matchingFiles.length * 10),
                    indicator: `${matchingFiles.length} ${pattern.extension} files`,
                    file: matchingFiles[0].relativePath
                };
            }
        }

        if (pattern.directory) {
            // Check for directory existence
            const hasDirectory = files.some(f => f.relativePath.includes(pattern.directory + '/'));
            if (hasDirectory) {
                return {
                    matched: true,
                    weight: 40,
                    indicator: `Contains ${pattern.directory}/ directory`
                };
            }
        }

        if (pattern.content) {
            // Check content across all text files
            for (const file of files) {
                if (this.isTextFile(file.name)) {
                    const content = await this.getFileContent(file.path);
                    if (content && this.contentContains(content, pattern.content)) {
                        return {
                            matched: true,
                            weight: 50,
                            indicator: `Code patterns in ${file.name}`,
                            file: file.relativePath
                        };
                    }
                }
            }
        }

        return { matched: false, weight: 0 };
    }

    async detectSubType(projectType, config, files) {
        if (!config.subTypes) return null;

        for (const subType of config.subTypes) {
            const score = await this.calculateSubTypeScore(subType, files);
            if (score.confidence > 50) {
                return {
                    name: subType,
                    confidence: score.confidence,
                    indicators: score.indicators
                };
            }
        }

        return null;
    }

    async calculateSubTypeScore(subType, files) {
        const patterns = this.getSubTypePatterns(subType);
        let confidence = 0;
        const indicators = [];

        for (const pattern of patterns) {
            const result = await this.checkPattern(pattern, files);
            if (result.matched) {
                confidence += result.weight;
                indicators.push(result.indicator);
            }
        }

        return {
            confidence: Math.min(100, confidence),
            indicators
        };
    }

    getSubTypePatterns(subType) {
        const subTypePatterns = {
            'next.js': [
                { file: 'next.config.js' },
                { file: 'package.json', content: ['next'] },
                { directory: 'pages' }
            ],
            'create-react-app': [
                { file: 'package.json', content: ['react-scripts'] },
                { file: 'public/index.html' }
            ],
            'gatsby': [
                { file: 'gatsby-config.js' },
                { file: 'package.json', content: ['gatsby'] }
            ],
            'express': [
                { file: 'package.json', content: ['express'] },
                { content: ['const express', 'require("express")'] }
            ],
            'django': [
                { file: 'manage.py' },
                { file: 'settings.py' },
                { content: ['from django'] }
            ],
            'flask': [
                { content: ['from flask', 'Flask(__name__)'] }
            ],
            'spring-boot': [
                { file: 'pom.xml', content: ['spring-boot'] },
                { content: ['@SpringBootApplication'] }
            ]
        };

        return subTypePatterns[subType] || [];
    }

    async analyzeDependencies(files) {
        // Analyze different types of dependency files
        const dependencyFiles = [
            { name: 'package.json', type: 'npm', parser: this.parsePackageJson },
            { name: 'requirements.txt', type: 'pip', parser: this.parseRequirementsTxt },
            { name: 'Cargo.toml', type: 'cargo', parser: this.parseCargoToml },
            { name: 'go.mod', type: 'go', parser: this.parseGoMod },
            { name: 'pom.xml', type: 'maven', parser: this.parsePomXml },
            { name: 'composer.json', type: 'composer', parser: this.parseComposerJson }
        ];

        for (const depFile of dependencyFiles) {
            const file = files.find(f => f.name === depFile.name);
            if (file) {
                const content = await this.getFileContent(file.path);
                if (content) {
                    const deps = await depFile.parser.call(this, content);
                    if (deps && deps.length > 0) {
                        this.dependencies.set(depFile.type, {
                            file: file.relativePath,
                            dependencies: deps,
                            count: deps.length
                        });
                    }
                }
            }
        }
    }

    async parsePackageJson(content) {
        try {
            const pkg = JSON.parse(content);
            const deps = [];
            
            // Extract dependencies
            if (pkg.dependencies) {
                for (const [name, version] of Object.entries(pkg.dependencies)) {
                    deps.push({ name, version, type: 'production' });
                }
            }
            
            if (pkg.devDependencies) {
                for (const [name, version] of Object.entries(pkg.devDependencies)) {
                    deps.push({ name, version, type: 'development' });
                }
            }
            
            return deps;
        } catch (error) {
            console.warn('Error parsing package.json:', error);
            return [];
        }
    }

    async parseRequirementsTxt(content) {
        const deps = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^([a-zA-Z0-9\-_.]+)([>=<~!]+.*)?$/);
                if (match) {
                    deps.push({
                        name: match[1],
                        version: match[2] || '',
                        type: 'production'
                    });
                }
            }
        }
        
        return deps;
    }

    async parseCargoToml(content) {
        const deps = [];
        try {
            // Simple TOML parsing for dependencies section
            const lines = content.split('\n');
            let inDependencies = false;
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed === '[dependencies]') {
                    inDependencies = true;
                    continue;
                }
                if (trimmed.startsWith('[') && trimmed !== '[dependencies]') {
                    inDependencies = false;
                    continue;
                }
                if (inDependencies && trimmed && !trimmed.startsWith('#')) {
                    const match = trimmed.match(/^([^=]+)=(.+)$/);
                    if (match) {
                        deps.push({
                            name: match[1].trim(),
                            version: match[2].trim().replace(/"/g, ''),
                            type: 'production'
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('Error parsing Cargo.toml:', error);
        }
        
        return deps;
    }

    async parseGoMod(content) {
        const deps = [];
        const lines = content.split('\n');
        let inRequire = false;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('require')) {
                inRequire = true;
                continue;
            }
            if (trimmed === ')') {
                inRequire = false;
                continue;
            }
            if (inRequire && trimmed && !trimmed.startsWith('//')) {
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2) {
                    deps.push({
                        name: parts[0],
                        version: parts[1],
                        type: 'production'
                    });
                }
            }
        }
        
        return deps;
    }

    async parsePomXml(content) {
        const deps = [];
        // Simple XML parsing for Maven dependencies
        const dependencyRegex = /<dependency>[\s\S]*?<groupId>(.*?)<\/groupId>[\s\S]*?<artifactId>(.*?)<\/artifactId>[\s\S]*?<version>(.*?)<\/version>[\s\S]*?<\/dependency>/g;
        
        let match;
        while ((match = dependencyRegex.exec(content)) !== null) {
            deps.push({
                name: `${match[1]}:${match[2]}`,
                version: match[3],
                type: 'production'
            });
        }
        
        return deps;
    }

    async parseComposerJson(content) {
        try {
            const composer = JSON.parse(content);
            const deps = [];
            
            if (composer.require) {
                for (const [name, version] of Object.entries(composer.require)) {
                    deps.push({ name, version, type: 'production' });
                }
            }
            
            if (composer['require-dev']) {
                for (const [name, version] of Object.entries(composer['require-dev'])) {
                    deps.push({ name, version, type: 'development' });
                }
            }
            
            return deps;
        } catch (error) {
            console.warn('Error parsing composer.json:', error);
            return [];
        }
    }

    analyzeProjectStructure(files) {
        const structure = {
            totalFiles: files.length,
            maxDepth: 0,
            directories: new Set(),
            patterns: [],
            mainDirectories: []
        };

        // Calculate directory depth and collect directories
        for (const file of files) {
            const parts = file.relativePath.split('/');
            structure.maxDepth = Math.max(structure.maxDepth, parts.length);
            
            // Add each directory level
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
                currentPath += (currentPath ? '/' : '') + parts[i];
                structure.directories.add(currentPath);
            }
        }

        // Analyze directory patterns
        const directoryCounts = new Map();
        for (const file of files) {
            const dir = file.relativePath.split('/')[0];
            if (dir) {
                directoryCounts.set(dir, (directoryCounts.get(dir) || 0) + 1);
            }
        }

        // Identify main directories
        for (const [dir, count] of directoryCounts.entries()) {
            if (count >= 2) { // Only directories with multiple files
                structure.mainDirectories.push({
                    path: dir,
                    fileCount: count,
                    type: this.classifyDirectory(dir)
                });
            }
        }

        // Detect architectural patterns
        const directories = Array.from(structure.directories);
        if (directories.includes('src') || directories.includes('lib')) {
            structure.patterns.push('Source-centric architecture');
        }
        if (directories.includes('components') || directories.includes('pages')) {
            structure.patterns.push('Component-based architecture');
        }
        if (directories.includes('controllers') || directories.includes('models') || directories.includes('views')) {
            structure.patterns.push('MVC pattern');
        }
        if (directories.includes('services') || directories.includes('api')) {
            structure.patterns.push('Service-oriented architecture');
        }
        if (directories.includes('tests') || directories.includes('test')) {
            structure.patterns.push('Test-driven development');
        }

        this.projectStructure = structure;
    }

    classifyDirectory(dirName) {
        const classifications = {
            'src': 'source',
            'lib': 'library',
            'components': 'ui',
            'pages': 'ui',
            'views': 'ui',
            'controllers': 'logic',
            'models': 'data',
            'services': 'logic',
            'api': 'api',
            'tests': 'testing',
            'test': 'testing',
            'docs': 'documentation',
            'config': 'configuration',
            'public': 'assets',
            'assets': 'assets',
            'static': 'assets'
        };

        return classifications[dirName.toLowerCase()] || 'other';
    }

    generateRecommendations() {
        this.recommendations = [];

        // Security recommendations
        if (this.dependencies.has('npm')) {
            const npmDeps = this.dependencies.get('npm').dependencies;
            const outdatedCount = npmDeps.filter(dep => dep.version.includes('^') || dep.version.includes('~')).length;
            
            if (outdatedCount > npmDeps.length * 0.5) {
                this.recommendations.push({
                    type: 'security',
                    priority: 'high',
                    message: 'Consider updating dependencies - many use flexible version ranges'
                });
            }
        }

        // Performance recommendations
        if (this.projectTypes.has('react') && this.dependencies.has('npm')) {
            const deps = this.dependencies.get('npm').dependencies;
            const hasLargeLibraries = deps.some(dep => 
                ['lodash', 'moment', 'antd'].includes(dep.name)
            );
            
            if (hasLargeLibraries) {
                this.recommendations.push({
                    type: 'performance',
                    priority: 'medium',
                    message: 'Consider tree-shaking or alternatives for large libraries like Lodash/Moment'
                });
            }
        }

        // Architecture recommendations
        if (this.projectStructure.maxDepth > 6) {
            this.recommendations.push({
                type: 'architecture',
                priority: 'medium',
                message: 'Deep directory nesting detected - consider flattening structure'
            });
        }

        if (!this.projectStructure.patterns.includes('Test-driven development')) {
            this.recommendations.push({
                type: 'quality',
                priority: 'high',
                message: 'No test directory found - consider adding automated tests'
            });
        }

        // Technology-specific recommendations
        if (this.projectTypes.has('nodejs') && !this.dependencies.has('npm')) {
            this.recommendations.push({
                type: 'configuration',
                priority: 'medium',
                message: 'Node.js project without package.json - consider adding dependency management'
            });
        }
    }

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

        return {
            projectTypes,
            dependencies,
            structure: this.projectStructure,
            recommendations: this.recommendations
        };
    }

    // Utility methods
    async getFileContent(filePath) {
        try {
            const content = await this.fileExplorer.fileManager.getFileContent(filePath);
            return content?.content || null;
        } catch (error) {
            return null;
        }
    }

    contentContains(content, patterns) {
        if (typeof patterns === 'string') {
            return content.includes(patterns);
        }
        
        return patterns.some(pattern => content.includes(pattern));
    }

    isTextFile(fileName) {
        const textExtensions = [
            '.js', '.jsx', '.ts', '.tsx', '.vue', '.py', '.java', '.cs', '.php',
            '.go', '.rs', '.rb', '.swift', '.kt', '.dart', '.html', '.css', '.scss',
            '.json', '.xml', '.yaml', '.yml', '.toml', '.md', '.txt', '.env'
        ];
        
        return textExtensions.some(ext => fileName.endsWith(ext));
    }
}