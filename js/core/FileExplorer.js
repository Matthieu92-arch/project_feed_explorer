// js/core/FileExplorer.js
import { UIManager } from '../ui/UIManager.js';
import { FileManager } from '../services/FileManager.js';
import { DependencyAnalyzer } from '../services/DependencyAnalyzer.js';
import { SettingsManager } from '../services/SettingsManager.js';
import { ChunkManager } from '../services/ChunkManager.js';
import { ProjectScanner } from '../services/ProjectScanner.js';
import { ContentGenerator } from '../services/ContentGenerator.js';
import { ContentFilter } from '../services/ContentFilter.js';

export class FileExplorer {
    constructor() {
        // Core state
        this.currentPath = '/';
        this.selectedFiles = new Set();
        this.expandedDirectories = new Set();
        this.fileContents = new Map();
        this.fileDependencies = new Map();
        this.dependencyOwners = new Map();
        
        // Project type files
        this.dockerFiles = [];
        this.djangoFiles = [];
        this.reactFiles = [];
        
        // Initialize managers
        this.uiManager = new UIManager(this);
        this.fileManager = new FileManager(this);
        this.dependencyAnalyzer = new DependencyAnalyzer(this);
        this.settingsManager = new SettingsManager(this);
        this.chunkManager = new ChunkManager(this);
        this.projectScanner = new ProjectScanner(this);
        this.contentFilter = new ContentFilter(this);
        this.contentGenerator = new ContentGenerator(this);
        
        // Generated content
        this.generatedFileContent = '';
        
        // Audio for notifications
        this.audio = new Audio('/paper-245786.mp3');
    }

    async init() {
        await this.settingsManager.loadSettings();
        await this.fileManager.loadDirectory(this.currentPath);
        this.uiManager.setupEventListeners();
        this.uiManager.setupResizer();
        this.uiManager.setupSuccessModalListeners();
        this.updateValidateButton();
    }

    // Utility Methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    playChunkSound() {
        this.audio.currentTime = 0;
        this.audio.play().catch(error => {
            console.error('Error playing sound:', error);
        });
    }

    // File selection methods
    async selectFile(filePath) {
        this.selectedFiles.add(filePath);
        await this.dependencyAnalyzer.analyzeFileDependencies({ path: filePath });
        this.updateValidateButton();
    }

    async deselectFile(filePath) {
        this.selectedFiles.delete(filePath);
        await this.dependencyAnalyzer.removeDependencies(filePath);
        this.updateValidateButton();
    }

    updateValidateButton() {
        const btn = document.getElementById('validateBtn');
        const count = document.getElementById('selectedCount');
        const fileCount = Array.from(this.selectedFiles).filter(path => {
            const item = document.querySelector(`[data-path="${path}"]`);
            return !item || item.dataset.type === 'file';
        }).length;

        count.textContent = fileCount;
        btn.disabled = fileCount === 0;
    }

    updateVisibleCheckboxes() {
        document.querySelectorAll('.file-item').forEach(item => {
            const checkbox = item.querySelector('.checkbox');
            const path = item.dataset.path;
            if (checkbox && path) {
                checkbox.checked = this.selectedFiles.has(path);
            }
        });
    }

    // Navigation methods
    async navigateToDirectory(targetPath) {
        try {
            console.log('Attempting to navigate to:', targetPath);

            const tree = document.getElementById('fileTree');
            tree.innerHTML = '<div class="loading">🔄 Loading files...</div>';

            document.getElementById('currentPath').textContent = targetPath;

            await this.fileManager.loadDirectory(targetPath);

            this.currentPath = targetPath;

            if (this.settingsManager.settings.includeDockerFiles) {
                await this.projectScanner.scanForDockerFiles();
            }

            console.log('Successfully navigated to:', targetPath);
        } catch (error) {
            console.error('Error navigating to directory:', error);
            alert(`Error accessing directory: ${error.message}\n\nPlease check that the path exists and you have permission to access it.`);
        }
    }

    async changeRootDirectory() {
        const newPath = await this.settingsManager.openNativeFileBrowser();
        if (newPath) {
            await this.navigateToDirectory(newPath);
        }
    }

    // Modal management
    async showConfirmModal() {
        await this.uiManager.showConfirmModal();
    }

    hideConfirmModal() {
        this.uiManager.hideConfirmModal();
    }

    showContentModal() {
        this.uiManager.showContentModal();
    }

    hideContentModal() {
        this.uiManager.hideContentModal();
    }

    showSuccessModal(result, enabledProjectTypes) {
        this.uiManager.showSuccessModal(result, enabledProjectTypes);
    }

    hideSuccessModal() {
        this.uiManager.hideSuccessModal();
    }

    showSettingsModal() {
        this.uiManager.showSettingsModal();
    }

    hideSettingsModal() {
        this.uiManager.hideSettingsModal();
    }

    // Content generation
    async generateFile() {
        try {
            const result = await this.contentGenerator.generateFile();
            
            if (result.success) {
                this.hideConfirmModal();
                this.showSuccessModal(result, result.enabledProjectTypes);
            } else {
                // js/core/FileExplorer.js (continued)
                alert(`❌ Error saving file: ${result.error}`);
            }
        } catch (error) {
            console.error('Error generating file:', error);
            alert(`❌ Error generating file: ${error.message}`);
        }
    }

    // Copy and download methods
    async copyContentToClipboard() {
        await this.chunkManager.copyCurrentChunk();
    }

    async copyAllChunks() {
        await this.chunkManager.copyAllChunks();
    }

    downloadContent() {
        this.chunkManager.downloadCurrentChunk();
    }

    downloadAllChunks() {
        this.chunkManager.downloadAllChunks();
    }

    // Chunk navigation
    switchToChunk(index) {
        this.chunkManager.switchToChunk(index);
        this.playChunkSound();
    }

    handleChunkKeyNavigation(event) {
        this.chunkManager.handleKeyNavigation(event);
    }

    // Settings management
    async saveSettingsFromModal() {
        return await this.settingsManager.saveSettingsFromModal();
    }

    // Project scanning
    async scanForProjectFiles() {
        await this.projectScanner.scanForProjectFiles();
    }

    async scanForDockerFiles() {
        await this.projectScanner.scanForDockerFiles();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fileExplorer = new FileExplorer();
    window.fileExplorer.init();
});