import { ModalManager } from './ModalManager.js';
import { FileTreeRenderer } from './FileTreeRenderer.js';
import { ContentViewer } from './ContentViewer.js';
import { ResizerManager } from './ResizerManager.js';

export class UIManager {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.modalManager = new ModalManager(fileExplorer);
        this.fileTreeRenderer = new FileTreeRenderer(fileExplorer);
        this.contentViewer = new ContentViewer(fileExplorer);
        this.resizerManager = new ResizerManager();
    }

    setupEventListeners() {
        // Main action buttons
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.fileExplorer.showConfirmModal());
        }

        // Modal event listeners
        this.modalManager.setupEventListeners();

        // Content viewer event listeners
        this.contentViewer.setupEventListeners();

        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.fileExplorer.showSettingsModal());
        }

        // Keyboard navigation for chunks
        document.addEventListener('keydown', (event) => this.fileExplorer.handleChunkKeyNavigation(event));

        // Root path browse button
        const rootPathBrowseBtn = document.querySelector('#rootPath button');
        if (rootPathBrowseBtn) {
            rootPathBrowseBtn.addEventListener('click', () => this.fileExplorer.changeRootDirectory());
        }
    }

    setupResizer() {
        this.resizerManager.setup();
    }

    setupSuccessModalListeners() {
        this.modalManager.setupSuccessModalListeners();
    }

    // Content Modal Methods
    showContentModal() {
        this.modalManager.showContentModal();
    }

    hideContentModal() {
        this.modalManager.hideContentModal();
    }

    // Confirm Modal Methods
    async showConfirmModal() {
        await this.modalManager.showConfirmModal();
    }

    hideConfirmModal() {
        this.modalManager.hideConfirmModal();
    }

    // Success Modal Methods
    showSuccessModal(result, enabledProjectTypes) {
        this.modalManager.showSuccessModal(result, enabledProjectTypes);
    }

    hideSuccessModal() {
        this.modalManager.hideSuccessModal();
    }

    // Settings Modal Methods
    showSettingsModal() {
        this.modalManager.showSettingsModal();
    }

    hideSettingsModal() {
        this.modalManager.hideSettingsModal();
    }

    // File tree methods
    createFileItem(file, parentPath) {
        return this.fileTreeRenderer.createFileItem(file, parentPath);
    }

    updateBreadcrumb(path) {
        this.fileTreeRenderer.updateBreadcrumb(path);
    }

    // Content viewer methods
    async loadFileContent(file) {
        await this.contentViewer.loadFileContent(file);
    }

    // Utility methods
    updateProjectTypesGridState() {
        const projectTypesGrid = document.getElementById('projectTypesGrid');
        const defaultPathInput = document.getElementById('defaultPath');
        const includeDjangoFiles = document.getElementById('includeDjangoFiles');
        const includeReactFiles = document.getElementById('includeReactFiles');

        if (!projectTypesGrid || !defaultPathInput) {
            console.log('Project types grid elements not found, skipping state update');
            return;
        }

        if (!defaultPathInput.value.trim()) {
            projectTypesGrid.classList.add('warning');
            if (includeDjangoFiles) includeDjangoFiles.disabled = true;
            if (includeReactFiles) includeReactFiles.disabled = true;
        } else {
            projectTypesGrid.classList.remove('warning');
            if (includeDjangoFiles) includeDjangoFiles.disabled = false;
            if (includeReactFiles) includeReactFiles.disabled = false;
        }
    }

    async updateProjectFilesPreview() {
        const djangoCheckbox = document.getElementById('includeDjangoFiles');
        const reactCheckbox = document.getElementById('includeReactFiles');
        const projectFilesPreview = document.getElementById('projectFilesPreview');
        const projectFilesList = document.getElementById('projectFilesList');

        if (!djangoCheckbox || !reactCheckbox || !projectFilesPreview || !projectFilesList) {
            console.log('Project files preview elements not found, skipping preview update');
            return;
        }

        const isDjangoChecked = djangoCheckbox.checked;
        const isReactChecked = reactCheckbox.checked;

        if (isDjangoChecked || isReactChecked) {
            projectFilesPreview.style.display = 'block';

            let previewHtml = '';

            if (isDjangoChecked) {
                previewHtml += '<div class="project-files-section">';
                previewHtml += '<h5>🐍 Django Files:</h5>';
                if (this.fileExplorer.djangoFiles && this.fileExplorer.djangoFiles.length > 0) {
                    this.fileExplorer.djangoFiles.forEach(file => {
                        const icon = file.name === 'settings.py' ? '🛠️' : '🐍';
                        previewHtml += `<div class="project-file-item django">${icon} ${file.relativePath} <span class="file-type">${file.type}</span></div>`;
                    });
                } else {
                    previewHtml += '<div class="project-file-item no-files">No Django files found in current directory tree</div>';
                }
                previewHtml += '</div>';
            }

            if (isReactChecked) {
                previewHtml += '<div class="project-files-section">';
                previewHtml += '<h5>⚛️ React Files:</h5>';
                if (this.fileExplorer.reactFiles && this.fileExplorer.reactFiles.length > 0) {
                    this.fileExplorer.reactFiles.forEach(file => {
                        const icon = file.name === 'package.json' ? '🛠️' : '⚛️';
                        previewHtml += `<div class="project-file-item react">${icon} ${file.relativePath} <span class="file-type">${file.type}</span></div>`;
                    });
                } else {
                    previewHtml += '<div class="project-file-item no-files">No React files found in current directory tree</div>';
                }
                previewHtml += '</div>';
            }

            projectFilesList.innerHTML = previewHtml;
        } else {
            projectFilesPreview.style.display = 'none';
        }
    }

    async updateDockerFilesPreview() {
        const includeDockerCheckbox = document.getElementById('includeDockerFiles');
        const dockerFilesPreview = document.getElementById('dockerFilesPreview');
        const dockerFilesList = document.getElementById('dockerFilesList');

        if (!includeDockerCheckbox || !dockerFilesPreview || !dockerFilesList) {
            return;
        }

        if (includeDockerCheckbox.checked) {
            dockerFilesPreview.style.display = 'block';

            if (this.fileExplorer.dockerFiles.length > 0) {
                dockerFilesList.innerHTML = this.fileExplorer.dockerFiles.map(file =>
                    `<div class="docker-file-item">${file.relativePath}</div>`
                ).join('');
            } else {
                dockerFilesList.innerHTML = '<div class="docker-file-item" style="color: #7d8590;">No Docker files found in current directory tree</div>';
            }
        } else {
            dockerFilesPreview.style.display = 'none';
        }
    }
}