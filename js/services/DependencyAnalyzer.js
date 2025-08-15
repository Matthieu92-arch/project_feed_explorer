// js/services/DependencyAnalyzer.js (Fixed to skip NPM packages)
export class DependencyAnalyzer {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
    }

    async analyzeFileDependencies(file) {
        try {
            const content = await this.fileExplorer.fileManager.getFileContent(file.path);
            if (!content || content.isBinary) return;

            const dependencies = this.parseDependencies(content.content, file.path);
            if (dependencies.length === 0) return;

            this.fileExplorer.fileDependencies.set(file.path, new Set());

            for (const dep of dependencies) {
                // FIXED: Skip NPM packages - only process local/relative imports
                if (this.isNpmPackage(dep.relativePath)) {
                    console.log(`📦 Skipping NPM package: ${dep.relativePath}`);
                    continue;
                }

                const resolvedPaths = await this.resolvePath(file.path, dep);
                resolvedPaths.forEach(depPath => {
                    this.fileExplorer.fileDependencies.get(file.path).add(depPath);

                    if (!this.fileExplorer.dependencyOwners.has(depPath)) {
                        this.fileExplorer.dependencyOwners.set(depPath, new Set());
                    }
                    this.fileExplorer.dependencyOwners.get(depPath).add(file.path);

                    if (!this.fileExplorer.selectedFiles.has(depPath)) {
                        this.fileExplorer.selectedFiles.add(depPath);
                        this.addDependencyIndicator(depPath, file.path);
                    }
                });
            }

            this.fileExplorer.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error analyzing dependencies:', error);
        }
    }

    // NEW: Method to identify NPM packages vs local imports
    isNpmPackage(importPath) {
        // Local imports start with ./ or ../
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            return false;
        }
        
        // Absolute paths starting with / are usually local
        if (importPath.startsWith('/')) {
            return false;
        }
        
        // Everything else is considered an NPM package
        // This includes: 'react', 'react-router-dom', 'lucide-react', '@babel/core', etc.
        return true;
    }

    addDependencyIndicator(depPath, ownerPath) {
        // Find the file item in the DOM and add dependency indicator
        const item = document.querySelector(`[data-path="${depPath}"]`);
        if (item) {
            // Check if dependency indicator already exists
            let indicator = item.querySelector('.dependency-indicator');
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'dependency-indicator';
                indicator.textContent = 'AUTO';
                indicator.title = `Automatically included as dependency of ${ownerPath.split('/').pop()}`;
                
                // Add to the end of the file item
                item.appendChild(indicator);
            }
        }
    }

    async removeDependencies(filePath) {
        const dependencies = this.fileExplorer.fileDependencies.get(filePath);
        if (dependencies) {
            for (const depPath of dependencies) {
                // Remove from dependency owners
                const owners = this.fileExplorer.dependencyOwners.get(depPath);
                if (owners) {
                    owners.delete(filePath);
                    
                    // If no more owners, remove from selected files and remove indicator
                    if (owners.size === 0) {
                        this.fileExplorer.selectedFiles.delete(depPath);
                        this.removeDependencyIndicator(depPath);
                        this.fileExplorer.dependencyOwners.delete(depPath);
                    }
                }
            }
            
            // Clear dependencies for this file
            this.fileExplorer.fileDependencies.delete(filePath);
        }
    }

    removeDependencyIndicator(depPath) {
        const item = document.querySelector(`[data-path="${depPath}"]`);
        if (item) {
            const indicator = item.querySelector('.dependency-indicator');
            if (indicator) {
                indicator.remove();
            }
        }
    }

    parseDependencies(content, filePath) {
        const dependencies = [];
        const regexes = [
            // ES Module imports
            /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
            /import\s+['"]([^'"]+)['"]/g,
            // Dynamic imports
            /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            // CommonJS require
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            // Assignment with require
            /const\s+{([^}]+)}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
        ];

        regexes.forEach((regex, regexIndex) => {
            let match;
            let importedNames = [];
            let relativePath;

            while ((match = regex.exec(content)) !== null) {
                if (regexIndex === 0) {
                    importedNames = match[1].split(',').map(name => name.trim());
                    relativePath = match[2];
                } else if (regexIndex === 1) {
                    importedNames = [match[1]];
                    relativePath = match[2];
                } else if (regexIndex === 2 || regexIndex === 3 || regexIndex === 4) {
                    relativePath = match[1];
                    importedNames = [];
                } else if (regexIndex === 5) {
                    importedNames = [match[1]];
                    relativePath = match[2];
                }

                dependencies.push({
                    relativePath,
                    importedNames,
                    originalStatement: match[0]
                });
            }
            regex.lastIndex = 0;
        });

        return dependencies;
    }

    async resolvePath(currentPath, dependencyInfo) {
        try {
            const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
            const { relativePath, importedNames } = dependencyInfo;

            // FIXED: Only process local imports
            if (this.isNpmPackage(relativePath)) {
                console.log(`📦 Skipping NPM package resolution: ${relativePath}`);
                return [];
            }

            let resolvedPath;

            if (relativePath.startsWith('./')) {
                resolvedPath = currentDir + '/' + relativePath.substring(2);
            } else if (relativePath.startsWith('../')) {
                let pathParts = currentDir.split('/');
                let relativeParts = relativePath.split('/');

                for (let part of relativeParts) {
                    if (part === '..') {
                        pathParts.pop();
                    } else if (part !== '.') {
                        pathParts.push(part);
                    }
                }
                resolvedPath = pathParts.join('/');
            } else if (relativePath.startsWith('/')) {
                // Absolute local path
                resolvedPath = relativePath;
            } else {
                // This shouldn't happen since we filter NPM packages above
                console.log(`⚠️ Unexpected import path format: ${relativePath}`);
                return [];
            }

            const resolvedPaths = new Set();

            // Check if file exists as-is
            let foundPath = await this.checkFileExists(resolvedPath);
            if (foundPath) {
                resolvedPaths.add(foundPath);
            }

            // Try with common extensions if no extension provided
            if (this.hasNoExtension(relativePath)) {
                const extensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];

                // First, try the path as a file with extensions
                for (const ext of extensions) {
                    const pathWithExt = resolvedPath + ext;
                    foundPath = await this.checkFileExists(pathWithExt);
                    if (foundPath) {
                        resolvedPaths.add(foundPath);
                    }
                }

                // Then, try as a directory with index files
                for (const ext of extensions) {
                    const indexPath = resolvedPath + '/index' + ext;
                    foundPath = await this.checkFileExists(indexPath);
                    if (foundPath) {
                        resolvedPaths.add(foundPath);
                    }
                }

                // NEW: If it's a directory, also try to find all files in that directory
                // This handles cases like '../components/reports' where there might be multiple component files
                try {
                    const directoryFiles = await this.findFilesInDirectory(resolvedPath);
                    for (const dirFile of directoryFiles) {
                        resolvedPaths.add(dirFile);
                    }
                } catch (error) {
                    // Directory doesn't exist or can't be read, that's okay
                }
            }

            if (resolvedPaths.size > 0) {
                console.log(`✅ Resolved local dependency: ${relativePath} -> [${Array.from(resolvedPaths).map(p => p.split('/').pop()).join(', ')}]`);
            } else {
                console.log(`⚠️ Could not resolve local dependency: ${relativePath}`);
            }

            return Array.from(resolvedPaths);
        } catch (error) {
            console.error('❌ Error resolving path:', error);
            return [];
        }
    }

    async checkFileExists(testPath) {
        return await this.fileExplorer.fileManager.checkFileExists(testPath) ? testPath : null;
    }

    // NEW: Method to find component files in a directory (for imports like '../components/reports')
    async findFilesInDirectory(directoryPath) {
        const foundFiles = [];
        
        try {
            // Use the file manager to check if this is a directory and get its contents
            const isDirectory = await this.fileExplorer.fileManager.directoryExists(directoryPath);
            if (!isDirectory) {
                return foundFiles;
            }

            // Get directory contents via the API
            const pathWithoutLeadingSlash = directoryPath.startsWith('/') ? directoryPath.substring(1) : directoryPath;
            const pathSegments = pathWithoutLeadingSlash.split('/');
            const encodedSegments = pathSegments.map(segment => encodeURIComponent(segment));
            const encodedPath = encodedSegments.join('/');
            
            console.log(`🔍 Checking directory for components: ${directoryPath}`);
            
            const response = await fetch(`/api/directory/${encodedPath}`);
            if (!response.ok) {
                return foundFiles;
            }
            
            const files = await response.json();
            
            // Filter for relevant component files
            const componentExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
            const componentFiles = files.filter(file => 
                file.type === 'file' && 
                componentExtensions.some(ext => file.name.endsWith(ext)) &&
                !file.name.includes('.test.') &&
                !file.name.includes('.spec.')
            );

            for (const file of componentFiles) {
                foundFiles.push(file.path);
                console.log(`📁 Found component file: ${file.name}`);
            }

            // Also check for index file that might export multiple components
            const indexFiles = files.filter(file => 
                file.type === 'file' && 
                file.name.startsWith('index.') &&
                componentExtensions.some(ext => file.name.endsWith(ext))
            );

            for (const indexFile of indexFiles) {
                foundFiles.push(indexFile.path);
                console.log(`📇 Found index file: ${indexFile.name}`);
            }

        } catch (error) {
            console.log(`⚠️ Could not read directory ${directoryPath}: ${error.message}`);
        }

        return foundFiles;
    }

    hasNoExtension(str) {
        const lastSlash = str.lastIndexOf('/');
        const lastDot = str.lastIndexOf('.');
        return lastDot === -1 || lastDot < lastSlash;
    }
}