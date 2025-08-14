// js/ui/ModalManager.js (updated to show filtering info)
// js/ui/ModalManager.js
export class ModalManager {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
    }

    setupEventListeners() {
        // Confirm Modal
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideConfirmModal());
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideConfirmModal());
        }

        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.fileExplorer.generateFile());
        }

        // Content Modal
        const closeContentModal = document.getElementById('closeContentModal');
        if (closeContentModal) {
            closeContentModal.addEventListener('click', () => this.hideContentModal());
        }

        const closeContentModal2 = document.getElementById('closeContentModal2');
        if (closeContentModal2) {
            closeContentModal2.addEventListener('click', () => this.hideContentModal());
        }

        const copyContentBtn = document.getElementById('copyContentBtn');
        if (copyContentBtn) {
            copyContentBtn.addEventListener('click', () => this.fileExplorer.copyContentToClipboard());
        }

        const downloadContentBtn = document.getElementById('downloadContentBtn');
        if (downloadContentBtn) {
            downloadContentBtn.addEventListener('click', () => this.fileExplorer.downloadContent());
        }

        const copyAllChunksBtn = document.getElementById('copyAllChunksBtn');
        if (copyAllChunksBtn) {
            copyAllChunksBtn.addEventListener('click', () => this.fileExplorer.copyAllChunks());
        }

        const downloadAllChunks = document.getElementById('downloadAllChunks');
        if (downloadAllChunks) {
            downloadAllChunks.addEventListener('click', () => this.fileExplorer.downloadAllChunks());
        }

        // Settings Modal
        const closeSettingsModal = document.getElementById('closeSettingsModal');
        if (closeSettingsModal) {
            closeSettingsModal.addEventListener('click', () => this.hideSettingsModal());
        }

        const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
        if (cancelSettingsBtn) {
            cancelSettingsBtn.addEventListener('click', () => this.hideSettingsModal());
        }

        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.fileExplorer.saveSettingsFromModal());
        }

        // Settings form listeners
        this.setupSettingsFormListeners();
    }

    setupSettingsFormListeners() {
        const browseDefaultPath = document.getElementById('browseDefaultPath');
        if (browseDefaultPath) {
            browseDefaultPath.addEventListener('click', async () => {
                const newPath = await this.fileExplorer.settingsManager.openNativeFileBrowser();
                if (newPath) {
                    document.getElementById('defaultPath').value = newPath;
                    this.fileExplorer.uiManager.updateProjectTypesGridState();
                }
            });
        }

        const defaultPath = document.getElementById('defaultPath');
        if (defaultPath) {
            defaultPath.addEventListener('input', () => {
                this.fileExplorer.uiManager.updateProjectTypesGridState();
            });
        }

        const includeDockerFiles = document.getElementById('includeDockerFiles');
        if (includeDockerFiles) {
            includeDockerFiles.addEventListener('change', () => {
                this.fileExplorer.uiManager.updateDockerFilesPreview();
            });
        }

        const includeDjangoFiles = document.getElementById('includeDjangoFiles');
        if (includeDjangoFiles) {
            includeDjangoFiles.addEventListener('change', () => {
                this.fileExplorer.uiManager.updateProjectFilesPreview();
            });
        }

        const includeReactFiles = document.getElementById('includeReactFiles');
        if (includeReactFiles) {
            includeReactFiles.addEventListener('change', () => {
                this.fileExplorer.uiManager.updateProjectFilesPreview();
            });
        }
    }

    setupSuccessModalListeners() {
        const successPreviewBtn = document.getElementById('successPreviewBtn');
        if (successPreviewBtn) {
            successPreviewBtn.addEventListener('click', () => {
                this.hideSuccessModal();
                this.showContentModal();
            });
        }

        const closeSuccessModal = document.getElementById('closeSuccessModal');
        if (closeSuccessModal) {
            closeSuccessModal.addEventListener('click', () => this.hideSuccessModal());
        }

        const successCloseBtn = document.getElementById('successCloseBtn');
        if (successCloseBtn) {
            successCloseBtn.addEventListener('click', () => this.hideSuccessModal());
        }

        const successOpenFolderBtn = document.getElementById('successOpenFolderBtn');
        if (successOpenFolderBtn) {
            successOpenFolderBtn.addEventListener('click', () => this.openOutputFolder());
        }

        const successModal = document.getElementById('successModal');
        if (successModal) {
            successModal.addEventListener('click', (e) => {
                if (e.target === successModal) {
                    this.hideSuccessModal();
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && successModal && !successModal.classList.contains('hidden')) {
                this.hideSuccessModal();
            }
        });
    }

    async showConfirmModal() {
        const modal = document.getElementById('confirmModal');
        const totalFiles = document.getElementById('totalFiles');
        const totalLines = document.getElementById('totalLines');
        const totalSize = document.getElementById('totalSize');
        const filesList = document.getElementById('selectedFilesList');
        const progressFill = document.getElementById('progressFill');

        modal.classList.remove('hidden');
        progressFill.style.width = '0%';

        let lineCount = 0;
        let sizeCount = 0;
        const files = [];
        const selectedFilesList = Array.from(this.fileExplorer.selectedFiles).filter(path => {
            const item = document.querySelector(`[data-path="${path}"]`);
            return !item || item.dataset.type === 'file';
        });

        // Apply smart filtering
        const filterResult = this.fileExplorer.contentFilter.filterAndPrioritizeFiles(selectedFilesList);
        const filteredFiles = filterResult.included;

        totalFiles.textContent = `${filteredFiles.length} (${filterResult.excluded.length} filtered out)`;
        totalLines.textContent = 'Calculating...';
        totalSize.textContent = 'Calculating...';

        for (let i = 0; i < filteredFiles.length; i++) {
            const filePath = filteredFiles[i].path;
            const priority = filteredFiles[i].priority;

            try {
                const content = await this.fileExplorer.fileManager.getFileContent(filePath);

                if (content && !content.isBinary) {
                    // Apply compression to get accurate size
                    const compressedContent = this.fileExplorer.contentFilter.compressBoilerplate(content.content, filePath);
                    const compressedLines = compressedContent.split('\n').length;
                    
                    lineCount += compressedLines;
                    sizeCount += new Blob([compressedContent]).size;
                }

                const fileName = filePath.split('/').pop();
                const directory = filePath.substring(0, filePath.lastIndexOf('/'));
                files.push({
                    fileName,
                    directory,
                    path: filePath,
                    lines: content ? content.lines : 0,
                    isBinary: content ? content.isBinary : false,
                    priority: priority
                });

                const progress = ((i + 1) / filteredFiles.length) * 100;
                progressFill.style.width = progress + '%';

                totalLines.textContent = lineCount.toLocaleString();
                totalSize.textContent = this.fileExplorer.formatFileSize(sizeCount);

            } catch (error) {
                console.error(`Error processing file ${filePath}:`, error);
                files.push({
                    fileName: filePath.split('/').pop(),
                    directory: filePath.substring(0, filePath.lastIndexOf('/')),
                    path: filePath,
                    lines: 0,
                    error: true,
                    priority: priority
                });
            }
        }

        this.populateFilesList(filesList, files, filterResult.excluded);
        progressFill.style.width = '100%';
    }

    populateFilesList(filesList, files, excludedFiles) {
        filesList.innerHTML = '';
        
        // Add header for included files
        if (files.length > 0) {
            const headerIncluded = document.createElement('div');
            headerIncluded.className = 'file-list-header';
            headerIncluded.innerHTML = `<strong>📁 Files to Include (${files.length})</strong>`;
            headerIncluded.style.cssText = 'padding: 8px; background: #238636; color: white; font-weight: bold; border-radius: 4px; margin-bottom: 8px;';
            filesList.appendChild(headerIncluded);
        }

        // Sort files by priority for display
        files.sort((a, b) => b.priority.score - a.priority.score);

        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-list-item';

            const pathDiv = document.createElement('div');
            pathDiv.className = 'file-list-path';
            
            // Add priority indicator
            const priorityBadge = `<span class="priority-badge priority-${file.priority.category}" style="background: ${this.getPriorityColor(file.priority.category)}; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-right: 8px;">${file.priority.score}</span>`;
            
            pathDiv.innerHTML = `${priorityBadge}<strong>${file.fileName}</strong><br><small>${file.directory}</small>`;

            const linesDiv = document.createElement('div');
            linesDiv.className = 'file-list-lines';
            if (file.error) {
                linesDiv.textContent = 'Error';
                linesDiv.style.color = '#f85149';
            } else if (file.isBinary) {
                linesDiv.textContent = 'Binary';
                linesDiv.style.color = '#7d8590';
            } else {
                linesDiv.textContent = `${file.lines} lines`;
            }

            item.appendChild(pathDiv);
            item.appendChild(linesDiv);
            filesList.appendChild(item);
        });

        // Add excluded files section if any
        if (excludedFiles.length > 0) {
            const headerExcluded = document.createElement('div');
            headerExcluded.className = 'file-list-header';
            headerExcluded.innerHTML = `<strong>🚫 Filtered Out (${excludedFiles.length})</strong>`;
            headerExcluded.style.cssText = 'padding: 8px; background: #f85149; color: white; font-weight: bold; border-radius: 4px; margin: 16px 0 8px 0;';
            filesList.appendChild(headerExcluded);

            // Show first few excluded files
            const samplesToShow = Math.min(excludedFiles.length, 5);
            for (let i = 0; i < samplesToShow; i++) {
                const excludedFile = excludedFiles[i];
                const item = document.createElement('div');
                item.className = 'file-list-item';
                item.style.opacity = '0.6';

                const fileName = excludedFile.path.split('/').pop();
                const pathDiv = document.createElement('div');
                pathDiv.className = 'file-list-path';
                pathDiv.innerHTML = `<strong>${fileName}</strong><br><small>${excludedFile.reason}</small>`;

                const typeDiv = document.createElement('div');
                typeDiv.className = 'file-list-lines';
                typeDiv.textContent = 'Excluded';
                typeDiv.style.color = '#f85149';

                item.appendChild(pathDiv);
                item.appendChild(typeDiv);
                filesList.appendChild(item);
            }

            if (excludedFiles.length > samplesToShow) {
                const moreItem = document.createElement('div');
                moreItem.className = 'file-list-item';
                moreItem.style.cssText = 'text-align: center; font-style: italic; color: #7d8590;';
                moreItem.textContent = `... and ${excludedFiles.length - samplesToShow} more excluded files`;
                filesList.appendChild(moreItem);
            }
        }
    }

    getPriorityColor(category) {
        const colors = {
            'core': '#238636',
            'business': '#1f6feb',
            'config': '#fd7e14',
            'docs': '#6f42c1',
            'tests': '#20c997',
            'assets': '#6c757d',
            'other': '#495057',
            'error': '#dc3545'
        };
        return colors[category] || colors.other;
    }

    hideConfirmModal() {
        document.getElementById('confirmModal').classList.add('hidden');
    }

    showContentModal() {
        const modal = document.getElementById('contentModal');
        const generatedContent = document.getElementById('generatedContent');
        const contentFileCount = document.getElementById('contentFileCount');
        const contentLineCount = document.getElementById('contentLineCount');
        const contentCharCount = document.getElementById('contentCharCount');
        const contentSizeCount = document.getElementById('contentSizeCount');

        const fullContent = this.fileExplorer.generatedFileContent;
        const lines = fullContent.split('\n').length;
        const characters = fullContent.length;
        const size = new Blob([fullContent]).size;
        const fileCount = Array.from(this.fileExplorer.selectedFiles).filter(path => {
            const item = document.querySelector(`[data-path="${path}"]`);
            return !item || item.dataset.type === 'file';
        }).length;

        contentFileCount.textContent = fileCount;
        contentLineCount.textContent = lines.toLocaleString();
        contentCharCount.textContent = characters.toLocaleString();
        contentSizeCount.textContent = this.fileExplorer.formatFileSize(size);

        // Setup chunk navigation
        this.fileExplorer.chunkManager.setupContentModal(modal, generatedContent);

        modal.classList.remove('hidden');
        document.getElementById('contentDisplayModal').scrollTop = 0;

        console.log(`📦 Content modal opened with ${this.fileExplorer.chunkManager.fileChunks.length} chunks`);
    }

    hideContentModal() {
        document.getElementById('contentModal').classList.add('hidden');
    }

    showSuccessModal(result, enabledProjectTypes) {
        const modal = document.getElementById('successModal');

        // File information
        document.getElementById('successFilename').textContent = result.filename;
        document.getElementById('successDirectory').textContent = '📂 output_files_selected/';
        document.getElementById('successFullPath').textContent = result.relativePath;

        const fileSize = new Blob([this.fileExplorer.generatedFileContent]).size;
        document.getElementById('successFileSize').textContent = this.fileExplorer.formatFileSize(fileSize);

        // Content statistics
        const selectedFilesList = Array.from(this.fileExplorer.selectedFiles).filter(path => {
            const item = document.querySelector(`[data-path="${path}"]`);
            return !item || item.dataset.type === 'file';
        });

        const lines = this.fileExplorer.generatedFileContent.split('\n').length;
        const characters = this.fileExplorer.generatedFileContent.length;

        document.getElementById('successTotalFiles').textContent = selectedFilesList.length;
        document.getElementById('successTotalLines').textContent = lines.toLocaleString();
        document.getElementById('successTotalChars').textContent = characters.toLocaleString();

        // Chunk information
        const chunkStat = document.getElementById('successChunkStat');
        if (this.fileExplorer.chunkManager.fileChunks.length > 1) {
            chunkStat.style.display = 'flex';
            document.getElementById('successChunkCount').textContent = this.fileExplorer.chunkManager.fileChunks.length;
        } else {
            chunkStat.style.display = 'none';
        }

        // Project types
        this.setupProjectTypesDisplay(enabledProjectTypes);

        // Features
        this.setupFeaturesDisplay();

        modal.classList.remove('hidden');
    }

    setupProjectTypesDisplay(enabledProjectTypes) {
        const projectTypesSection = document.getElementById('successProjectTypesSection');
        const projectTypesContainer = document.getElementById('successProjectTypes');

        if (enabledProjectTypes.length > 0) {
            projectTypesSection.style.display = 'block';
            projectTypesContainer.innerHTML = '';

            enabledProjectTypes.forEach(typeInfo => {
                const typeElement = document.createElement('div');
                typeElement.className = 'success-project-type';

                if (typeInfo.includes('Django')) {
                    typeElement.classList.add('django');
                    typeElement.innerHTML = '🐍 ' + typeInfo;
                } else if (typeInfo.includes('React')) {
                    typeElement.classList.add('react');
                    typeElement.innerHTML = '⚛️ ' + typeInfo;
                }

                projectTypesContainer.appendChild(typeElement);
            });
        } else {
            projectTypesSection.style.display = 'none';
        }
    }

    setupFeaturesDisplay() {
        const customPromptFeature = document.getElementById('successCustomPromptFeature');
        if (this.fileExplorer.settingsManager.settings.customPrompt?.trim()) {
            customPromptFeature.style.display = 'flex';
        } else {
            customPromptFeature.style.display = 'none';
        }

        const dockerFeature = document.getElementById('successDockerFeature');
        if (this.fileExplorer.dockerFiles.length > 0) {
            dockerFeature.style.display = 'flex';
        } else {
            dockerFeature.style.display = 'none';
        }

        const dependencyFeature = document.getElementById('successDependencyFeature');
        if (this.fileExplorer.fileDependencies.size > 0) {
            dependencyFeature.style.display = 'flex';
        } else {
            dependencyFeature.style.display = 'none';
        }

        // Add smart filtering feature indicator
        const smartFilteringFeature = document.getElementById('successSmartFilteringFeature');
        if (smartFilteringFeature) {
            smartFilteringFeature.style.display = 'flex';
        }
    }

    hideSuccessModal() {
        document.getElementById('successModal').classList.add('hidden');
    }

    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const defaultPathInput = document.getElementById('defaultPath');
        const includeDockerCheckbox = document.getElementById('includeDockerFiles');
        const customPromptTextarea = document.getElementById('customPrompt');
        const currentDefaultPath = document.getElementById('currentDefaultPath');

        const djangoCheckbox = document.getElementById('includeDjangoFiles');
        const reactCheckbox = document.getElementById('includeReactFiles');

        if (!modal) {
            console.error('Settings modal not found');
            return;
        }

        const settings = this.fileExplorer.settingsManager.settings;

        if (defaultPathInput) defaultPathInput.value = settings.defaultPath || '';
        if (includeDockerCheckbox) includeDockerCheckbox.checked = settings.includeDockerFiles || false;
        if (customPromptTextarea) customPromptTextarea.value = settings.customPrompt || '';
        if (currentDefaultPath) currentDefaultPath.textContent = settings.defaultPath || 'Not set';

        if (djangoCheckbox) djangoCheckbox.checked = settings.projectTypes?.django || false;
        if (reactCheckbox) reactCheckbox.checked = settings.projectTypes?.react || false;

        this.fileExplorer.uiManager.updateProjectTypesGridState();
        this.fileExplorer.uiManager.updateDockerFilesPreview();
        this.fileExplorer.uiManager.updateProjectFilesPreview();

        modal.classList.remove('hidden');
    }

    hideSettingsModal() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    async openOutputFolder() {
        try {
            const { exec } = require('child_process');
            const path = require('path');
            const outputDir = path.join(process.cwd(), 'output_files_selected');

            const platform = process.platform;
            let command;

            if (platform === 'darwin') {
                command = `open "${outputDir}"`;
            } else if (platform === 'win32') {
                command = `explorer "${outputDir}"`;
            } else {
                command = `xdg-open "${outputDir}"`;
            }

            exec(command, (error) => {
                if (error) {
                    console.error('Error opening folder:', error);
                    alert('Could not open folder automatically. Please navigate to the output_files_selected directory manually.');
                }
            });
        } catch (error) {
            console.error('Error opening folder:', error);
            alert('Could not open folder automatically. Please navigate to the output_files_selected directory manually.');
        }
    }
}