// js/core/FileExplorer.js (Updated with Semantic Chunking)
import { UIManager } from '../ui/UIManager.js';
import { FileManager } from '../services/FileManager.js';
import { DependencyAnalyzer } from '../services/DependencyAnalyzer.js';
import { SettingsManager } from '../services/SettingsManager.js';
import { SemanticChunkManager } from '../services/SemanticChunkManager.js'; // Updated import
import { ProjectScanner } from '../services/ProjectScanner.js';
import { ContentGenerator } from '../services/ContentGenerator.js';
import { ContentFilter } from '../services/ContentFilter.js';
import { ProjectAnalyzer } from '../services/ProjectAnalyzer.js';

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
        
        // Initialize managers - Updated to use SemanticChunkManager
        this.uiManager = new UIManager(this);
        this.fileManager = new FileManager(this);
        this.dependencyAnalyzer = new DependencyAnalyzer(this);
        this.settingsManager = new SettingsManager(this);
        this.chunkManager = new SemanticChunkManager(this); // Enhanced chunking
        this.projectScanner = new ProjectScanner(this);
        this.contentFilter = new ContentFilter(this);
        this.projectAnalyzer = new ProjectAnalyzer(this);
        this.contentGenerator = new ContentGenerator(this);
        
        // Generated content
        this.generatedFileContent = '';
        
        // Audio for notifications
        this.audio = new Audio('/paper-245786.mp3');
        
        // Semantic chunking preferences
        this.chunkingPreferences = {
            strategy: 'semantic', // 'semantic' | 'size-based' | 'hybrid'
            preserveClasses: true,
            preserveFunctions: true,
            minimumChunkSize: 50000, // 50KB minimum
            maximumChunkSize: 500000, // 500KB maximum
            semanticBoundaryWeight: 0.7 // How much to prioritize semantic boundaries vs size
        };
    }

    async init() {
        await this.settingsManager.loadSettings();
        await this.fileManager.loadDirectory(this.currentPath);
        this.uiManager.setupEventListeners();
        this.uiManager.setupResizer();
        this.uiManager.setupSuccessModalListeners();
        
        // Initialize semantic chunking preferences from settings if available
        if (this.settingsManager.settings.chunkingPreferences) {
            this.chunkingPreferences = {
                ...this.chunkingPreferences,
                ...this.settingsManager.settings.chunkingPreferences
            };
        }
        
        // Set chunking strategy in the chunk manager
        this.chunkManager.chunkingStrategy = this.chunkingPreferences.strategy;
        
        this.updateValidateButton();
        console.log('🧠 FileExplorer initialized with semantic chunking support');
    }

    // Enhanced content generation with semantic analysis
    async generateFile() {
        try {
            console.log('🚀 Starting enhanced file generation with semantic chunking...');
            
            // Show AI analysis status
            this.uiManager.updateAIAnalysisStatus({
                type: 'analyzing',
                icon: '🧠',
                text: 'Analyzing project structure...'
            });

            const result = await this.contentGenerator.generateFile();
            
            if (result.success) {
                // Update status
                this.uiManager.updateAIAnalysisStatus({
                    type: 'complete',
                    icon: '✅',
                    text: 'Analysis complete'
                });

                this.hideConfirmModal();
                this.showSuccessModal(result, result.enabledProjectTypes);
            } else {
                this.uiManager.updateAIAnalysisStatus({
                    type: 'error',
                    icon: '❌',
                    text: 'Analysis failed'
                });
                alert(`❌ Error saving file: ${result.error}`);
            }
        } catch (error) {
            console.error('Error generating file:', error);
            this.uiManager.updateAIAnalysisStatus({
                type: 'error',
                icon: '❌',
                text: 'Analysis error'
            });
            alert(`❌ Error generating file: ${error.message}`);
        }
    }

    // Enhanced chunking control methods
    setChunkingStrategy(strategy) {
        this.chunkingPreferences.strategy = strategy;
        this.chunkManager.chunkingStrategy = strategy;
        
        // Save to settings
        this.settingsManager.settings.chunkingPreferences = this.chunkingPreferences;
        this.settingsManager.saveSettings();
        
        console.log(`📊 Chunking strategy changed to: ${strategy}`);
        
        // Re-process content if it exists
        if (this.generatedFileContent) {
            this.chunkManager.processContent(this.generatedFileContent);
        }
    }

    updateChunkingPreferences(preferences) {
        this.chunkingPreferences = {
            ...this.chunkingPreferences,
            ...preferences
        };
        
        // Update chunk manager settings
        this.chunkManager.defaultChunkSize = this.chunkingPreferences.minimumChunkSize;
        this.chunkManager.chunkingStrategy = this.chunkingPreferences.strategy;
        
        // Save to settings
        this.settingsManager.settings.chunkingPreferences = this.chunkingPreferences;
        this.settingsManager.saveSettings();
        
        console.log('⚙️ Chunking preferences updated:', this.chunkingPreferences);
    }

    // Enhanced modal management with semantic features
    showContentModal() {
        console.log('📦 Opening content modal with semantic chunking features...');
        this.uiManager.showContentModal();
        
        // Add semantic chunking controls to the modal
        this.addSemanticChunkingControls();
    }

    addSemanticChunkingControls() {
        const modal = document.getElementById('contentModal');
        const modalBody = modal.querySelector('.modal-body');
        
        // Check if controls already exist
        if (document.getElementById('semanticChunkingControls')) {
            return;
        }
        
        const controlsContainer = document.createElement('div');
        controlsContainer.id = 'semanticChunkingControls';
        controlsContainer.className = 'semantic-chunking-controls';
        controlsContainer.innerHTML = `
            <div class="semantic-controls-header">
                <h4>🧠 Semantic Chunking Controls</h4>
                <button class="semantic-controls-toggle" onclick="this.parentElement.parentElement.classList.toggle('expanded')">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <div class="semantic-controls-content">
                <div class="chunking-strategy-selector">
                    <label>Chunking Strategy:</label>
                    <select id="chunkingStrategySelect">
                        <option value="semantic">🧠 Semantic (Keep related code together)</option>
                        <option value="size-based">📏 Size-based (Traditional chunking)</option>
                        <option value="hybrid">🔄 Hybrid (Balance semantic and size)</option>
                    </select>
                </div>
                
                <div class="semantic-options">
                    <div class="semantic-option">
                        <label>
                            <input type="checkbox" id="preserveClasses" ${this.chunkingPreferences.preserveClasses ? 'checked' : ''}>
                            Keep classes together
                        </label>
                    </div>
                    <div class="semantic-option">
                        <label>
                            <input type="checkbox" id="preserveFunctions" ${this.chunkingPreferences.preserveFunctions ? 'checked' : ''}>
                            Keep functions together
                        </label>
                    </div>
                </div>
                
                <div class="semantic-analysis-info">
                    <button class="btn btn-secondary" id="showSemanticAnalysis">📊 View Semantic Analysis</button>
                    <button class="btn btn-secondary" id="exportSemanticReport">📄 Export Analysis Report</button>
                </div>
            </div>
        `;
        
        // Insert after content info
        const contentInfo = modalBody.querySelector('.content-info');
        if (contentInfo) {
            modalBody.insertBefore(controlsContainer, contentInfo.nextSibling);
        }
        
        // Setup event listeners for the new controls
        this.setupSemanticControlsListeners();
        
        // Add CSS for semantic controls
        this.addSemanticControlsStyles();
        
        // Set current strategy
        const strategySelect = document.getElementById('chunkingStrategySelect');
        if (strategySelect) {
            strategySelect.value = this.chunkingPreferences.strategy;
        }
    }

    setupSemanticControlsListeners() {
        const strategySelect = document.getElementById('chunkingStrategySelect');
        if (strategySelect) {
            strategySelect.addEventListener('change', (e) => {
                this.setChunkingStrategy(e.target.value);
            });
        }
        
        const preserveClasses = document.getElementById('preserveClasses');
        if (preserveClasses) {
            preserveClasses.addEventListener('change', (e) => {
                this.updateChunkingPreferences({ preserveClasses: e.target.checked });
            });
        }
        
        const preserveFunctions = document.getElementById('preserveFunctions');
        if (preserveFunctions) {
            preserveFunctions.addEventListener('change', (e) => {
                this.updateChunkingPreferences({ preserveFunctions: e.target.checked });
            });
        }
        
        const showSemanticAnalysis = document.getElementById('showSemanticAnalysis');
        if (showSemanticAnalysis) {
            showSemanticAnalysis.addEventListener('click', () => {
                this.showSemanticAnalysisModal();
            });
        }
        
        const exportSemanticReport = document.getElementById('exportSemanticReport');
        if (exportSemanticReport) {
            exportSemanticReport.addEventListener('click', () => {
                this.exportSemanticAnalysisReport();
            });
        }
    }

    showSemanticAnalysisModal() {
        const analysis = this.chunkManager.generateChunkAnalysisSummary();
        
        const modal = document.createElement('div');
        modal.className = 'modal semantic-analysis-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📊 Semantic Chunking Analysis</h2>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="analysis-grid">
                        <div class="analysis-section">
                            <h3>📈 Overview</h3>
                            <div class="analysis-stats">
                                <div class="stat-item">
                                    <div class="stat-value">${analysis.totalChunks}</div>
                                    <div class="stat-label">Total Chunks</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${this.formatFileSize(analysis.averageSize)}</div>
                                    <div class="stat-label">Avg Size</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${analysis.crossReferences}</div>
                                    <div class="stat-label">Cross-References</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${(analysis.semanticCohesion * 100).toFixed(1)}%</div>
                                    <div class="stat-label">Semantic Cohesion</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="analysis-section">
                            <h3>🗂️ File Distribution</h3>
                            <div class="file-distribution">
                                ${Array.from(analysis.files.entries()).map(([filename, chunkIndices]) => `
                                    <div class="file-dist-item">
                                        <span class="filename">${filename}</span>
                                        <span class="chunk-badges">
                                            ${chunkIndices.map(i => `<span class="chunk-badge">Chunk ${i + 1}</span>`).join('')}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="analysis-section">
                            <h3>🔗 Cross-Reference Map</h3>
                            <div class="cross-ref-visualization">
                                ${this.chunkManager.fileChunks.map((chunk, index) => `
                                    <div class="chunk-node ${chunk.crossReferences?.length > 0 ? 'has-refs' : ''}">
                                        <div class="chunk-label">Chunk ${index + 1}</div>
                                        <div class="chunk-refs">${chunk.crossReferences?.length || 0} refs</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.addSemanticAnalysisModalStyles();
    }

    exportSemanticAnalysisReport() {
        const report = this.chunkManager.exportSemanticAnalysis();
        
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `semantic_chunking_analysis_${new Date().toISOString().split('T')[0]}.txt`;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        alert('📄 Semantic analysis report exported successfully!');
    }

    addSemanticControlsStyles() {
        if (document.getElementById('semanticControlsStyles')) return;

        const style = document.createElement('style');
        style.id = 'semanticControlsStyles';
        style.textContent = `
            .semantic-chunking-controls {
                background: #1c2526;
                border: 1px solid #2d3748;
                border-radius: 8px;
                margin: 16px 20px;
                overflow: hidden;
                transition: all 0.3s ease;
            }

            .semantic-controls-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: #21262d;
                border-bottom: 1px solid #2d3748;
                cursor: pointer;
            }

            .semantic-controls-header h4 {
                margin: 0;
                font-size: 14px;
                color: #7c3aed;
                font-weight: 600;
            }

            .semantic-controls-toggle {
                background: none;
                border: none;
                color: #7d8590;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .semantic-controls-toggle:hover {
                background: #30363d;
                color: #f0f6fc;
            }

            .toggle-icon {
                display: inline-block;
                transition: transform 0.3s ease;
            }

            .semantic-chunking-controls.expanded .toggle-icon {
                transform: rotate(180deg);
            }

            .semantic-controls-content {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }

            .semantic-chunking-controls.expanded .semantic-controls-content {
                max-height: 300px;
                overflow-y: auto;
            }

            .chunking-strategy-selector {
                padding: 16px;
                border-bottom: 1px solid #2d3748;
            }

            .chunking-strategy-selector label {
                display: block;
                font-size: 12px;
                color: #f0f6fc;
                font-weight: 600;
                margin-bottom: 8px;
            }

            .chunking-strategy-selector select {
                width: 100%;
                background: #0d1117;
                border: 1px solid #30363d;
                border-radius: 6px;
                padding: 8px;
                color: #f0f6fc;
                font-size: 12px;
            }

            .semantic-options {
                padding: 16px;
                border-bottom: 1px solid #2d3748;
            }

            .semantic-option {
                margin-bottom: 8px;
            }

            .semantic-option label {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                color: #f0f6fc;
                cursor: pointer;
            }

            .semantic-option input[type="checkbox"] {
                accent-color: #7c3aed;
            }

            .semantic-analysis-info {
                padding: 16px;
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .semantic-analysis-info .btn {
                font-size: 11px;
                padding: 6px 12px;
            }
        `;
        document.head.appendChild(style);
    }

    addSemanticAnalysisModalStyles() {
        if (document.getElementById('semanticAnalysisModalStyles')) return;

        const style = document.createElement('style');
        style.id = 'semanticAnalysisModalStyles';
        style.textContent = `
            .semantic-analysis-modal .modal-content {
                max-width: 900px;
                width: 90%;
            }

            .analysis-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 20px;
            }

            .analysis-section {
                background: #161b22;
                border: 1px solid #30363d;
                border-radius: 8px;
                padding: 16px;
            }

            .analysis-section h3 {
                color: #58a6ff;
                margin-bottom: 12px;
                font-size: 14px;
            }

            .analysis-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 12px;
            }

            .stat-item {
                text-align: center;
                background: #0d1117;
                border: 1px solid #21262d;
                border-radius: 6px;
                padding: 12px;
            }

            .stat-value {
                font-size: 18px;
                font-weight: 700;
                color: #7c3aed;
                margin-bottom: 4px;
            }

            .stat-label {
                font-size: 10px;
                color: #7d8590;
                font-weight: 600;
            }

            .file-distribution {
                max-height: 200px;
                overflow-y: auto;
            }

            .file-dist-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px;
                border-bottom: 1px solid #21262d;
                font-size: 12px;
            }

            .filename {
                color: #f0f6fc;
                font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
            }

            .chunk-badges {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
            }

            .chunk-badge {
                background: #7c3aed;
                color: white;
                font-size: 9px;
                padding: 2px 6px;
                border-radius: 8px;
                font-weight: 600;
            }

            .cross-ref-visualization {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 8px;
            }

            .chunk-node {
                background: #0d1117;
                border: 1px solid #21262d;
                border-radius: 6px;
                padding: 8px;
                text-align: center;
                transition: all 0.2s;
            }

            .chunk-node.has-refs {
                border-color: #f97316;
                background: rgba(249, 115, 22, 0.1);
            }

            .chunk-label {
                font-size: 11px;
                font-weight: 600;
                color: #f0f6fc;
            }

            .chunk-refs {
                font-size: 9px;
                color: #7d8590;
                margin-top: 2px;
            }

            @media (min-width: 768px) {
                .analysis-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .analysis-section:first-child {
                    grid-column: 1 / -1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Rest of the original methods remain the same...
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

    // File selection methods remain the same
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

   // Navigation methods remain the same
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

   // Modal management methods remain the same
   async showConfirmModal() {
       await this.uiManager.showConfirmModal();
   }

   hideConfirmModal() {
       this.uiManager.hideConfirmModal();
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

   // Enhanced copy and download methods with semantic awareness
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

   // Enhanced chunk navigation with semantic features
   switchToChunk(index) {
       this.chunkManager.switchToChunk(index);
       this.playChunkSound();
   }

   handleChunkKeyNavigation(event) {
       this.chunkManager.handleKeyNavigation(event);
   }

   // Settings management methods remain the same
   async saveSettingsFromModal() {
       return await this.settingsManager.saveSettingsFromModal();
   }

   // Project scanning methods remain the same
   async scanForProjectFiles() {
       await this.projectScanner.scanForProjectFiles();
   }

   async scanForDockerFiles() {
       await this.projectScanner.scanForDockerFiles();
   }

   // Enhanced semantic chunking utility methods
   getSemanticChunkingStats() {
       if (!this.chunkManager.fileChunks || this.chunkManager.fileChunks.length === 0) {
           return null;
       }

       const stats = {
           totalChunks: this.chunkManager.fileChunks.length,
           strategy: this.chunkManager.chunkingStrategy,
           averageSize: 0,
           crossReferences: 0,
           semanticCohesion: 0,
           files: []
       };

       // Calculate statistics
       let totalSize = 0;
       let totalCrossRefs = 0;

       for (const chunk of this.chunkManager.fileChunks) {
           totalSize += chunk.size;
           if (chunk.crossReferences) {
               totalCrossRefs += chunk.crossReferences.length;
           }
       }

       stats.averageSize = totalSize / stats.totalChunks;
       stats.crossReferences = totalCrossRefs;

       return stats;
   }

   // Enhanced settings with chunking preferences
   getEnhancedSettings() {
       return {
           ...this.settingsManager.settings,
           chunkingPreferences: this.chunkingPreferences,
           semanticFeatures: {
               enabled: true,
               version: '1.0.0',
               supportedStrategies: ['semantic', 'size-based', 'hybrid']
           }
       };
   }

   // Advanced semantic analysis trigger
   async performSemanticAnalysis() {
       console.log('🧠 Performing advanced semantic analysis...');
       
       try {
           // Update status
           this.uiManager.updateAIAnalysisStatus({
               type: 'analyzing',
               icon: '🔍',
               text: 'Analyzing code structure...'
           });

           // Analyze project structure
           const projectAnalysis = await this.projectAnalyzer.analyzeProject();
           
           // Analyze content structure if we have generated content
           if (this.generatedFileContent) {
               await this.chunkManager.analyzeCodeStructure(this.generatedFileContent);
           }

           // Update status
           this.uiManager.updateAIAnalysisStatus({
               type: 'complete',
               icon: '✅',
               text: 'Semantic analysis complete'
           });

           console.log('✅ Semantic analysis completed successfully');
           return {
               success: true,
               projectAnalysis,
               chunkingStats: this.getSemanticChunkingStats()
           };

       } catch (error) {
           console.error('❌ Error in semantic analysis:', error);
           
           this.uiManager.updateAIAnalysisStatus({
               type: 'error',
               icon: '❌',
               text: 'Analysis failed'
           });

           return {
               success: false,
               error: error.message
           };
       }
   }

   // Debug and diagnostics methods
   logSemanticChunkingDiagnostics() {
       console.group('🧠 Semantic Chunking Diagnostics');
       
       console.log('Strategy:', this.chunkManager.chunkingStrategy);
       console.log('Preferences:', this.chunkingPreferences);
       console.log('Chunks created:', this.chunkManager.fileChunks?.length || 0);
       
       if (this.chunkManager.fileChunks && this.chunkManager.fileChunks.length > 0) {
           console.log('Chunk details:');
           this.chunkManager.fileChunks.forEach((chunk, index) => {
               console.log(`  Chunk ${index + 1}:`, {
                   size: this.formatFileSize(chunk.size),
                   summary: chunk.semanticSummary,
                   crossRefs: chunk.crossReferences?.length || 0
               });
           });
       }
       
       console.log('Code structure analyzed:', this.chunkManager.codeStructure?.size || 0, 'files');
       console.log('Cross-references:', this.chunkManager.crossReferences?.size || 0);
       console.log('Semantic boundaries:', this.chunkManager.semanticBoundaries?.length || 0);
       
       console.groupEnd();
   }

   // Enhanced error handling and recovery
   handleSemanticChunkingError(error) {
       console.error('🚨 Semantic chunking error:', error);
       
       // Fallback to size-based chunking
       if (this.chunkManager.chunkingStrategy === 'semantic') {
           console.log('🔄 Falling back to size-based chunking...');
           this.chunkManager.chunkingStrategy = 'size-based';
           
           if (this.generatedFileContent) {
               this.chunkManager.processContent(this.generatedFileContent);
           }
           
           // Show user notification
           const notification = document.createElement('div');
           notification.className = 'chunking-fallback-notification';
           notification.textContent = 'Semantic chunking failed, using size-based fallback';
           notification.style.cssText = `
               position: fixed;
               top: 20px;
               right: 20px;
               background: #fd7e14;
               color: white;
               padding: 12px 16px;
               border-radius: 6px;
               font-size: 12px;
               font-weight: 600;
               z-index: 10000;
               animation: slideInRight 0.3s ease, fadeOut 0.3s ease 3s forwards;
           `;
           
           document.body.appendChild(notification);
           setTimeout(() => notification.remove(), 3500);
       }
   }

   // Export enhanced project data
   exportEnhancedProjectData() {
       const data = {
           projectInfo: {
               path: this.currentPath,
               selectedFiles: Array.from(this.selectedFiles),
               timestamp: new Date().toISOString()
           },
           semanticAnalysis: {
               chunkingStrategy: this.chunkManager.chunkingStrategy,
               preferences: this.chunkingPreferences,
               stats: this.getSemanticChunkingStats(),
               codeStructure: this.chunkManager.codeStructure ? 
                   Object.fromEntries(this.chunkManager.codeStructure) : {},
               crossReferences: this.chunkManager.crossReferences ? 
                   Object.fromEntries(this.chunkManager.crossReferences) : {}
           },
           settings: this.getEnhancedSettings()
       };

       return JSON.stringify(data, null, 2);
   }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
   window.fileExplorer = new FileExplorer();
   window.fileExplorer.init();
   
   // Add global keyboard shortcuts for semantic features
   document.addEventListener('keydown', (event) => {
       // Ctrl/Cmd + S + A for semantic analysis
       if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'A') {
           event.preventDefault();
           window.fileExplorer.performSemanticAnalysis();
       }
       
       // Ctrl/Cmd + S + D for diagnostics
       if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'D') {
           event.preventDefault();
           window.fileExplorer.logSemanticChunkingDiagnostics();
       }
   });
   
   console.log('🚀 Enhanced File Explorer with Semantic Chunking initialized');
});