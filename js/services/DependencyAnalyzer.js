// js/services/DependencyAnalyzer.js (Add missing method)
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

    // ADDED: Missing method
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

    // ADDED: Method to remove dependencies
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

    // ADDED: Method to remove dependency indicators
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
            } else {
                resolvedPath = currentDir + '/' + relativePath;
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

                for (const ext of extensions) {
                    const pathWithExt = resolvedPath + ext;
                    foundPath = await this.checkFileExists(pathWithExt);
                    if (foundPath) {
                        resolvedPaths.add(foundPath);
                    }
                }

                // Try index files
                for (const ext of extensions) {
                    const indexPath = resolvedPath + '/index' + ext;
                    foundPath = await this.checkFileExists(indexPath);
                    if (foundPath) {
                        resolvedPaths.add(foundPath);
                    }
                }
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

    hasNoExtension(str) {
        const lastSlash = str.lastIndexOf('/');
        const lastDot = str.lastIndexOf('.');
        return lastDot === -1 || lastDot < lastSlash;
    }
}