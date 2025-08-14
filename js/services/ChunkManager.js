// js/services/ChunkManager.js
export class ChunkManager {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.fileChunks = [];
        this.currentChunkIndex = 0;
        this.defaultChunkSize = 350000; // 350KB chunks (minimum)
        this.currentChunkSize = this.defaultChunkSize;
        this.fullContent = '';
        this.maxChunkSize = 0;
        this.isApplyingChanges = false;
    }

    splitIntoChunks(content, chunkSize) {
        const chunks = [];
        let startPos = 0;
        let index = 0;

        while (startPos < content.length) {
            let endPos = startPos + chunkSize;

            if (endPos < content.length) {
                const lastNewline = content.lastIndexOf('\n', endPos);
                if (lastNewline > startPos) {
                    endPos = lastNewline + 1;
                }
            } else {
                endPos = content.length;
            }

            const chunkContent = content.slice(startPos, endPos);
            chunks.push({
                index,
                label: String.fromCharCode(97 + index),
                filename: `file_${String.fromCharCode(97 + index)}`,
                content: chunkContent,
                size: chunkContent.length,
                startPos,
                endPos
            });

            startPos = endPos;
            index++;
        }

        return chunks;
    }

    processContent(content) {
        this.fullContent = content;
        this.maxChunkSize = content.length;
        this.currentChunkSize = Math.min(this.defaultChunkSize, this.maxChunkSize);
        
        this.rechunkContent(this.currentChunkSize);
    }

    rechunkContent(chunkSize) {
        this.currentChunkSize = chunkSize;
        
        // If chunk size is greater than or equal to content length, create single chunk
        if (chunkSize >= this.fullContent.length) {
            this.fileChunks = [{
                index: 0,
                label: 'a',
                filename: 'collected_files',
                content: this.fullContent,
                size: this.fullContent.length,
                startPos: 0,
                endPos: this.fullContent.length
            }];
            this.currentChunkIndex = 0;
            console.log(`📦 Created 1 chunk (full content) of ${this.formatSize(this.fullContent.length)}`);
        } else {
            this.fileChunks = this.splitIntoChunks(this.fullContent, chunkSize);
            console.log(`📦 Created ${this.fileChunks.length} chunks of ~${this.formatSize(chunkSize)} each from ${this.formatSize(this.fullContent.length)} total`);

            // Add instructions for multi-part content
            this.fileChunks = this.fileChunks.map((chunk, index) => {
                let chunkContent = chunk.content;
                if (index < this.fileChunks.length - 1) {
                    chunkContent = `I'm going to paste multiple parts of my project files. IMPORTANT: Just respond with "Ready for part ${index + 2}" after each part until I say "DONE PASTING". Do not analyze, suggest changes, or provide any code until I finish providing all parts.\n\n${chunkContent}`;
                }
                return {
                    ...chunk,
                    filename: `collected_files_part_${chunk.label}`,
                    content: chunkContent,
                    size: chunkContent.length
                };
            });
            this.currentChunkIndex = Math.min(this.currentChunkIndex, this.fileChunks.length - 1);
        }
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    createChunkSizeControl() {
        const control = document.createElement('div');
        control.className = 'chunk-size-control';
        control.id = 'chunkSizeControl';
        
        // Round up to the next 100KB to ensure we can always fit the full content
        const bufferSize = 100000; // 100KB buffer
        const maxSliderValue = Math.ceil(this.maxChunkSize / bufferSize) * bufferSize + bufferSize;
        
        control.innerHTML = `
            <div class="chunk-size-header">
                <div class="chunk-size-title">
                    📦 Chunk Size Control
                </div>
                <div class="chunk-size-info">
                    <span>Total: ${this.formatSize(this.maxChunkSize)}</span>
                    <span>•</span>
                    <span>Min: ${this.formatSize(this.defaultChunkSize)}</span>
                </div>
            </div>
            
            <div class="chunk-size-slider-container">
                <input 
                    type="range" 
                    class="chunk-size-slider" 
                    id="chunkSizeSlider"
                    min="${this.defaultChunkSize}" 
                    max="${maxSliderValue}" 
                    value="${this.currentChunkSize}"
                    step="10000"
                >
                <div class="chunk-size-value" id="chunkSizeValue">
                    ${this.formatSize(this.currentChunkSize)}
                </div>
            </div>
            
            <div class="chunk-size-labels">
                <span>${this.formatSize(this.defaultChunkSize)}</span>
                <span>Max (${this.formatSize(this.maxChunkSize)})</span>
            </div>
            
            <div class="chunk-size-stats">
                <div class="chunk-size-stat">
                    <div class="chunk-size-stat-value" id="chunkCount">${this.fileChunks.length}</div>
                    <div class="chunk-size-stat-label">Chunks</div>
                </div>
                <div class="chunk-size-stat">
                    <div class="chunk-size-stat-value" id="avgChunkSize">${this.formatSize(this.getAverageChunkSize())}</div>
                    <div class="chunk-size-stat-label">Avg Size</div>
                </div>
                <div class="chunk-size-stat">
                    <div class="chunk-size-stat-value" id="largestChunk">${this.formatSize(this.getLargestChunkSize())}</div>
                    <div class="chunk-size-stat-label">Largest</div>
                </div>
                <div class="chunk-size-stat">
                    <div class="chunk-size-stat-value" id="smallestChunk">${this.formatSize(this.getSmallestChunkSize())}</div>
                    <div class="chunk-size-stat-label">Smallest</div>
                </div>
            </div>
        `;
        
        this.setupChunkSizeSlider(control);
        return control;
    }

    setupChunkSizeSlider(control) {
        const slider = control.querySelector('#chunkSizeSlider');
        const valueDisplay = control.querySelector('#chunkSizeValue');
        let updateTimeout;

        slider.addEventListener('input', (e) => {
            let newSize = parseInt(e.target.value);
            
            // If we're at 90% or more of the total content size, treat it as "full content"
            // This ensures we capture the full content even with rounding issues
            if (newSize >= this.maxChunkSize * 0.9) {
                newSize = this.maxChunkSize;
                valueDisplay.textContent = `${this.formatSize(newSize)} (Full)`;
            } else {
                valueDisplay.textContent = this.formatSize(newSize);
            }
            
            // Clear existing timeout
            clearTimeout(updateTimeout);
            
            // Set new timeout for debounced update
            updateTimeout = setTimeout(() => {
                this.updateChunkSize(newSize);
            }, 300); // 300ms delay for smooth sliding
        });

        // Immediate update on mouseup for better UX
        slider.addEventListener('mouseup', () => {
            clearTimeout(updateTimeout);
            let newSize = parseInt(slider.value);
            
            // If we're at 90% or more of the total content size, treat it as "full content"
            if (newSize >= this.maxChunkSize * 0.9) {
                newSize = this.maxChunkSize;
                valueDisplay.textContent = `${this.formatSize(newSize)} (Full)`;
            } else {
                valueDisplay.textContent = this.formatSize(newSize);
            }
            
            this.updateChunkSize(newSize);
        });
    }

    async updateChunkSize(newSize) {
        if (this.isApplyingChanges || newSize === this.currentChunkSize) {
            return;
        }

        this.isApplyingChanges = true;
        
        // Show applying state
        const control = document.getElementById('chunkSizeControl');
        if (control) {
            control.classList.add('chunk-size-applying');
        }

        try {
            // Rechunk the content with new size
            this.rechunkContent(newSize);
            
            // Update the UI
            this.updateChunkNavigation();
            this.updateChunkStats();
            this.switchToChunk(0); // Reset to first chunk
            
            // Update chunk info in content modal
            const chunkInfoItem = document.getElementById('chunkInfoItem');
            if (chunkInfoItem && this.fileChunks.length > 1) {
                chunkInfoItem.style.display = 'flex';
                document.getElementById('currentChunkInfo').textContent = `1/${this.fileChunks.length}`;
            } else if (chunkInfoItem) {
                chunkInfoItem.style.display = 'none';
            }

            // Update copy/download buttons visibility
            const copyAllChunksBtn = document.getElementById('copyAllChunksBtn');
            const downloadAllChunks = document.getElementById('downloadAllChunks');
            
            if (this.fileChunks.length > 1) {
                if (copyAllChunksBtn) copyAllChunksBtn.style.display = 'inline-block';
                if (downloadAllChunks) downloadAllChunks.style.display = 'inline-block';
            } else {
                if (copyAllChunksBtn) copyAllChunksBtn.style.display = 'none';
                if (downloadAllChunks) downloadAllChunks.style.display = 'none';
            }

            console.log(`🔄 Rechunked content: ${this.fileChunks.length} chunks of ~${this.formatSize(newSize)}`);
            
        } catch (error) {
            console.error('Error updating chunk size:', error);
        } finally {
            this.isApplyingChanges = false;
            
            // Remove applying state
            if (control) {
                control.classList.remove('chunk-size-applying');
            }
        }
    }

    updateChunkStats() {
        const chunkCount = document.getElementById('chunkCount');
        const avgChunkSize = document.getElementById('avgChunkSize');
        const largestChunk = document.getElementById('largestChunk');
        const smallestChunk = document.getElementById('smallestChunk');

        if (chunkCount) chunkCount.textContent = this.fileChunks.length;
        if (avgChunkSize) avgChunkSize.textContent = this.formatSize(this.getAverageChunkSize());
        if (largestChunk) largestChunk.textContent = this.formatSize(this.getLargestChunkSize());
        if (smallestChunk) smallestChunk.textContent = this.formatSize(this.getSmallestChunkSize());
    }

    getAverageChunkSize() {
        if (this.fileChunks.length === 0) return 0;
        const totalSize = this.fileChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        return Math.round(totalSize / this.fileChunks.length);
    }

    getLargestChunkSize() {
        if (this.fileChunks.length === 0) return 0;
        return Math.max(...this.fileChunks.map(chunk => chunk.size));
    }

    getSmallestChunkSize() {
        if (this.fileChunks.length === 0) return 0;
        return Math.min(...this.fileChunks.map(chunk => chunk.size));
    }

    createChunkNavigation() {
        const nav = document.createElement('div');
        nav.className = 'chunk-navigation with-size-control';
        nav.id = 'chunkNavigation';
        
        const header = document.createElement('div');
        header.className = 'chunk-nav-header';
        
        const info = document.createElement('div');
        info.className = 'chunk-info';
        info.innerHTML = `
            Split into ${this.fileChunks.length} chunks
            <span class="chunk-size-badge">${this.formatSize(this.currentChunkSize)}</span>
        `;
        
        header.appendChild(info);
        nav.appendChild(header);
        
        const buttons = document.createElement('div');
        buttons.className = 'chunk-buttons';
        
        this.fileChunks.forEach((chunk, index) => {
            const btn = document.createElement('button');
            btn.className = 'chunk-btn';
            btn.id = `chunkBtn${index}`;
            btn.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
            btn.setAttribute('title', `Switch to ${chunk.filename} (${this.formatSize(chunk.size)})`);
            
            const label = document.createElement('div');
            label.className = 'chunk-btn-label';
            label.textContent = chunk.label.toUpperCase();
            
            const size = document.createElement('div');
            size.className = 'chunk-btn-size';
            size.textContent = this.formatSize(chunk.size);
            
            btn.appendChild(label);
            btn.appendChild(size);
            buttons.appendChild(btn);
        });
        
        nav.appendChild(buttons);
        return nav;
    }

    updateChunkNavigation() {
        const existingNav = document.getElementById('chunkNavigation');
        if (existingNav) {
            const newNav = this.createChunkNavigation();
            
            // Setup event listeners for new navigation
            this.fileChunks.forEach((chunk, index) => {
                const btn = newNav.querySelector(`#chunkBtn${index}`);
                if (btn) {
                    btn.addEventListener('click', () => {
                        this.switchToChunk(index);
                        this.fileExplorer.playChunkSound();
                    });
                }
            });
            
            existingNav.replaceWith(newNav);
        }
    }

    setupContentModal(modal, generatedContent) {
        const firstChunk = this.fileChunks[0];
        generatedContent.textContent = firstChunk.content;

        const copyAllChunksBtn = document.getElementById('copyAllChunksBtn');
        const downloadAllChunks = document.getElementById('downloadAllChunks');

        if (this.fileChunks.length > 1) {
            if (copyAllChunksBtn) copyAllChunksBtn.style.display = 'inline-block';
            if (downloadAllChunks) downloadAllChunks.style.display = 'inline-block';

            // Add chunk info
            const chunkInfoItem = document.getElementById('chunkInfoItem');
            if (chunkInfoItem) {
                chunkInfoItem.style.display = 'flex';
                document.getElementById('currentChunkInfo').textContent = `1/${this.fileChunks.length}`;
            }
        } else {
            if (copyAllChunksBtn) copyAllChunksBtn.style.display = 'none';
            if (downloadAllChunks) downloadAllChunks.style.display = 'none';
        }

        const modalBody = modal.querySelector('.modal-body');
        
        // Remove existing controls
        const existingControl = modalBody.querySelector('.chunk-size-control');
        const existingNav = modalBody.querySelector('.chunk-navigation');
        if (existingControl) existingControl.remove();
        if (existingNav) existingNav.remove();

        // Add chunk size control if content can be chunked
        if (this.maxChunkSize > this.defaultChunkSize) {
            const chunkSizeControl = this.createChunkSizeControl();
            modalBody.insertBefore(chunkSizeControl, modalBody.querySelector('.content-display-modal'));
        }

        // Add chunk navigation if needed
        if (this.fileChunks.length > 1) {
            const chunkNavigation = this.createChunkNavigation();
            modalBody.insertBefore(chunkNavigation, modalBody.querySelector('.content-display-modal'));

            this.fileChunks.forEach((chunk, index) => {
                const btn = document.getElementById(`chunkBtn${index}`);
                if (btn) {
                    btn.addEventListener('click', () => {
                        this.switchToChunk(index);
                        this.fileExplorer.playChunkSound();
                    });
                }
            });
        }

        const modalHeader = modal.querySelector('.modal-header h2');
        if (this.fileChunks.length > 1) {
            modalHeader.textContent = `📄 ${firstChunk.filename} (1/${this.fileChunks.length})`;
        } else {
            modalHeader.textContent = '📄 Generated File Content';
        }

        const copyBtn = document.getElementById('copyContentBtn');
        if (copyBtn && this.fileChunks.length > 1) {
            copyBtn.textContent = `📋 Copy ${firstChunk.filename}`;
            copyBtn.classList.add('chunk-copy');
        }
    }

    switchToChunk(index) {
        this.currentChunkIndex = index;
        const generatedContent = document.getElementById('generatedContent');
        const currentChunk = this.fileChunks[index];
        generatedContent.textContent = currentChunk.content;

        const modalHeader = document.querySelector('#contentModal .modal-header h2');
        modalHeader.textContent = `📄 ${currentChunk.filename} (${this.currentChunkIndex + 1}/${this.fileChunks.length})`;

        const copyBtn = document.getElementById('copyContentBtn');
        copyBtn.textContent = `📋 Copy ${currentChunk.filename}`;
        copyBtn.classList.add('chunk-copy');

        document.querySelectorAll('.chunk-btn').forEach((btn, i) => {
            btn.setAttribute('aria-pressed', i === index ? 'true' : 'false');
            if (i === index) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update chunk info
        const chunkInfoItem = document.getElementById('chunkInfoItem');
        if (chunkInfoItem && this.fileChunks.length > 1) {
            document.getElementById('currentChunkInfo').textContent = `${index + 1}/${this.fileChunks.length}`;
        }

        document.getElementById('contentDisplayModal').scrollTop = 0;
    }

    handleKeyNavigation(event) {
        if (event.target.closest('#contentModal') && this.fileChunks.length > 1) {
            if (event.key === 'ArrowRight' && this.currentChunkIndex < this.fileChunks.length - 1) {
                this.switchToChunk(this.currentChunkIndex + 1);
                this.fileExplorer.playChunkSound();
            } else if (event.key === 'ArrowLeft' && this.currentChunkIndex > 0) {
                this.switchToChunk(this.currentChunkIndex - 1);
                this.fileExplorer.playChunkSound();
            }
        }
    }

    async copyCurrentChunk() {
        try {
            const currentChunk = this.fileChunks[this.currentChunkIndex];
            const contentToCopy = currentChunk.content;

            await navigator.clipboard.writeText(contentToCopy);

            const copyBtn = document.getElementById('copyContentBtn');
            const originalText = copyBtn.textContent;

            copyBtn.textContent = `✅ ${currentChunk.filename} Copied!`;
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.classList.remove('copied');
            }, 2000);

        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            alert('❌ Failed to copy to clipboard. Please select and copy manually.');
        }
    }

    async copyAllChunks() {
        try {
            const allContent = this.fileChunks.map(chunk => chunk.content).join('\n');
            await navigator.clipboard.writeText(allContent);

            const copyBtn = document.getElementById('copyAllChunksBtn');
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ All Chunks Copied!';
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.classList.remove('copied');
            }, 2000);
        } catch (error) {
            console.error('Failed to copy all chunks:', error);
            alert('❌ Failed to copy all chunks. Please copy manually.');
        }
    }

    downloadCurrentChunk() {
        const currentChunk = this.fileChunks[this.currentChunkIndex];
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `${currentChunk.filename}_${timestamp}.txt`;

        const blob = new Blob([currentChunk.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        alert(`📥 Download started: ${filename}`);
    }

    downloadAllChunks() {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        
        if (this.fileChunks.length === 1) {
            // Single file download
            const filename = `collected_files_${timestamp}.txt`;
            const blob = new Blob([this.fileChunks[0].content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`📥 Download started: ${filename}`);
        } else {
            // Create individual files for each chunk
            this.fileChunks.forEach((chunk, index) => {
                const filename = `${chunk.filename}_${timestamp}.txt`;
                const blob = new Blob([chunk.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.style.display = 'none';

                document.body.appendChild(a);
                
                // Stagger downloads to avoid browser blocking
                setTimeout(() => {
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, index * 500);
            });

            alert(`📥 Download started: ${this.fileChunks.length} files`);
        }
    }
}