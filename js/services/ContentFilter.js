// js/services/ContentFilter.js (Fixed to properly exclude directories)
export class ContentFilter {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        
        // Only exclude truly unnecessary files - be much more conservative
        this.excludePatterns = [
            // Build and dependency directories (full paths only)
            /^node_modules\//,
            /^\.git\//,
            /^coverage\//,
            /^__pycache__\//,
            /^build\//,
            /^dist\//,
            /^\.next\//,
            /^\.nuxt\//,
            
            // Compiled/generated files only
            /\.pyc$/,
            /\.min\.(js|css)$/,
            /\.map$/,
            /\.d\.ts$/,
            
            // Specific lock files only (not config files)
            /^package-lock\.json$/,
            /^yarn\.lock$/,
            /^Pipfile\.lock$/,
            /^poetry\.lock$/,
            /^composer\.lock$/,
            /^Cargo\.lock$/
        ];
        
        // File priority scoring - INCLUDE EVERYTHING by default with different priorities
        this.priorityRules = {
            core: {
                patterns: [
                    // Entry points and main files
                    /^(index|main|app|server)\.(js|jsx|ts|tsx|py|html)$/,
                    /^package\.json$/,
                    /^README\.md$/i,
                    /^Dockerfile$/,
                    /^docker-compose\.(yml|yaml)$/,
                    /^(manage|setup)\.py$/,
                    /^requirements\.txt$/,
                    /^Cargo\.toml$/,
                    /^go\.mod$/,
                    /^pom\.xml$/,
                    /^build\.gradle$/,
                    // Framework-specific entry points
                    /^gatsby-config\.js$/,
                    /^next\.config\.js$/,
                    /^nuxt\.config\.js$/,
                    /^vue\.config\.js$/,
                    /^angular\.json$/,
                    // Main HTML files
                    /^index\.html$/
                ],
                score: 100
            },
            business: {
                patterns: [
                    // Business logic files
                    /\/(components?|views?|pages?|routes?|controllers?|services?|models?)\//,
                    /\/(api|graphql|schema)\//,
                    /\.(component|service|controller|model)\.(js|ts|py|java|cs|php)$/,
                    // Django specific
                    /(models|views|urls|forms|serializers|admin)\.py$/,
                    // React/Vue components
                    /\.(jsx|tsx|vue)$/,
                    // Backend logic
                    /\/(handlers?|middleware|utils|helpers)\//
                ],
                score: 90
            },
            config: {
                patterns: [
                    // Configuration files
                    /\.(json|yaml|yml|toml|ini|conf|env)$/,
                    /^\.env/,
                    /config/i,
                    /settings/i,
                    /^(webpack|babel|eslint|prettier|jest|cypress)\./,
                    /^(tsconfig|jsconfig)\.json$/,
                    /^\.gitignore$/,
                    /^\.dockerignore$/
                ],
                score: 75
            },
            source: {
                patterns: [
                    // All source code files
                    /\.(js|jsx|ts|tsx|py|java|go|rs|cs|php|rb|swift|kt|dart|scala|clj)$/,
                    /\.(sql|graphql|gql)$/,
                    // Source directories
                    /^(src|lib|app)\//
                ],
                score: 70
            },
            styles: {
                patterns: [
                    // Styling files
                    /\.(css|scss|sass|less|styl)$/,
                    /\/(styles?|css)\//
                ],
                score: 65
            },
            tests: {
                patterns: [
                    // Test files
                    /\.(test|spec)\.(js|jsx|ts|tsx|py|java|cs|php|rb)$/,
                    /\/(tests?|specs?|__tests__|test)\//,
                    /^(jest|cypress|playwright|selenium)\./
                ],
                score: 60
            },
            docs: {
                patterns: [
                    // Documentation
                    /\.(md|txt|rst|adoc)$/,
                    /\/(docs?|documentation)\//,
                    /^(CHANGELOG|LICENSE|CONTRIBUTING|CODE_OF_CONDUCT)/i
                ],
                score: 50
            },
            assets: {
                patterns: [
                    // Static assets
                    /\.(png|jpg|jpeg|gif|svg|ico|webp)$/,
                    /\.(woff|woff2|ttf|eot)$/,
                    /\/(assets|static|public|images|fonts)\//
                ],
                score: 40
            },
            other: {
                patterns: [
                    /.*/  // Match everything else - IMPORTANT: Include all remaining files
                ],
                score: 30
            }
        };
    }

    shouldExcludeFile(filePath) {
        // CRITICAL FIX: Check if this is a directory first
        const item = document.querySelector(`[data-path="${filePath}"]`);
        if (item && item.dataset.type === 'directory') {
            console.log(`🚫 Excluding directory: ${filePath}`);
            return true; // Always exclude directories
        }

        // Get just the filename and relative path for checking
        const fileName = filePath.split('/').pop();
        const relativePath = filePath.replace(this.fileExplorer.currentPath, '').replace(/^\//, '');
        
        console.log(`🔍 Checking exclusion for: ${fileName} (${relativePath})`);
        
        // Just check if it's a valid filename
        if (!fileName || fileName.trim() === '') {
            console.log(`🚫 Excluding - no filename: ${filePath}`);
            return true;
        }

        // Additional check: if filename has no extension and doesn't match known files, likely a directory
        const knownFilesWithoutExtension = ['Dockerfile', 'Makefile', 'README', 'LICENSE', 'CHANGELOG', 'Pipfile', 'Gemfile'];
        if (!fileName.includes('.') && !knownFilesWithoutExtension.some(known => 
            fileName.toLowerCase().includes(known.toLowerCase()))) {
            console.log(`🚫 Excluding - likely directory (no extension): ${fileName}`);
            return true;
        }
        
        // Check against our very specific exclude patterns
        for (const pattern of this.excludePatterns) {
            if (pattern.test(relativePath) || pattern.test(fileName)) {
                console.log(`🚫 Excluding by pattern: ${fileName} matches ${pattern}`);
                return true;
            }
        }
        
        console.log(`✅ Including file: ${fileName}`);
        return false;
    }

    calculateFilePriority(filePath) {
        const fileName = filePath.split('/').pop();
        const relativePath = filePath.replace(this.fileExplorer.currentPath, '').replace(/^\//, '');
        
        console.log(`📊 Calculating priority for: ${fileName}`);
        
        // Make sure it has a filename
        if (!fileName || fileName.trim() === '') {
            return {
                score: 0,
                category: 'invalid',
                reason: 'No filename'
            };
        }
        
        // Check against priority rules in order of importance
        for (const [category, rule] of Object.entries(this.priorityRules)) {
            for (const pattern of rule.patterns) {
                if (pattern.test(relativePath) || pattern.test(fileName)) {
                    console.log(`✅ Priority: ${fileName} -> ${category} (${rule.score})`);
                    return {
                        score: rule.score,
                        category: category,
                        reason: `Matches ${category} pattern: ${pattern.source.slice(0, 50)}...`
                    };
                }
            }
        }
        
        // This should never happen with our "other" catch-all, but just in case
        return {
            score: 20,
            category: 'fallback',
            reason: 'Default fallback priority'
        };
    }

    filterAndPrioritizeFiles(selectedFiles) {
        const filteredFiles = [];
        const excludedFiles = [];
        
        console.log(`🎯 Starting to filter ${selectedFiles.length} selected files...`);
        
        for (const filePath of selectedFiles) {
            console.log(`\n📁 Processing: ${filePath}`);
            
            // SAFETY CHECK: Make sure it's a valid file path
            if (!filePath || typeof filePath !== 'string') {
                console.log(`🚫 Excluding invalid path: ${filePath}`);
                excludedFiles.push({
                    path: filePath,
                    reason: 'Invalid file path'
                });
                continue;
            }
            
            // Check if it should be excluded (including directory check)
            if (this.shouldExcludeFile(filePath)) {
                excludedFiles.push({
                    path: filePath,
                    reason: 'Excluded by filter rules (likely directory or unwanted file)'
                });
                continue;
            }
            
            // Calculate priority
            const priority = this.calculateFilePriority(filePath);
            
            // CHANGED: Only skip truly invalid files, not just low priority ones
            if (priority.category === 'invalid') {
                excludedFiles.push({
                    path: filePath,
                    reason: priority.reason
                });
                continue;
            }
            
            // Include everything else!
            filteredFiles.push({
                path: filePath,
                priority: priority
            });
        }
        
        // Sort by priority (highest first)
        filteredFiles.sort((a, b) => b.priority.score - a.priority.score);
        
        console.log(`\n📊 Filtering complete:`);
        console.log(`✅ Included files (${filteredFiles.length}):`, filteredFiles.map(f => f.path.split('/').pop()));
        console.log(`🚫 Excluded files (${excludedFiles.length}):`, excludedFiles.map(f => f.path.split('/').pop()));
        
        return {
            included: filteredFiles,
            excluded: excludedFiles
        };
    }

    compressBoilerplate(content, filePath) {
        const fileName = filePath.split('/').pop().toLowerCase();
        const extension = fileName.split('.').pop();
        
        // Apply compression based on file type
        if (extension === 'json') {
            return this.compressJson(content);
        } else if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            return this.compressJavaScript(content);
        } else if (extension === 'py') {
            return this.compressPython(content);
        } else if (['css', 'scss', 'sass'].includes(extension)) {
            return this.compressCss(content);
        } else if (extension === 'html') {
            return this.compressHtml(content);
        }
        
        // For other files, just return as-is
        return content;
    }

    compressJson(content) {
        try {
            // Parse and re-stringify with minimal spacing for package.json and other configs
            const parsed = JSON.parse(content);
            
            // For package.json, keep important sections readable
            if (parsed.name || parsed.version || parsed.dependencies) {
                return JSON.stringify(parsed, null, 2);
            }
            
            // For other JSON, compress more aggressively
            return JSON.stringify(parsed, null, 1);
        } catch (error) {
            return content; // Return original if parsing fails
        }
    }

    compressJavaScript(content) {
        const lines = content.split('\n');
        const compressed = [];
        let inLongComment = false;
        
        for (let line of lines) {
            // Remove long comments
            if (line.trim().startsWith('/*')) {
                inLongComment = true;
            }
            if (inLongComment) {
                if (line.includes('*/')) {
                    inLongComment = false;
                }
                continue;
            }
            
            // Remove single-line comments but keep important ones
            if (line.trim().startsWith('//')) {
                const comment = line.trim().toLowerCase();
                if (comment.includes('todo') || comment.includes('fixme') || comment.includes('note') || comment.includes('important')) {
                    compressed.push(line);
                }
                continue;
            }
            
            // Remove empty lines except around functions and classes
            if (line.trim() === '') {
                const lastLine = compressed[compressed.length - 1];
                if (lastLine && (lastLine.includes('function') || lastLine.includes('class') || lastLine.includes('{') || lastLine.includes('}'))) {
                    compressed.push(line);
                }
                continue;
            }
            
            compressed.push(line);
        }
        
        return compressed.join('\n');
    }

    compressPython(content) {
        const lines = content.split('\n');
        const compressed = [];
        let inDocstring = false;
        
        for (let line of lines) {
            const trimmed = line.trim();
            
            // Handle docstrings
            if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
                if (inDocstring || (trimmed.endsWith('"""') || trimmed.endsWith("'''"))) {
                    inDocstring = !inDocstring;
                    // Keep first line of docstring
                    if (!inDocstring) {
                        compressed.push(`    """${trimmed.replace(/['"]{3}/g, '').trim()}"""`);
                    }
                } else {
                    inDocstring = true;
                }
                continue;
            }
            
            if (inDocstring) continue;
            
            // Remove comments except important ones
            if (trimmed.startsWith('#')) {
                const comment = trimmed.toLowerCase();
                if (comment.includes('todo') || comment.includes('fixme') || comment.includes('note') || comment.includes('important')) {
                    compressed.push(line);
                }
                continue;
            }
            
            // Remove excessive empty lines
            if (trimmed === '') {
                const lastLine = compressed[compressed.length - 1];
                if (lastLine && (lastLine.includes('def ') || lastLine.includes('class ') || lastLine.trim() === '')) {
                    continue;
                }
            }
            
            compressed.push(line);
        }
        
        return compressed.join('\n');
    }

    compressCss(content) {
        const lines = content.split('\n');
        const compressed = [];
        
        for (let line of lines) {
            const trimmed = line.trim();
            
            // Remove comments
            if (trimmed.startsWith('/*') || trimmed.startsWith('//')) {
                continue;
            }
            
            // Remove empty lines
            if (trimmed === '') {
                continue;
            }
            
            compressed.push(line);
        }
        
        return compressed.join('\n');
    }

    compressHtml(content) {
        // Remove excessive whitespace and comments but keep structure
        return content
            .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
            .replace(/\n\s*\n/g, '\n') // Remove empty lines
            .replace(/^\s+/gm, '  '); // Normalize indentation
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