// js/ui/UIManager.js (Enhanced with AI-Optimized Features)
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
        this.entryPointsVisible = false;
        this.relationshipsVisible = false;
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

        // NEW: AI Analysis features toggle buttons
        this.setupAIFeatureToggles();
    }

    setupAIFeatureToggles() {
        // Add AI feature toggle buttons to the header
        const headerRight = document.querySelector('.header-right');
        if (headerRight && !document.getElementById('aiFeatureToggles')) {
            const aiToggles = document.createElement('div');
            aiToggles.id = 'aiFeatureToggles';
            aiToggles.className = 'ai-feature-toggles';
            aiToggles.innerHTML = `
                <button class="ai-toggle-btn" id="toggleEntryPoints" title="Highlight Entry Points">
                    🎯 Entry Points
                </button>
                <button class="ai-toggle-btn" id="toggleRelationships" title="Show File Relationships">
                    🔗 Relationships
                </button>
                <button class="ai-toggle-btn" id="showArchitecture" title="View Architecture Analysis">
                    🏗️ Architecture
                </button>
            `;

            // Insert before settings button
            const settingsBtn = document.getElementById('settingsBtn');
            headerRight.insertBefore(aiToggles, settingsBtn);

            // Add event listeners
            document.getElementById('toggleEntryPoints').addEventListener('click', () => this.toggleEntryPointsHighlight());
            document.getElementById('toggleRelationships').addEventListener('click', () => this.toggleRelationshipsView());
            document.getElementById('showArchitecture').addEventListener('click', () => this.showArchitectureModal());

            // Add CSS for the new buttons
            this.addAIFeatureStyles();
        }
    }

    addAIFeatureStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .ai-feature-toggles {
                display: flex;
                gap: 8px;
                margin-right: 12px;
            }
            
            .ai-toggle-btn {
                background: #21262d;
                color: #7d8590;
                border: 1px solid #30363d;
                padding: 6px 10px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 500;
                transition: all 0.2s;
                white-space: nowrap;
            }
            
            .ai-toggle-btn:hover {
                background: #30363d;
                color: #f0f6fc;
                border-color: #58a6ff;
            }
            
            .ai-toggle-btn.active {
                background: #1f6feb;
                color: white;
                border-color: #1f6feb;
            }
            
            .entry-point-highlight {
                box-shadow: 0 0 0 2px #ffd700 !important;
                background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, transparent 100%) !important;
            }
            
            .entry-point-badge {
                background: #ffd700;
                color: #000;
                font-size: 9px;
                padding: 2px 5px;
                border-radius: 10px;
                margin-left: 6px;
                font-weight: 600;
                animation: entryPointPulse 2s infinite;
            }
            
            @keyframes entryPointPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .relationship-indicator {
                position: absolute;
                right: 8px;
                top: 50%;
                transform: translateY(-50%);
                background: #58a6ff;
                color: white;
                font-size: 9px;
                padding: 2px 5px;
                border-radius: 8px;
                font-weight: 600;
            }
            
            .file-item {
                position: relative;
            }
            
            .architecture-modal {
                max-width: 90%;
                width: 1000px;
            }
            
            .architecture-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-top: 16px;
            }
            
            .architecture-section {
                background: #161b22;
                border: 1px solid #30363d;
                border-radius: 8px;
                padding: 16px;
            }
            
            .architecture-section h4 {
                color: #58a6ff;
                margin-bottom: 12px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .layer-item, .module-item, .pattern-item {
                background: #0d1117;
                border: 1px solid #21262d;
                border-radius: 6px;
                padding: 8px;
                margin-bottom: 8px;
            }
            
            .layer-item h5, .module-item h5, .pattern-item h5 {
                color: #f0f6fc;
                font-size: 12px;
                margin-bottom: 4px;
            }
            
            .layer-files, .module-files {
                font-size: 10px;
                color: #7d8590;
                font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
            }
            
            .confidence-bar {
                width: 100%;
                height: 4px;
                background: #21262d;
                border-radius: 2px;
                overflow: hidden;
                margin-top: 4px;
            }
            
            .confidence-fill {
                height: 100%;
                background: linear-gradient(90deg, #f85149 0%, #fd7e14 50%, #238636 100%);
                transition: width 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }

    toggleEntryPointsHighlight() {
        const btn = document.getElementById('toggleEntryPoints');
        this.entryPointsVisible = !this.entryPointsVisible;
        
        if (this.entryPointsVisible) {
            btn.classList.add('active');
            this.highlightEntryPoints();
        } else {
            btn.classList.remove('active');
            this.removeEntryPointHighlights();
        }
    }

    async highlightEntryPoints() {
        // Get entry points from the content generator
        if (!this.fileExplorer.contentGenerator.entryPoints) {
            // Trigger entry point analysis if not done yet
            const selectedFiles = Array.from(this.fileExplorer.selectedFiles).filter(path => {
                const item = document.querySelector(`[data-path="${path}"]`);
                return !item || item.dataset.type === 'file';
            });
            
            const projectAnalysis = await this.fileExplorer.projectAnalyzer.analyzeProject();
            this.fileExplorer.contentGenerator.identifyEntryPoints(selectedFiles, projectAnalysis);
        }

        // Highlight entry points in the file tree
        this.fileExplorer.contentGenerator.entryPoints.forEach(entryPoint => {
            const fileItem = document.querySelector(`[data-path="${entryPoint.path}"]`);
            if (fileItem) {
                fileItem.classList.add('entry-point-highlight');
                
                // Add entry point badge
                const existingBadge = fileItem.querySelector('.entry-point-badge');
                if (!existingBadge) {
                    const badge = document.createElement('span');
                    badge.className = 'entry-point-badge';
                    badge.textContent = `#${this.fileExplorer.contentGenerator.entryPoints.indexOf(entryPoint) + 1}`;
                    badge.title = `Entry Point: ${entryPoint.description}`;
                    
                    const wrapper = fileItem.querySelector('.file-item-wrapper');
                    if (wrapper) {
                        wrapper.appendChild(badge);
                    }
                }
            }
        });

        console.log(`🎯 Highlighted ${this.fileExplorer.contentGenerator.entryPoints.length} entry points`);
    }

    removeEntryPointHighlights() {
        document.querySelectorAll('.entry-point-highlight').forEach(item => {
            item.classList.remove('entry-point-highlight');
        });
        
        document.querySelectorAll('.entry-point-badge').forEach(badge => {
            badge.remove();
        });
    }

    toggleRelationshipsView() {
        const btn = document.getElementById('toggleRelationships');
        this.relationshipsVisible = !this.relationshipsVisible;
        
        if (this.relationshipsVisible) {
            btn.classList.add('active');
            this.showFileRelationships();
        } else {
            btn.classList.remove('active');
            this.hideFileRelationships();
        }
    }

    async showFileRelationships() {
        // Ensure relationships are analyzed
        if (!this.fileExplorer.contentGenerator.fileRelationships || this.fileExplorer.contentGenerator.fileRelationships.size === 0) {
            const selectedFiles = Array.from(this.fileExplorer.selectedFiles).filter(path => {
                const item = document.querySelector(`[data-path="${path}"]`);
                return !item || item.dataset.type === 'file';
            });
            
            await this.fileExplorer.contentGenerator.analyzeFileRelationships(selectedFiles);
        }

        // Show relationship indicators on files
        for (const [filePath, relationships] of this.fileExplorer.contentGenerator.fileRelationships.entries()) {
            const fileItem = document.querySelector(`[data-path="${filePath}"]`);
            if (fileItem) {
                const connectionCount = relationships.imports.length + relationships.exports.length + relationships.relatedFiles.length;
                
                if (connectionCount > 0) {
                    const indicator = document.createElement('span');
                    indicator.className = 'relationship-indicator';
                    indicator.textContent = connectionCount;
                    indicator.title = `${relationships.imports.length} imports, ${relationships.exports.length} exports, ${relationships.relatedFiles.length} related files`;
                    
                    fileItem.appendChild(indicator);
                }
            }
        }

        console.log(`🔗 Showing relationships for ${this.fileExplorer.contentGenerator.fileRelationships.size} files`);
    }

    hideFileRelationships() {
        document.querySelectorAll('.relationship-indicator').forEach(indicator => {
            indicator.remove();
        });
    }

    showArchitectureModal() {
        // Create and show architecture analysis modal
        this.createArchitectureModal();
    }

    async createArchitectureModal() {
        // Ensure project analysis is complete
        let projectAnalysis = await this.fileExplorer.projectAnalyzer.analyzeProject();
        
        if (!projectAnalysis) {
            alert('❌ Could not analyze project architecture. Please try again.');
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal architecture-modal';
        modal.id = 'architectureModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🏗️ Project Architecture Analysis</h2>
                    <button class="close-btn" id="closeArchitectureModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="architecture-grid">
                        <div class="architecture-section">
                            <h4>🎯 Entry Points</h4>
                            <div id="architectureEntryPoints"></div>
                        </div>
                        
                        <div class="architecture-section">
                            <h4>🏛️ Layer Structure</h4>
                            <div id="architectureLayers"></div>
                        </div>
                        
                        <div class="architecture-section">
                            <h4>📦 Module Analysis</h4>
                            <div id="architectureModules"></div>
                        </div>
                        
                        <div class="architecture-section">
                            <h4>🔗 Coupling Analysis</h4>
                            <div id="architectureCoupling"></div>
                        </div>
                        
                        <div class="architecture-section">
                            <h4>📊 Data Flow Patterns</h4>
                            <div id="architectureDataFlow"></div>
                        </div>
                        
                        <div class="architecture-section">
                            <h4>🎨 Architectural Decisions</h4>
                            <div id="architectureDecisions"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="exportArchitectureBtn">📄 Export Analysis</button>
                    <button class="btn btn-primary" id="closeArchitectureModal2">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Populate content
        this.populateArchitectureModal(projectAnalysis);
        
        // Setup event listeners
        document.getElementById('closeArchitectureModal').addEventListener('click', () => this.closeArchitectureModal());
        document.getElementById('closeArchitectureModal2').addEventListener('click', () => this.closeArchitectureModal());
        document.getElementById('exportArchitectureBtn').addEventListener('click', () => this.exportArchitectureAnalysis(projectAnalysis));
        
        // Show modal
        modal.classList.remove('hidden');
    }

    populateArchitectureModal(analysis) {
        // Entry Points
        const entryPointsContainer = document.getElementById('architectureEntryPoints');
        if (this.fileExplorer.contentGenerator.entryPoints && this.fileExplorer.contentGenerator.entryPoints.length > 0) {
            entryPointsContainer.innerHTML = this.fileExplorer.contentGenerator.entryPoints.slice(0, 5).map((ep, index) => `
                <div class="pattern-item">
                    <h5>#${index + 1} ${ep.fileName}</h5>
                    <div class="layer-files">${ep.type.replace(/_/g, ' ')}</div>
                    <div class="layer-files" style="margin-top: 4px;">${ep.description}</div>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${ep.priority}%"></div>
                    </div>
                </div>
            `).join('');
        } else {
            entryPointsContainer.innerHTML = '<div class="layer-files">No entry points identified</div>';
        }

        // Layer Structure
        const layersContainer = document.getElementById('architectureLayers');
        if (analysis.architecture && analysis.architecture.layers) {
            const layers = analysis.architecture.layers;
            layersContainer.innerHTML = layers.map(layerName => {
                const layerData = this.fileExplorer.projectAnalyzer.codeArchitecture.layerStructure[layerName];
                if (!layerData || layerData.files.length === 0) return '';
                
                return `
                    <div class="layer-item">
                        <h5>${layerName.charAt(0).toUpperCase() + layerName.slice(1)} Layer</h5>
                        <div class="layer-files">${layerData.files.length} files</div>
                        <div class="layer-files">${layerData.dependencies.length} external dependencies</div>
                    </div>
                `;
            }).filter(html => html).join('');
        } else {
            layersContainer.innerHTML = '<div class="layer-files">Layer analysis not available</div>';
        }

        // Module Analysis
        const modulesContainer = document.getElementById('architectureModules');
        if (this.fileExplorer.projectAnalyzer.codeArchitecture.modules.size > 0) {
            const modules = Array.from(this.fileExplorer.projectAnalyzer.codeArchitecture.modules.entries())
                .sort((a, b) => b[1].complexity - a[1].complexity)
                .slice(0, 8);
                
            modulesContainer.innerHTML = modules.map(([modulePath, moduleData]) => {
                const moduleName = modulePath.split('/').pop() || modulePath;
                const responsibilities = Array.from(moduleData.responsibilities).join(', ') || 'utility';
                
                return `
                    <div class="module-item">
                        <h5>${moduleName}</h5>
                        <div class="module-files">${moduleData.files.length} files • Complexity: ${moduleData.complexity}</div>
                        <div class="layer-files">${responsibilities}</div>
                    </div>
                `;
            }).join('');
        } else {
            modulesContainer.innerHTML = '<div class="layer-files">Module analysis not available</div>';
        }

        // Coupling Analysis
        const couplingContainer = document.getElementById('architectureCoupling');
        if (analysis.architecture && analysis.architecture.couplingStats) {
            const stats = analysis.architecture.couplingStats;
            couplingContainer.innerHTML = `
                <div class="pattern-item">
                    <h5>Coupling Metrics</h5>
                    <div class="layer-files">Average Instability: ${stats.averageInstability || 'N/A'}</div>
                    <div class="layer-files">Stable Files: ${stats.stableFiles || 0}</div>
                    <div class="layer-files">Unstable Files: ${stats.highlyUnstableFiles || 0}</div>
                    <div class="layer-files">Total Analyzed: ${stats.totalAnalyzed || 0}</div>
                </div>
            `;
        } else {
            couplingContainer.innerHTML = '<div class="layer-files">Coupling analysis not available</div>';
        }

        // Data Flow Patterns
        const dataFlowContainer = document.getElementById('architectureDataFlow');
        if (this.fileExplorer.projectAnalyzer.codeArchitecture.dataFlowPatterns && 
            this.fileExplorer.projectAnalyzer.codeArchitecture.dataFlowPatterns.length > 0) {
            dataFlowContainer.innerHTML = this.fileExplorer.projectAnalyzer.codeArchitecture.dataFlowPatterns.map(pattern => `
                <div class="pattern-item">
                    <h5>${pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1)}</h5>
                    <div class="layer-files">${pattern.file.split('/').pop()}</div>
                    <div class="layer-files">${pattern.description}</div>
                    <div class="layer-files">Connections: ${pattern.connections || pattern.imports || 'N/A'}</div>
                </div>
            `).join('');
        } else {
            dataFlowContainer.innerHTML = '<div class="layer-files">No significant data flow patterns detected</div>';
        }

        // Architectural Decisions
        const decisionsContainer = document.getElementById('architectureDecisions');
        if (this.fileExplorer.contentGenerator.architecturalDecisions && 
            this.fileExplorer.contentGenerator.architecturalDecisions.length > 0) {
            decisionsContainer.innerHTML = this.fileExplorer.contentGenerator.architecturalDecisions
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 6)
                .map(decision => `
                    <div class="pattern-item">
                        <h5>${decision.pattern}</h5>
                        <div class="layer-files">${decision.description}</div>
                        <div class="layer-files" style="margin-top: 4px;">Evidence: ${decision.evidence}</div>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${decision.confidence}%"></div>
                        </div>
                    </div>
                `).join('');
        } else {
            decisionsContainer.innerHTML = '<div class="layer-files">No architectural decisions detected</div>';
        }
    }

    closeArchitectureModal() {
        const modal = document.getElementById('architectureModal');
        if (modal) {
            modal.remove();
        }
    }

    exportArchitectureAnalysis(analysis) {
        const content = this.generateArchitectureReport(analysis);
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `architecture_analysis_${new Date().toISOString().split('T')[0]}.txt`;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        alert('📄 Architecture analysis exported successfully!');
    }

    generateArchitectureReport(analysis) {
        let report = 'PROJECT ARCHITECTURE ANALYSIS REPORT\n';
        report += '='.repeat(50) + '\n\n';
        report += `Generated: ${new Date().toISOString()}\n`;
        report += `Project: ${this.fileExplorer.currentPath}\n\n`;

        // Entry Points
        if (this.fileExplorer.contentGenerator.entryPoints) {
            report += 'ENTRY POINTS\n';
            report += '-'.repeat(20) + '\n';
            this.fileExplorer.contentGenerator.entryPoints.forEach((ep, index) => {
                report += `${index + 1}. ${ep.fileName} (Priority: ${ep.priority})\n`;
                report += `   Type: ${ep.type}\n`;
                report += `   Description: ${ep.description}\n\n`;
            });
        }

        // Project Types
        if (analysis.projectTypes) {
            report += 'TECHNOLOGY STACK\n';
            report += '-'.repeat(20) + '\n';
            analysis.projectTypes.forEach(pt => {
                report += `• ${pt.name} (${pt.confidence}% confidence)\n`;
                if (pt.subType) report += `  └─ Framework: ${pt.subType}\n`;
            });
            report += '\n';
        }

        // Architecture
        if (analysis.architecture) {
            report += 'ARCHITECTURE SUMMARY\n';
            report += '-'.repeat(20) + '\n';
            report += `Modules: ${analysis.architecture.modules}\n`;
            report += `Data Flow Connections: ${analysis.architecture.dataFlowConnections}\n`;
            report += `Architectural Layers: ${analysis.architecture.layers.join(', ')}\n\n`;
        }

        // Recommendations
        if (analysis.recommendations) {
            report += 'RECOMMENDATIONS\n';
            report += '-'.repeat(20) + '\n';
            analysis.recommendations.forEach(rec => {
                report += `• [${rec.priority.toUpperCase()}] ${rec.message}\n`;
            });
        }

        return report;
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

    // Enhanced utility methods with AI features
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

            if (this.fileExplorer.dockerFiles && this.fileExplorer.dockerFiles.length > 0) {
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

    // NEW: AI Analysis Status Display
    updateAIAnalysisStatus(status) {
        const statusIndicator = document.getElementById('aiAnalysisStatus');
        if (!statusIndicator) {
            const headerLeft = document.querySelector('.header-left');
            const indicator = document.createElement('div');
            indicator.id = 'aiAnalysisStatus';
            indicator.className = 'ai-analysis-status';
            headerLeft.appendChild(indicator);
        }

        const indicator = document.getElementById('aiAnalysisStatus');
        indicator.innerHTML = `
            <span class="status-icon">${status.icon}</span>
            <span class="status-text">${status.text}</span>
        `;
        indicator.className = `ai-analysis-status ${status.type}`;

        // Add status indicator styles if not already added
        if (!document.getElementById('aiStatusStyles')) {
            const style = document.createElement('style');
            style.id = 'aiStatusStyles';
            style.textContent = `
                .ai-analysis-status {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }
                
                .ai-analysis-status.analyzing {
                    background: rgba(255, 193, 7, 0.1);
                    color: #ffc107;
                    border: 1px solid rgba(255, 193, 7, 0.3);
                }
                
                .ai-analysis-status.complete {
                    background: rgba(40, 167, 69, 0.1);
                    color: #28a745;
                    border: 1px solid rgba(40, 167, 69, 0.3);
                }
                
                .ai-analysis-status.error {
                    background: rgba(220, 53, 69, 0.1);
                    color: #dc3545;
                    border: 1px solid rgba(220, 53, 69, 0.3);
                }
                
                .status-icon {
                    animation: statusPulse 2s infinite;
                }
                
                @keyframes statusPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}