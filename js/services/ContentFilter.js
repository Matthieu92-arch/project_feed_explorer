// js/services/ContentFilter.js
export class ContentFilter {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        
        // Boilerplate patterns to remove or compress
        this.boilerplatePatterns = {
            // Common auto-generated file headers
            headers: [
                /^\/\*\*?\s*\n\s*\*\s*Auto-generated.*?\*\/\s*\n/s,
                /^\/\/\s*This file was automatically generated.*?\n/gm,
                /^#\s*This file was automatically generated.*?\n/gm,
                /^<!--\s*This file was automatically generated.*?-->\s*\n/gm,
                /^\/\*\s*eslint-disable.*?\*\/\s*\n/gm,
                /^\/\*\s*prettier-ignore.*?\*\/\s*\n/gm
            ],
            
            // Package manager lock file content
            lockFiles: [
                /^yarn\.lock$/,
                /^package-lock\.json$/,
                /^Pipfile\.lock$/,
                /^poetry\.lock$/,
                /^composer\.lock$/
            ],
            
            // Build and dist directories content
            buildDirs: [
                /^build\//,
                /^dist\//,
                /^\.next\//,
                /^out\//,
                /^public\/build\//,
                /^static\/build\//
            ],
            
            // Common boilerplate code blocks
            codeBlocks: [
                // React boilerplate
                /import React.*?from ['"]react['"];\s*\n/g,
                /export default.*?;\s*$/gm,
                
                // ESLint comments
                /\/\*\s*eslint.*?\*\/\s*\n/g,
                /\/\/\s*eslint-disable.*?\n/g,
                
                // Prettier comments
                /\/\*\s*prettier-ignore.*?\*\/\s*\n/g,
                
                // TypeScript triple-slash directives
                /\/\/\/\s*<reference.*?\/>\s*\n/g,
                
                // Common copyright headers
                /\/\*\*?\s*\n(\s*\*.*?copyright.*?\n)+\s*\*\/\s*\n/gim,
                
                // Webpack/build tool comments
                /\/\*\*?\s*webpack.*?\*\/\s*\n/gi,
                /\/\*\*?\s*@generated.*?\*\/\s*\n/gi
            ]
        };
        
        // File priority scoring system
        this.priorityRules = {
            // Core files (highest priority)
            core: {
                patterns: [
                    /^(src\/)?index\.(js|jsx|ts|tsx|py)$/,
                    /^(src\/)?main\.(js|jsx|ts|tsx|py)$/,
                    /^(src\/)?app\.(js|jsx|ts|tsx|py)$/,
                    /^server\.(js|ts|py)$/,
                    /^manage\.py$/,
                    /^settings\.py$/,
                    /^config\.(js|ts|json|py)$/,
                    /^package\.json$/,
                    /^requirements\.txt$/,
                    /^Dockerfile$/,
                    /^docker-compose\.ya?ml$/
                ],
                score: 100
            },
            
            // Business logic (high priority)
            business: {
                patterns: [
                    /^(src\/)?.*\/(models|views|controllers|services|api)\//,
                    /^(src\/)?.*\/(components|pages|screens)\//,
                    /^(src\/)?.*\/utils\//,
                    /^(src\/)?.*\/helpers\//,
                    /.*\/(models|views|controllers|services)\.py$/,
                    /.*\.service\.(js|ts)$/,
                    /.*\.controller\.(js|ts)$/,
                    /.*\.model\.(js|ts)$/
                ],
                score: 80
            },
            
            // Configuration (medium-high priority)
            config: {
                patterns: [
                    /^\.env/,
                    /.*config.*\.(js|ts|json|yaml|yml)$/,
                    /^tsconfig\.json$/,
                    /^webpack\.config\.(js|ts)$/,
                    /^babel\.config\.(js|json)$/,
                    /^\.eslintrc/,
                    /^\.prettierrc/,
                    /^jest\.config\.(js|ts)$/
                ],
                score: 60
            },
            
            // Documentation (medium priority)
            docs: {
                patterns: [
                    /^README\.md$/,
                    /^CHANGELOG\.md$/,
                    /^CONTRIBUTING\.md$/,
                    /^docs\//,
                    /.*\.md$/
                ],
                score: 40
            },
            
            // Tests (lower priority, but still important)
            tests: {
                patterns: [
                    /.*\.(test|spec)\.(js|jsx|ts|tsx|py)$/,
                    /^tests?\//,
                    /^__tests__\//,
                    /.*_test\.py$/,
                    /.*test_.*\.py$/
                ],
                score: 30
            },
            
            // Static assets (low priority)
            assets: {
                patterns: [
                    /^public\//,
                    /^static\//,
                    /^assets\//,
                    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
                    /\.(css|scss|sass|less)$/
                ],
                score: 20
            },
            
            // Build/generated files (lowest priority)
            generated: {
                patterns: [
                    /^node_modules\//,
                    /^build\//,
                    /^dist\//,
                    /^\.next\//,
                    /^coverage\//,
                    /.*\.min\.(js|css)$/,
                    /.*\.bundle\.(js|css)$/,
                    /.*\.chunk\.(js|css)$/,
                    /^yarn\.lock$/,
                    /^package-lock\.json$/,
                    /.*\.pyc$/,
                    /^__pycache__\//
                ],
                score: 0
            }
        };
    }

    shouldExcludeFile(filePath) {
        // Check if file should be completely excluded
        const fileName = filePath.split('/').pop();
        const relativePath = filePath.replace(this.fileExplorer.currentPath, '').replace(/^\//, '');
        
        // Exclude lock files
        for (const pattern of this.boilerplatePatterns.lockFiles) {
            if (pattern.test(fileName) || pattern.test(relativePath)) {
                return true;
            }
        }
        
        // Exclude build directories
        for (const pattern of this.boilerplatePatterns.buildDirs) {
            if (pattern.test(relativePath)) {
                return true;
            }
        }
        
        // Exclude generated files with score 0
        for (const pattern of this.priorityRules.generated.patterns) {
            if (pattern.test(relativePath) || pattern.test(fileName)) {
                return true;
            }
        }
        
        return false;
    }

    calculateFilePriority(filePath) {
        const fileName = filePath.split('/').pop();
        const relativePath = filePath.replace(this.fileExplorer.currentPath, '').replace(/^\//, '');
        
        // Check against priority rules
        for (const [category, rule] of Object.entries(this.priorityRules)) {
            if (category === 'generated') continue; // Already handled in shouldExcludeFile
            
            for (const pattern of rule.patterns) {
                if (pattern.test(relativePath) || pattern.test(fileName)) {
                    return {
                        score: rule.score,
                        category: category,
                        reason: `Matches ${category} pattern: ${pattern.source}`
                    };
                }
            }
        }
        
        return {
            score: 10, // Default score for unmatched files
            category: 'other',
            reason: 'Default priority'
        };
    }

    compressBoilerplate(content, filePath) {
        let compressed = content;
        const fileName = filePath.split('/').pop();
        
        // Remove common headers
        for (const pattern of this.boilerplatePatterns.headers) {
            compressed = compressed.replace(pattern, '');
        }
        
        // Remove common code blocks
        for (const pattern of this.boilerplatePatterns.codeBlocks) {
            compressed = compressed.replace(pattern, '');
        }
        
        // File-specific compression
        if (fileName === 'package.json') {
            compressed = this.compressPackageJson(compressed);
        } else if (fileName.endsWith('.css') || fileName.endsWith('.scss')) {
            compressed = this.compressCss(compressed);
        } else if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
            compressed = this.compressJavaScript(compressed);
        }
        
        return compressed;
    }

    compressPackageJson(content) {
        try {
            const pkg = JSON.parse(content);
            
            // Keep only essential fields
            const essential = {
                name: pkg.name,
                version: pkg.version,
                description: pkg.description,
                main: pkg.main,
                scripts: pkg.scripts,
                dependencies: pkg.dependencies,
                devDependencies: Object.keys(pkg.devDependencies || {}).length > 10 
                    ? '... ' + Object.keys(pkg.devDependencies).length + ' dev dependencies'
                    : pkg.devDependencies
            };
            
            return JSON.stringify(essential, null, 2);
        } catch (error) {
            return content;
        }
    }

    compressCss(content) {
        // Remove excessive whitespace and comments while keeping structure readable
        return content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
            .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple empty lines
            .trim();
    }

    compressJavaScript(content) {
        // Remove excessive imports and comments while keeping code readable
        return content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .replace(/\/\/.*$/gm, '') // Remove line comments
            .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple empty lines
            .trim();
    }

    filterAndPrioritizeFiles(selectedFiles) {
        const filteredFiles = [];
        const excludedFiles = [];
        
        for (const filePath of selectedFiles) {
            if (this.shouldExcludeFile(filePath)) {
                excludedFiles.push({
                    path: filePath,
                    reason: 'Excluded as boilerplate/generated file'
                });
                continue;
            }
            
            const priority = this.calculateFilePriority(filePath);
            filteredFiles.push({
                path: filePath,
                priority: priority
            });
        }
        
        // Sort by priority (highest first)
        filteredFiles.sort((a, b) => b.priority.score - a.priority.score);
        
        return {
            included: filteredFiles,
            excluded: excludedFiles
        };
    }

    generateFilteringSummary(filterResult) {
        const summary = {
            totalOriginal: filterResult.included.length + filterResult.excluded.length,
            totalIncluded: filterResult.included.length,
            totalExcluded: filterResult.excluded.length,
            categories: {}
        };
        
        // Group by category
        for (const file of filterResult.included) {
            const category = file.priority.category;
            if (!summary.categories[category]) {
                summary.categories[category] = [];
            }
            summary.categories[category].push(file);
        }
        
        return summary;
    }
}