// js/services/DependencyAnalyzer.js
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

                        // Parse index file for re-exports
                        if (importedNames && importedNames.length > 0) {
                            const reExports = await this.parseIndexFile(foundPath);
                            const indexDir = foundPath.substring(0, foundPath.lastIndexOf('/'));

                            for (const importedName of importedNames) {
                                if (importedName) {
                                    const matchingExport = reExports.find(reExport =>
                                        reExport.exportedName === importedName || reExport.exportedName === '*'
                                    );

                                    if (matchingExport) {
                                        const reExportPath = this.resolveRelativeToIndex(indexDir, matchingExport.relativePath);

                                        for (const ext of extensions) {
                                            const reExportWithExt = reExportPath + ext;
                                            const reExportFound = await this.checkFileExists(reExportWithExt);
                                            if (reExportFound) {
                                                resolvedPaths.add(reExportFound);
                                                console.log(`✅ Found re-exported component: ${importedName} at ${reExportFound} via index file ${foundPath}`);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Try named component files
                if (importedNames && importedNames.length > 0) {
                    for (const importedName of importedNames) {
                        if (importedName) {
                            for (const ext of extensions) {
                                const namedComponentPath = resolvedPath + '/' + importedName + ext;
                                foundPath = await this.checkFileExists(namedComponentPath);
                                if (foundPath) {
                                    resolvedPaths.add(foundPath);
                                    console.log(`✅ Found named component: ${importedName} at ${foundPath}`);
                                }
                            }
                        }
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

    hasNoExtension = (str) => {
                const lastSlash = str.lastIndexOf('/');
                const lastDot = str.lastIndexOf('.');
                return lastDot === -1 || lastDot < lastSlash;
            }
        }
