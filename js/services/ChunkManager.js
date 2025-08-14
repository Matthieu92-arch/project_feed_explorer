// js/services/ChunkManager.js
export class ChunkManager {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.fileChunks = [];
        this.currentChunkIndex = 0;
        this.chunkSize = 350000; // 350KB chunks
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
        if (content.length > this.chunkSize) {
            this.fileChunks = this.splitIntoChunks(content, this.chunkSize);
            console.log(`📦 Created ${this.fileChunks.length} chunks from ${content.length} characters`);

            // Add instructions for multi-part content
            this.fileChunks = this.fileChunks.map((chunk, index) => {
                let chunkContent = chunk.content;
                if (index < this.fileChunks.length - 1) {
                    chunkContent = `I'm going to paste multiple parts of my project files. IMPORTANT: Just respond with "Ready for part ${index + 2}" after each part until I say "DONE PASTING". Do not analyze, suggest changes, or provide any code until I finish providing all parts.\n\n${chunkContent}`;
                }
                return {
                    ...chunk,
                    content: chunkContent,
                    size: chunkContent.length
                };
            });
            this.currentChunkIndex = 0;
        } else {
            this.fileChunks = [{
                index: 0,
                label: 'a',
                filename: 'file_a',
                content: content,
                size: content.length,
                startPos: 0,
                endPos: content.length
            }];
            this.currentChunkIndex = 0;
        }
    }

    createChunkNavigation() {
        const nav = document.createElement('div');
        nav.className = 'chunk-navigation';
        
        const header = document.createElement('div');
        header.className = 'chunk-nav-header';
        
        const info = document.createElement('div');
        info.className = 'chunk-info';
        info.innerHTML = `Split into ${this.fileChunks.length} chunks for easier handling`;
        
        header.appendChild(info);
        nav.appendChild(header);
        
        const buttons = document.createElement('div');
        buttons.className = 'chunk-buttons';
        
        this.fileChunks.forEach((chunk, index) => {
            const btn = document.createElement('button');
            btn.className = 'chunk-btn';
            btn.id = `chunkBtn${index}`;
            btn.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
            btn.setAttribute('title', `Switch to ${chunk.filename} (${this.fileExplorer.formatFileSize(chunk.size)})`);
            
            const label = document.createElement('div');
            label.className = 'chunk-btn-label';
            label.textContent = chunk.label.toUpperCase();
            
            const size = document.createElement('div');
            size.className = 'chunk-btn-size';
            size.textContent = this.fileExplorer.formatFileSize(chunk.size);
            
            btn.appendChild(label);
            btn.appendChild(size);
            buttons.appendChild(btn);
        });
        
        nav.appendChild(buttons);
        return nav;
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
        const existingNav = modalBody.querySelector('.chunk-navigation');
        if (existingNav) {
            existingNav.remove();
        }

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
