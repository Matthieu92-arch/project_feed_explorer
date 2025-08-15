// js/services/SemanticChunkManager.js - Enhanced chunking with semantic awareness
export class SemanticChunkManager {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.semanticChunks = [];
        this.currentChunkIndex = 0;
        this.defaultChunkSize = 100000; // 100KB base size
        this.currentChunkSize = this.defaultChunkSize;
        this.fullContent = '';
        this.maxChunkSize = 0;
        this.isApplyingChanges = false;
        
        // Semantic analysis data
        this.codeStructure = new Map();
        this.crossReferences = new Map();
        this.semanticBoundaries = [];
        this.fileMetadata = new Map();
        
        // Chunking strategies
        this.chunkingStrategy = 'semantic'; // 'semantic' | 'size-based' | 'hybrid'
    }

    async analyzeCodeStructure(content) {
        console.log('🧠 Analyzing code structure for semantic chunking...');
        
        const files = this.parseFilesFromContent(content);
        this.codeStructure.clear();
        this.crossReferences.clear();
        this.fileMetadata.clear();
        
        for (const file of files) {
            await this.analyzeFileStructure(file);
        }
        
        this.identifySemanticBoundaries();
        this.buildCrossReferenceMap();
        
        console.log(`📊 Analysis complete: ${this.codeStructure.size} files, ${this.crossReferences.size} cross-references`);
    }

    parseFilesFromContent(content) {
        const files = [];
        const fileDelimiterRegex = /={80}\nfilename: (.+?)\n.*?\n={80}\n\n([\s\S]*?)(?=\n={80}\nfilename:|$)/g;
        
        let match;
        while ((match = fileDelimiterRegex.exec(content)) !== null) {
            const [, filename, fileContent] = match;
            const startPos = match.index;
            const endPos = match.index + match[0].length;
            
            files.push({
                filename,
                content: fileContent,
                startPos,
                endPos,
                size: match[0].length
            });
        }
        
        return files;
    }

    async analyzeFileStructure(file) {
        const extension = file.filename.split('.').pop().toLowerCase();
        const structure = {
            filename: file.filename,
            startPos: file.startPos,
            endPos: file.endPos,
            size: file.size,
            functions: [],
            classes: [],
            imports: [],
            exports: [],
            dependencies: [],
            semanticBlocks: [],
            complexity: 0
        };

        // Analyze based on file type
        if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            this.analyzeJavaScriptStructure(file.content, structure);
        } else if (extension === 'py') {
            this.analyzePythonStructure(file.content, structure);
        } else if (['java', 'kt'].includes(extension)) {
            this.analyzeJavaStructure(file.content, structure);
        } else if (extension === 'cs') {
            this.analyzeCSharpStructure(file.content, structure);
        } else {
            this.analyzeGenericStructure(file.content, structure);
        }

        this.codeStructure.set(file.filename, structure);
        this.fileMetadata.set(file.filename, {
            type: this.detectFileType(file.filename, file.content),
            priority: this.calculateFilePriority(file.filename, structure),
            relationships: this.findFileRelationships(file.filename, structure)
        });
    }

    analyzeJavaScriptStructure(content, structure) {
        const lines = content.split('\n');
        let currentBlock = null;
        let braceLevel = 0;
        let inMultiLineComment = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Handle multi-line comments
            if (trimmed.includes('/*')) inMultiLineComment = true;
            if (trimmed.includes('*/')) inMultiLineComment = false;
            if (inMultiLineComment) continue;

            // Skip single-line comments
            if (trimmed.startsWith('//')) continue;

            // Track brace levels for block detection
            braceLevel += (line.match(/{/g) || []).length;
            braceLevel -= (line.match(/}/g) || []).length;

            // Detect functions
            const functionMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\()|(\w+)\s*:\s*(?:async\s+)?function|(\w+)\s*\(.*?\)\s*(?:=>|{))/);
            if (functionMatch) {
                const functionName = functionMatch[1] || functionMatch[2] || functionMatch[3] || functionMatch[4];
                if (currentBlock) {
                    currentBlock.endLine = i - 1;
                    structure.semanticBlocks.push(currentBlock);
                }
                
                currentBlock = {
                    type: 'function',
                    name: functionName,
                    startLine: i,
                    endLine: null,
                    importance: this.calculateBlockImportance(functionName, 'function')
                };
                
                structure.functions.push({
                    name: functionName,
                    line: i + 1,
                    type: this.detectFunctionType(line)
                });
            }

            // Detect classes
            const classMatch = line.match(/class\s+(\w+)(?:\s+extends\s+(\w+))?/);
            if (classMatch) {
                const className = classMatch[1];
                if (currentBlock) {
                    currentBlock.endLine = i - 1;
                    structure.semanticBlocks.push(currentBlock);
                }
                
                currentBlock = {
                    type: 'class',
                    name: className,
                    startLine: i,
                    endLine: null,
                    importance: this.calculateBlockImportance(className, 'class'),
                    extends: classMatch[2]
                };
                
                structure.classes.push({
                    name: className,
                    line: i + 1,
                    extends: classMatch[2]
                });
            }

            // Detect imports
            const importMatch = line.match(/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/);
            if (importMatch) {
                structure.imports.push({
                    module: importMatch[4],
                    imports: importMatch[1] ? importMatch[1].split(',').map(s => s.trim()) : [importMatch[2] || importMatch[3]],
                    line: i + 1
                });
            }

            // Detect exports
            const exportMatch = line.match(/export\s+(?:default\s+)?(?:(?:const|let|var|function|class)\s+)?(\w+)/);
            if (exportMatch) {
                structure.exports.push({
                    name: exportMatch[1],
                    line: i + 1,
                    isDefault: line.includes('export default')
                });
            }
        }

        // Close the last block
        if (currentBlock) {
            currentBlock.endLine = lines.length - 1;
            structure.semanticBlocks.push(currentBlock);
        }

        structure.complexity = this.calculateComplexity(structure);
    }

    analyzePythonStructure(content, structure) {
        const lines = content.split('\n');
        let currentBlock = null;
        let indentLevel = 0;
        let inDocstring = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            const currentIndent = line.length - line.trimStart().length;

            // Handle docstrings
            if (trimmed.includes('"""') || trimmed.includes("'''")) {
                inDocstring = !inDocstring;
                continue;
            }
            if (inDocstring) continue;

            // Skip comments
            if (trimmed.startsWith('#')) continue;

            // Detect functions
            const functionMatch = line.match(/def\s+(\w+)\s*\(/);
            if (functionMatch) {
                const functionName = functionMatch[1];
                if (currentBlock && currentIndent <= indentLevel) {
                    currentBlock.endLine = i - 1;
                    structure.semanticBlocks.push(currentBlock);
                }
                
                indentLevel = currentIndent;
                currentBlock = {
                    type: 'function',
                    name: functionName,
                    startLine: i,
                    endLine: null,
                    indentLevel: currentIndent,
                    importance: this.calculateBlockImportance(functionName, 'function')
                };
                
                structure.functions.push({
                    name: functionName,
                    line: i + 1,
                    isPrivate: functionName.startsWith('_'),
                    isSpecial: functionName.startsWith('__') && functionName.endsWith('__')
                });
            }

            // Detect classes
            const classMatch = line.match(/class\s+(\w+)(?:\(([^)]+)\))?:/);
            if (classMatch) {
                const className = classMatch[1];
                if (currentBlock && currentIndent <= indentLevel) {
                    currentBlock.endLine = i - 1;
                    structure.semanticBlocks.push(currentBlock);
                }
                
                indentLevel = currentIndent;
                currentBlock = {
                    type: 'class',
                    name: className,
                    startLine: i,
                    endLine: null,
                    indentLevel: currentIndent,
                    importance: this.calculateBlockImportance(className, 'class'),
                    inherits: classMatch[2] ? classMatch[2].split(',').map(s => s.trim()) : []
                };
                
                structure.classes.push({
                    name: className,
                    line: i + 1,
                    inherits: classMatch[2] ? classMatch[2].split(',').map(s => s.trim()) : []
                });
            }

            // Detect imports
            const importMatch = line.match(/(?:from\s+([^\s]+)\s+)?import\s+([^\n]+)/);
            if (importMatch) {
                structure.imports.push({
                    module: importMatch[1] || 'builtin',
                    imports: importMatch[2].split(',').map(s => s.trim()),
                    line: i + 1
                });
            }
        }

        // Close the last block
        if (currentBlock) {
            currentBlock.endLine = lines.length - 1;
            structure.semanticBlocks.push(currentBlock);
        }

        structure.complexity = this.calculateComplexity(structure);
    }

    analyzeGenericStructure(content, structure) {
        // For non-code files, create semantic blocks based on sections
        const lines = content.split('\n');
        let currentBlock = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Detect headers/sections (markdown, config files, etc.)
            if (trimmed.match(/^#+\s+/) || // Markdown headers
                trimmed.match(/^\[.+\]$/) || // Config sections
                trimmed.match(/^[A-Z][A-Z0-9_\s]+:?\s*$/) || // ALL CAPS headers
                (trimmed.length > 0 && line === line.toUpperCase() && !line.match(/[a-z]/))) {
                
                if (currentBlock) {
                    currentBlock.endLine = i - 1;
                    structure.semanticBlocks.push(currentBlock);
                }
                
                currentBlock = {
                    type: 'section',
                    name: trimmed.replace(/^#+\s*|\[|\]|:$/g, ''),
                    startLine: i,
                    endLine: null,
                    importance: 5 // Default importance for sections
                };
            }
        }

        // Close the last block
        if (currentBlock) {
            currentBlock.endLine = lines.length - 1;
            structure.semanticBlocks.push(currentBlock);
        }

        structure.complexity = structure.semanticBlocks.length;
    }

    calculateBlockImportance(name, type) {
        let importance = 5; // Base importance

        // Higher importance for common patterns
        const highImportancePatterns = [
            'main', 'index', 'init', 'constructor', 'setup', 'configure',
            'render', 'componentDidMount', 'useEffect', 'ngOnInit',
            'onCreate', 'onStart', 'onResume'
        ];

        const mediumImportancePatterns = [
            'handler', 'controller', 'service', 'manager', 'factory',
            'component', 'view', 'model', 'api', 'route'
        ];

        if (type === 'class') importance += 3;
        if (type === 'function' && name.startsWith('_')) importance -= 2; // Private functions
        if (name.toLowerCase().includes('test')) importance -= 1;
        if (name.toLowerCase().includes('util') || name.toLowerCase().includes('helper')) importance -= 1;

        for (const pattern of highImportancePatterns) {
            if (name.toLowerCase().includes(pattern)) {
                importance += 3;
                break;
            }
        }

        for (const pattern of mediumImportancePatterns) {
            if (name.toLowerCase().includes(pattern)) {
                importance += 2;
                break;
            }
        }

        return Math.max(1, Math.min(10, importance)); // Clamp between 1-10
    }

    calculateComplexity(structure) {
        return structure.functions.length * 2 + 
               structure.classes.length * 3 + 
               structure.imports.length + 
               structure.exports.length;
    }

    identifySemanticBoundaries() {
        console.log('🎯 Identifying semantic boundaries...');
        this.semanticBoundaries = [];

        const sortedFiles = Array.from(this.codeStructure.entries())
            .sort((a, b) => a[1].startPos - b[1].startPos);

        for (const [filename, structure] of sortedFiles) {
            // File boundaries are always semantic boundaries
            this.semanticBoundaries.push({
                type: 'file_start',
                position: structure.startPos,
                filename,
                importance: 10,
                description: `Start of ${filename}`
            });

            // Add boundaries for important semantic blocks within files
            for (const block of structure.semanticBlocks) {
                if (block.importance >= 7) { // Only high-importance blocks
                    const blockStartPos = structure.startPos + this.lineToPosition(structure, block.startLine);
                    this.semanticBoundaries.push({
                        type: `${block.type}_start`,
                        position: blockStartPos,
                        filename,
                        blockName: block.name,
                        importance: block.importance,
                        description: `${block.type} ${block.name} in ${filename}`
                    });
                }
            }

            this.semanticBoundaries.push({
                type: 'file_end',
                position: structure.endPos,
                filename,
                importance: 8,
                description: `End of ${filename}`
            });
        }

        // Sort boundaries by position
        this.semanticBoundaries.sort((a, b) => a.position - b.position);
    }

    lineToPosition(structure, lineNumber) {
        // Simple approximation - in a real implementation, you'd track actual positions
        const avgLineLength = structure.size / (structure.endPos - structure.startPos) * 80;
        return lineNumber * avgLineLength;
    }

    buildCrossReferenceMap() {
        console.log('🔗 Building cross-reference map...');
        
        for (const [filename, structure] of this.codeStructure.entries()) {
            const references = new Set();

            // Find references to other files through imports
            for (const imp of structure.imports) {
                const referencedFile = this.findFileByModule(imp.module);
                if (referencedFile) {
                    references.add({
                        type: 'import',
                        target: referencedFile,
                        items: imp.imports,
                        line: imp.line
                    });
                }
            }

            // Find function/class references within the same file
            for (const func of structure.functions) {
                const callers = this.findFunctionCallers(filename, func.name);
                for (const caller of callers) {
                    references.add({
                        type: 'function_call',
                        target: caller.filename,
                        function: func.name,
                        line: caller.line
                    });
                }
            }

            this.crossReferences.set(filename, Array.from(references));
        }
    }

    findFileByModule(moduleName) {
        // Simple heuristic to find files by module name
        for (const filename of this.codeStructure.keys()) {
            const baseName = filename.split('.')[0];
            if (moduleName.includes(baseName) || baseName.includes(moduleName)) {
                return filename;
            }
        }
        return null;
    }

    findFunctionCallers(filename, functionName) {
        const callers = [];
        for (const [file, structure] of this.codeStructure.entries()) {
            if (file === filename) continue;
            
            // Simple pattern matching for function calls
            const content = this.getFileContent(file);
            if (content && content.includes(functionName + '(')) {
                callers.push({ filename: file, line: 0 }); // Simplified
            }
        }
        return callers;
    }

    getFileContent(filename) {
        const structure = this.codeStructure.get(filename);
        if (!structure) return null;
        
        return this.fullContent.substring(structure.startPos, structure.endPos);
    }

    createSemanticChunks(content, targetChunkSize) {
        console.log(`🧩 Creating semantic chunks with target size ${this.formatSize(targetChunkSize)}...`);
        
        this.semanticChunks = [];
        let currentChunk = null;
        let currentPosition = 0;

        // Sort boundaries by position for sequential processing
        const boundaries = [...this.semanticBoundaries].sort((a, b) => a.position - b.position);
        
        for (let i = 0; i < boundaries.length; i++) {
            const boundary = boundaries[i];
            const nextBoundary = boundaries[i + 1];
            
            if (!nextBoundary) break;

            const sectionContent = content.substring(boundary.position, nextBoundary.position);
            const sectionSize = sectionContent.length;

            // Start a new chunk if needed
            if (!currentChunk) {
                currentChunk = this.createNewChunk(currentPosition);
            }

            // Check if adding this section would exceed the target size
            if (currentChunk.content.length + sectionSize > targetChunkSize && currentChunk.content.length > 0) {
                // Finalize current chunk
                this.finalizeChunk(currentChunk);
                this.semanticChunks.push(currentChunk);
                
                // Start new chunk
                currentChunk = this.createNewChunk(boundary.position);
            }

            // Add section to current chunk
            currentChunk.content += sectionContent;
            currentChunk.endPos = nextBoundary.position;
            currentChunk.boundaries.push(boundary);
            currentChunk.size = currentChunk.content.length;

            // Track files and semantic elements in this chunk
            if (!currentChunk.files.has(boundary.filename)) {
                currentChunk.files.set(boundary.filename, {
                    boundaries: [],
                    functions: [],
                    classes: [],
                    importance: 0
                });
            }

            const fileInfo = currentChunk.files.get(boundary.filename);
            fileInfo.boundaries.push(boundary);
            fileInfo.importance = Math.max(fileInfo.importance, boundary.importance);

            currentPosition = nextBoundary.position;
        }

        // Finalize the last chunk
        if (currentChunk && currentChunk.content.length > 0) {
            this.finalizeChunk(currentChunk);
            this.semanticChunks.push(currentChunk);
        }

        // Enhance chunks with cross-references and instructions
        this.enhanceChunksWithReferences();
        this.generateChunkInstructions();

        console.log(`✅ Created ${this.semanticChunks.length} semantic chunks`);
        return this.semanticChunks;
    }

    createNewChunk(startPos) {
        return {
            index: this.semanticChunks.length,
            label: String.fromCharCode(97 + this.semanticChunks.length),
            startPos,
            endPos: startPos,
            content: '',
            size: 0,
            boundaries: [],
            files: new Map(),
            crossReferences: [],
            semanticSummary: '',
            aiInstructions: '',
            filename: ''
        };
    }

    finalizeChunk(chunk) {
        // Generate semantic summary
        const fileNames = Array.from(chunk.files.keys());
        const mainFiles = fileNames.slice(0, 3);
        
        chunk.semanticSummary = this.generateSemanticSummary(chunk);
        chunk.filename = `semantic_chunk_${chunk.label}_${mainFiles.join('_').replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Calculate chunk importance
        let totalImportance = 0;
        for (const fileInfo of chunk.files.values()) {
            totalImportance += fileInfo.importance;
        }
        chunk.importance = totalImportance / chunk.files.size;
    }

    generateSemanticSummary(chunk) {
        const fileNames = Array.from(chunk.files.keys());
        const totalFunctions = Array.from(chunk.files.values())
            .reduce((sum, fileInfo) => sum + fileInfo.functions.length, 0);
        const totalClasses = Array.from(chunk.files.values())
            .reduce((sum, fileInfo) => sum + fileInfo.classes.length, 0);

        let summary = `Semantic chunk containing ${fileNames.length} file(s)`;
        if (fileNames.length <= 3) {
            summary += `: ${fileNames.join(', ')}`;
        } else {
            summary += ` including ${fileNames.slice(0, 2).join(', ')} and ${fileNames.length - 2} others`;
        }

        if (totalFunctions > 0 || totalClasses > 0) {
            summary += ` with ${totalFunctions} function(s) and ${totalClasses} class(es)`;
        }

        return summary;
    }

    enhanceChunksWithReferences() {
        console.log('🔗 Enhancing chunks with cross-references...');
        
        for (let i = 0; i < this.semanticChunks.length; i++) {
            const chunk = this.semanticChunks[i];
            const references = [];

            // Find references to other chunks
            for (const filename of chunk.files.keys()) {
                const fileCrossRefs = this.crossReferences.get(filename) || [];
                
                for (const ref of fileCrossRefs) {
                    const targetChunkIndex = this.findChunkContaining(ref.target);
                    if (targetChunkIndex !== -1 && targetChunkIndex !== i) {
                        references.push({
                            type: ref.type,
                            targetChunk: targetChunkIndex,
                            targetFile: ref.target,
                            description: this.formatReference(ref)
                        });
                    }
                }
            }

            chunk.crossReferences = references;
        }
    }

    findChunkContaining(filename) {
        for (let i = 0; i < this.semanticChunks.length; i++) {
            if (this.semanticChunks[i].files.has(filename)) {
                return i;
            }
        }
        return -1;
    }

    formatReference(ref) {
        switch (ref.type) {
            case 'import':
                return `imports ${ref.items.join(', ')} from ${ref.target}`;
            case 'function_call':
                return `calls function ${ref.function} in ${ref.target}`;
            default:
                return `references ${ref.target}`;
        }
    }

    generateChunkInstructions() {
        console.log('📝 Generating AI instructions for each chunk...');
        
        for (let i = 0; i < this.semanticChunks.length; i++) {
            const chunk = this.semanticChunks[i];
            let instructions = [];

            // Base instructions
            if (i === 0) {
                instructions.push("FIRST CHUNK: Start by understanding the overall project structure and main entry points.");
            } else if (i === this.semanticChunks.length - 1) {
                instructions.push("FINAL CHUNK: Complete your analysis and provide comprehensive recommendations.");
            } else {
                instructions.push(`CHUNK ${i + 1}/${this.semanticChunks.length}: Continue analysis building on previous context.`);
            }

            // Semantic context
            instructions.push(`SEMANTIC CONTEXT: ${chunk.semanticSummary}`);

            // Cross-references
            if (chunk.crossReferences.length > 0) {
                const refChunks = [...new Set(chunk.crossReferences.map(r => r.targetChunk + 1))];
                instructions.push(`CROSS-REFERENCES: This chunk references code in chunk(s) ${refChunks.join(', ')}`);
                
                for (const ref of chunk.crossReferences.slice(0, 3)) { // Limit to first 3
                    instructions.push(`  → ${ref.description}`);
                }
            }

            // File-specific guidance
            const primaryFiles = Array.from(chunk.files.entries())
                .sort((a, b) => b[1].importance - a[1].importance)
                .slice(0, 2);
            
            if (primaryFiles.length > 0) {
                instructions.push(`PRIMARY FOCUS: Pay special attention to ${primaryFiles.map(([name]) => name).join(' and ')}`);
            }

            // Processing instructions
            if (chunk.crossReferences.length > 0) {
                instructions.push("ANALYSIS APPROACH: Note relationships with other chunks for comprehensive understanding.");
            }

            instructions.push("IMPORTANT: Analyze this chunk in context of the overall project architecture.");

            chunk.aiInstructions = instructions.join('\n');
        }
    }

    processContent(content) {
        this.fullContent = content;
        this.maxChunkSize = content.length;
        this.currentChunkSize = Math.min(this.defaultChunkSize, this.maxChunkSize);
        
        // Analyze the code structure first
        this.analyzeCodeStructure(content).then(() => {
            this.createSemanticChunksFromContent(this.currentChunkSize);
        });
    }

    createSemanticChunksFromContent(chunkSize) {
        if (this.chunkingStrategy === 'semantic' && this.semanticBoundaries.length > 0) {
            this.semanticChunks = this.createSemanticChunks(this.fullContent, chunkSize);
        } else {
            // Fallback to size-based chunking
            this.semanticChunks = this.createSizeBasedChunks(this.fullContent, chunkSize);
        }
        
        // Convert to the format expected by the UI
        this.fileChunks = this.semanticChunks.map(chunk => ({
            index: chunk.index,
            label: chunk.label,
            filename: chunk.filename,
            content: this.wrapChunkWithInstructions(chunk),
            size: chunk.content.length,
            startPos: chunk.startPos,
            endPos: chunk.endPos,
            semanticSummary: chunk.semanticSummary,
            crossReferences: chunk.crossReferences
        }));
    }

    wrapChunkWithInstructions(chunk) {
        let wrappedContent = '';
        
        // Add AI instructions at the beginning
        if (chunk.index < this.semanticChunks.length - 1) {
            wrappedContent += `I'm providing a semantic chunk of my project files. `;
            wrappedContent += `IMPORTANT: Just respond with "Ready for semantic chunk ${chunk.index + 2}" `;
            wrappedContent += `after receiving this chunk. Do not analyze until I say "DONE WITH ALL CHUNKS".\n\n`;
        }
        
        wrappedContent += `SEMANTIC CHUNK ${chunk.index + 1}/${this.semanticChunks.length}\n`;
        wrappedContent += `${'='.repeat(60)}\n\n`;
        
        wrappedContent += `CHUNK METADATA:\n`;
        wrappedContent += `- Files: ${Array.from(chunk.files.keys()).join(', ')}\n`;
        wrappedContent += `- Size: ${this.formatSize(chunk.size)}\n`;
        wrappedContent += `- Semantic Summary: ${chunk.semanticSummary}\n`;
        
        if (chunk.crossReferences.length > 0) {
            wrappedContent += `- Cross-references: ${chunk.crossReferences.length} reference(s) to other chunks\n`;
        }
        
        wrappedContent += `\n${chunk.aiInstructions}\n\n`;
        wrappedContent += `CODE OUTPUT RULES:\n`;
        wrappedContent += `- Only write code when user explicitly requests it\n`;
        wrappedContent += `- Always use code artifacts for any code/file output\n`;
        wrappedContent += `- Do NOT write code for analysis or general questions\n\n`;
        
        wrappedContent += `CHUNK CONTENT:\n`;
        wrappedContent += `${'='.repeat(60)}\n\n`;
        
        wrappedContent += chunk.content;
        
        if (chunk.index === this.semanticChunks.length - 1) {
            wrappedContent += `\n\nDONE WITH ALL CHUNKS\n`;
            wrappedContent += `\nYou can now analyze the complete project. `;
            wrappedContent += `Use the semantic relationships and cross-references to understand the architecture.`;
        }
        
        return wrappedContent;
    }

    createSizeBasedChunks(content, chunkSize) {
        // Fallback to the original size-based chunking
        const chunks = [];
        let startPos = 0;
        let index = 0;

        while (startPos < content.length) {
            let endPos = startPos + chunkSize;

            if (endPos < content.length) {
                // Try to break at a good boundary
                const lastNewline = content.lastIndexOf('\n', endPos);
                const lastFileEnd = content.lastIndexOf('='.repeat(80), endPos);
                
                if (lastFileEnd > startPos && lastFileEnd > lastNewline) {
                    // Break at file boundary if available
                    endPos = content.indexOf('\n', lastFileEnd) + 1;
                } else if (lastNewline > startPos) {
                    // Break at line boundary
                    endPos = lastNewline + 1;
                }
            } else {
                endPos = content.length;
            }

            const chunkContent = content.slice(startPos, endPos);
            chunks.push({
                index,
                label: String.fromCharCode(97 + index),
                filename: `size_based_chunk_${String.fromCharCode(97 + index)}`,
                content: chunkContent,
                size: chunkContent.length,
                startPos,
                endPos,
                semanticSummary: `Size-based chunk ${index + 1}`,
                crossReferences: [],
                files: new Map()
            });

            startPos = endPos;
            index++;
        }

        return chunks;
    }

    // Enhanced chunk navigation and management methods
    switchToChunk(index) {
        this.currentChunkIndex = index;
        const generatedContent = document.getElementById('generatedContent');
        const currentChunk = this.fileChunks[index];
        generatedContent.textContent = currentChunk.content;

        // Update modal header with semantic information
        const modalHeader = document.querySelector('#contentModal .modal-header h2');
        if (currentChunk.semanticSummary) {
            modalHeader.textContent = `📦 ${currentChunk.filename} (${this.currentChunkIndex + 1}/${this.fileChunks.length}) - ${currentChunk.semanticSummary}`;
        } else {
            modalHeader.textContent = `📦 ${currentChunk.filename} (${this.currentChunkIndex + 1}/${this.fileChunks.length})`;
        }

        // Update copy button
        const copyBtn = document.getElementById('copyContentBtn');
        copyBtn.textContent = `📋 Copy ${currentChunk.filename}`;
        copyBtn.classList.add('chunk-copy');

        // Update chunk navigation buttons
        document.querySelectorAll('.chunk-btn').forEach((btn, i) => {
            btn.setAttribute('aria-pressed', i === index ? 'true' : 'false');
            if (i === index) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update chunk info display
        const chunkInfoItem = document.getElementById('chunkInfoItem');
        if (chunkInfoItem && this.fileChunks.length > 1) {
            document.getElementById('currentChunkInfo').textContent = `${index + 1}/${this.fileChunks.length}`;
        }

        // Show cross-reference information if available
        this.updateCrossReferenceDisplay(currentChunk);

        document.getElementById('contentDisplayModal').scrollTop = 0;
    }

    updateCrossReferenceDisplay(chunk) {
        // Remove existing cross-reference display
        const existingDisplay = document.getElementById('crossReferenceDisplay');
        if (existingDisplay) {
            existingDisplay.remove();
        }

        if (chunk.crossReferences && chunk.crossReferences.length > 0) {
            const modal = document.getElementById('contentModal');
            const modalBody = modal.querySelector('.modal-body');
            
            const crossRefDisplay = document.createElement('div');
            crossRefDisplay.id = 'crossReferenceDisplay';
            crossRefDisplay.className = 'cross-reference-display';
            crossRefDisplay.innerHTML = `
                <div class="cross-ref-header">
                    <h4>🔗 Cross-References (${chunk.crossReferences.length})</h4>
                    <button class="cross-ref-toggle" onclick="this.parentElement.parentElement.classList.toggle('expanded')">
                        <span class="toggle-icon">▼</span>
                    </button>
                </div>
                <div class="cross-ref-content">
                    ${chunk.crossReferences.map(ref => `
                        <div class="cross-ref-item">
                            <button class="cross-ref-link" onclick="window.fileExplorer.chunkManager.navigateToReferencedChunk(${ref.targetChunk})">
                                📍 Chunk ${ref.targetChunk + 1}: ${ref.description}
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;

            // Insert after content info but before chunk navigation
            const contentInfo = modalBody.querySelector('.content-info');
            if (contentInfo) {
                modalBody.insertBefore(crossRefDisplay, contentInfo.nextSibling);
            }

            // Add CSS for cross-reference display
            this.addCrossReferenceStyles();
        }
    }

    addCrossReferenceStyles() {
        if (document.getElementById('crossRefStyles')) return;

        const style = document.createElement('style');
        style.id = 'crossRefStyles';
        style.textContent = `
            .cross-reference-display {
                background: #161b22;
                border: 1px solid #30363d;
                border-radius: 8px;
                margin: 16px 20px;
                overflow: hidden;
                transition: all 0.3s ease;
            }

            .cross-ref-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background: #21262d;
                border-bottom: 1px solid #30363d;
                cursor: pointer;
            }

            .cross-ref-header h4 {
                margin: 0;
                font-size: 13px;
                color: #58a6ff;
                font-weight: 600;
            }

            .cross-ref-toggle {
                background: none;
                border: none;
                color: #7d8590;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .cross-ref-toggle:hover {
                background: #30363d;
                color: #f0f6fc;
            }

            .toggle-icon {
                display: inline-block;
                transition: transform 0.3s ease;
            }

            .cross-reference-display.expanded .toggle-icon {
                transform: rotate(180deg);
            }

            .cross-ref-content {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }

            .cross-reference-display.expanded .cross-ref-content {
                max-height: 200px;
                overflow-y: auto;
            }

            .cross-ref-item {
                border-bottom: 1px solid #21262d;
            }

            .cross-ref-item:last-child {
                border-bottom: none;
            }

            .cross-ref-link {
                width: 100%;
                padding: 10px 16px;
                background: none;
                border: none;
                color: #f0f6fc;
                text-align: left;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .cross-ref-link:hover {
                background: #30363d;
                color: #58a6ff;
            }

            .cross-ref-content::-webkit-scrollbar {
                width: 6px;
            }

            .cross-ref-content::-webkit-scrollbar-track {
                background: #161b22;
            }

            .cross-ref-content::-webkit-scrollbar-thumb {
                background: #30363d;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);
    }

    navigateToReferencedChunk(targetChunkIndex) {
        if (targetChunkIndex >= 0 && targetChunkIndex < this.fileChunks.length) {
            this.switchToChunk(targetChunkIndex);
            this.fileExplorer.playChunkSound();
            
            // Show a brief notification
            this.showNavigationNotification(targetChunkIndex);
        }
    }

    showNavigationNotification(chunkIndex) {
        const notification = document.createElement('div');
        notification.className = 'chunk-navigation-notification';
        notification.textContent = `Navigated to Chunk ${chunkIndex + 1}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #238636;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            z-index: 10000;
            animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2s forwards;
        `;

        document.body.appendChild(notification);

        // Add animation styles if not present
        if (!document.getElementById('chunkNavAnimations')) {
            const style = document.createElement('style');
            style.id = 'chunkNavAnimations';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            notification.remove();
        }, 2500);
    }

    createChunkNavigation() {
        const nav = document.createElement('div');
        nav.className = 'chunk-navigation with-size-control semantic-enhanced';
        nav.id = 'chunkNavigation';
        
        const header = document.createElement('div');
        header.className = 'chunk-nav-header';
        
        const info = document.createElement('div');
        info.className = 'chunk-info';
        info.innerHTML = `
            <span class="chunk-strategy">🧠 Semantic Chunking</span>
            <span class="chunk-count">${this.fileChunks.length} chunks</span>
            <span class="chunk-size-badge">${this.formatSize(this.currentChunkSize)} target</span>
        `;
        
        header.appendChild(info);
        nav.appendChild(header);
        
        const buttons = document.createElement('div');
        buttons.className = 'chunk-buttons semantic-buttons';
        
        this.fileChunks.forEach((chunk, index) => {
            const btn = document.createElement('button');
            btn.className = 'chunk-btn semantic-chunk-btn';
            btn.id = `chunkBtn${index}`;
            btn.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
            
            const summary = chunk.semanticSummary || `Chunk ${index + 1}`;
            btn.setAttribute('title', `${summary} (${this.formatSize(chunk.size)})`);
            
            const label = document.createElement('div');
            label.className = 'chunk-btn-label';
            label.textContent = chunk.label.toUpperCase();
            
            const semantic = document.createElement('div');
            semantic.className = 'chunk-btn-semantic';
            semantic.textContent = this.getChunkTypeIndicator(chunk);
            
            const size = document.createElement('div');
            size.className = 'chunk-btn-size';
            size.textContent = this.formatSize(chunk.size);
            
            // Add cross-reference indicator
            if (chunk.crossReferences && chunk.crossReferences.length > 0) {
                const crossRefBadge = document.createElement('div');
                crossRefBadge.className = 'chunk-cross-ref-badge';
                crossRefBadge.textContent = chunk.crossReferences.length;
                crossRefBadge.title = `${chunk.crossReferences.length} cross-reference(s)`;
                btn.appendChild(crossRefBadge);
            }
            
            btn.appendChild(label);
            btn.appendChild(semantic);
            btn.appendChild(size);
            buttons.appendChild(btn);
        });
        
        nav.appendChild(buttons);
        
        // Add semantic chunking styles
        this.addSemanticChunkingStyles();
        
        return nav;
    }

    getChunkTypeIndicator(chunk) {
        if (chunk.semanticSummary) {
            if (chunk.semanticSummary.includes('class')) return '🏗️ Classes';
            if (chunk.semanticSummary.includes('function')) return '⚙️ Functions';
            if (chunk.semanticSummary.includes('config')) return '⚙️ Config';
            if (chunk.semanticSummary.includes('test')) return '🧪 Tests';
            if (chunk.semanticSummary.includes('api')) return '🌐 API';
            if (chunk.semanticSummary.includes('component')) return '🧩 Components';
        }
        return '📄 Code';
    }

    addSemanticChunkingStyles() {
        if (document.getElementById('semanticChunkStyles')) return;

        const style = document.createElement('style');
        style.id = 'semanticChunkStyles';
        document.head.appendChild(style);
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Methods for chunk size control and regeneration
    rechunkContent(chunkSize) {
        this.currentChunkSize = chunkSize;
        
        if (chunkSize >= this.fullContent.length) {
            this.createSemanticChunksFromContent(this.fullContent.length);
        } else {
            this.createSemanticChunksFromContent(chunkSize);
        }
    }

    updateChunkSize(newSize) {
        if (this.isApplyingChanges || newSize === this.currentChunkSize) {
            return;
        }

        this.isApplyingChanges = true;
        
        const control = document.getElementById('chunkSizeControl');
        if (control) {
            control.classList.add('chunk-size-applying');
        }

        try {
            this.rechunkContent(newSize);
            this.updateChunkNavigation();
            this.updateChunkStats();
            this.switchToChunk(0);
            
            const chunkInfoItem = document.getElementById('chunkInfoItem');
            if (chunkInfoItem && this.fileChunks.length > 1) {
                chunkInfoItem.style.display = 'flex';
                document.getElementById('currentChunkInfo').textContent = `1/${this.fileChunks.length}`;
            } else if (chunkInfoItem) {
                chunkInfoItem.style.display = 'none';
            }

            const copyAllChunksBtn = document.getElementById('copyAllChunksBtn');
            const downloadAllChunks = document.getElementById('downloadAllChunks');
            
            if (this.fileChunks.length > 1) {
                if (copyAllChunksBtn) copyAllChunksBtn.style.display = 'inline-block';
                if (downloadAllChunks) downloadAllChunks.style.display = 'inline-block';
            } else {
                if (copyAllChunksBtn) copyAllChunksBtn.style.display = 'none';
                if (downloadAllChunks) downloadAllChunks.style.display = 'none';
            }

            console.log(`🔄 Semantic rechunking complete: ${this.fileChunks.length} chunks`);
            
        } catch (error) {
            console.error('Error updating chunk size:', error);
        } finally {
            this.isApplyingChanges = false;
            
            if (control) {
                control.classList.remove('chunk-size-applying');
            }
        }
    }

    updateChunkNavigation() {
        const existingNav = document.getElementById('chunkNavigation');
        if (existingNav) {
            const newNav = this.createChunkNavigation();
            
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

    // Backward compatibility methods
    setupContentModal(modal, generatedContent) {
        const firstChunk = this.fileChunks[0];
        generatedContent.textContent = firstChunk.content;

        const copyAllChunksBtn = document.getElementById('copyAllChunksBtn');
        const downloadAllChunks = document.getElementById('downloadAllChunks');

        if (this.fileChunks.length > 1) {
            if (copyAllChunksBtn) copyAllChunksBtn.style.display = 'inline-block';
            if (downloadAllChunks) downloadAllChunks.style.display = 'inline-block';

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
        
        const existingControl = modalBody.querySelector('.chunk-size-control');
        const existingNav = modalBody.querySelector('.chunk-navigation');
        if (existingControl) existingControl.remove();
        if (existingNav) existingNav.remove();

        if (this.maxChunkSize > this.defaultChunkSize) {
            const chunkSizeControl = this.createChunkSizeControl();
            modalBody.insertBefore(chunkSizeControl, modalBody.querySelector('.content-display-modal'));
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
            modalHeader.textContent = `📦 ${firstChunk.filename} (1/${this.fileChunks.length}) - ${firstChunk.semanticSummary || 'Semantic chunk'}`;
        } else {
            modalHeader.textContent = '📦 Generated File Content';
        }

        const copyBtn = document.getElementById('copyContentBtn');
        if (copyBtn && this.fileChunks.length > 1) {
            copyBtn.textContent = `📋 Copy ${firstChunk.filename}`;
            copyBtn.classList.add('chunk-copy');
        }
    }

    createChunkSizeControl() {
        const control = document.createElement('div');
        control.className = 'chunk-size-control';
        control.id = 'chunkSizeControl';
        
        const bufferSize = 100000;
        const maxSliderValue = Math.ceil(this.maxChunkSize / bufferSize) * bufferSize + bufferSize;
        
        control.innerHTML = `
            <div class="chunk-size-header">
                <div class="chunk-size-title">
                    🧠 Semantic Chunk Size Control
                </div>
                <div class="chunk-size-info">
                    <span>Total: ${this.formatSize(this.maxChunkSize)}</span>
                    <span>•</span>
                    <span>Strategy: ${this.chunkingStrategy}</span>
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
            
            if (newSize >= this.maxChunkSize * 0.9) {
                newSize = this.maxChunkSize;
                valueDisplay.textContent = `${this.formatSize(newSize)} (Full)`;
            } else {
                valueDisplay.textContent = this.formatSize(newSize);
            }
            
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                this.updateChunkSize(newSize);
            }, 300);
        });

        slider.addEventListener('mouseup', () => {
            clearTimeout(updateTimeout);
            let newSize = parseInt(slider.value);
            
            if (newSize >= this.maxChunkSize * 0.9) {
                newSize = this.maxChunkSize;
                valueDisplay.textContent = `${this.formatSize(newSize)} (Full)`;
            } else {
                valueDisplay.textContent = this.formatSize(newSize);
            }
            
            this.updateChunkSize(newSize);
        });
    }

    // Copy and download methods remain the same...
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
            const filename = `semantic_chunks_${timestamp}.txt`;
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
                
                setTimeout(() => {
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, index * 500);
            });

            alert(`📥 Download started: ${this.fileChunks.length} semantic chunk files`);
        }
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

    // Utility methods for file type detection and priority calculation
    detectFileType(filename, content) {
        const extension = filename.split('.').pop().toLowerCase();
        
        if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            if (content.includes('React') || content.includes('jsx')) return 'react_component';
            if (content.includes('express') || content.includes('app.listen')) return 'node_server';
            if (content.includes('test') || content.includes('describe')) return 'test';
            return 'javascript';
        } else if (extension === 'py') {
            if (content.includes('django') || content.includes('Django')) return 'django';
            if (content.includes('flask') || content.includes('Flask')) return 'flask';
            if (content.includes('test') || content.includes('unittest')) return 'test';
            return 'python';
        } else if (['css', 'scss', 'sass'].includes(extension)) {
            return 'stylesheet';
        } else if (['html', 'htm'].includes(extension)) {
            return 'markup';
        } else if (['json', 'yaml', 'yml', 'toml'].includes(extension)) {
            return 'config';
        } else if (['md', 'rst', 'txt'].includes(extension)) {
            return 'documentation';
        }
        
        return 'generic';
    }

    calculateFilePriority(filename, structure) {
        let priority = 5; // Base priority
        
        // Boost for entry points
        if (filename.includes('index') || filename.includes('main') || filename.includes('app')) {
            priority += 3;
        }
        
        // Boost for high complexity
        if (structure.complexity > 20) priority += 2;
        else if (structure.complexity > 10) priority += 1;
        
        // Boost for many exports (likely utility files)
        if (structure.exports.length > 5) priority += 1;
        
        // Reduce for test files
        if (filename.includes('test') || filename.includes('spec')) priority -= 2;
        
        // Boost for config files
        if (filename.includes('config') || filename.includes('setting')) priority += 1;
        
        return Math.max(1, Math.min(10, priority));
    }

    findFileRelationships(filename, structure) {
        const relationships = {
            imports: structure.imports.length,
            exports: structure.exports.length,
            functions: structure.functions.length,
            classes: structure.classes.length
        };
        
        return relationships;
    }

    detectFunctionType(line) {
        if (line.includes('async')) return 'async';
        if (line.includes('=>')) return 'arrow';
        if (line.includes('function*')) return 'generator';
        if (line.includes('export')) return 'exported';
        return 'regular';
    }

    // Enhanced chunk analysis for better AI understanding
    generateChunkAnalysisSummary() {
        const analysis = {
            totalChunks: this.fileChunks.length,
            chunkingStrategy: this.chunkingStrategy,
            averageSize: this.getAverageChunkSize(),
            crossReferences: 0,
            semanticCohesion: 0,
            files: new Map()
        };

        // Calculate cross-references and semantic cohesion
        for (const chunk of this.fileChunks) {
            analysis.crossReferences += chunk.crossReferences ? chunk.crossReferences.length : 0;
            
            // Track file distribution
            if (chunk.files) {
                for (const filename of chunk.files.keys()) {
                    if (!analysis.files.has(filename)) {
                        analysis.files.set(filename, []);
                    }
                    analysis.files.get(filename).push(chunk.index);
                }
            }
        }

        // Calculate semantic cohesion (how well files are kept together)
        let filesInMultipleChunks = 0;
        for (const [filename, chunkIndices] of analysis.files.entries()) {
            if (chunkIndices.length > 1) {
                filesInMultipleChunks++;
            }
        }
        
        analysis.semanticCohesion = 1 - (filesInMultipleChunks / analysis.files.size);

        return analysis;
    }

    // Method to export semantic chunking report
    exportSemanticAnalysis() {
        const analysis = this.generateChunkAnalysisSummary();
        
        let report = 'SEMANTIC CHUNKING ANALYSIS REPORT\n';
        report += '='.repeat(50) + '\n\n';
        report += `Generated: ${new Date().toISOString()}\n`;
        report += `Strategy: ${this.chunkingStrategy}\n`;
        report += `Total Chunks: ${analysis.totalChunks}\n`;
        report += `Average Chunk Size: ${this.formatSize(analysis.averageSize)}\n`;
        report += `Cross-References: ${analysis.crossReferences}\n`;
        report += `Semantic Cohesion: ${(analysis.semanticCohesion * 100).toFixed(1)}%\n\n`;

        report += 'CHUNK BREAKDOWN\n';
        report += '-'.repeat(30) + '\n';
        
        for (let i = 0; i < this.fileChunks.length; i++) {
            const chunk = this.fileChunks[i];
            report += `Chunk ${i + 1} (${chunk.label.toUpperCase()}):\n`;
            report += `  Size: ${this.formatSize(chunk.size)}\n`;
            report += `  Summary: ${chunk.semanticSummary || 'N/A'}\n`;
            
            if (chunk.crossReferences && chunk.crossReferences.length > 0) {
                report += `  Cross-references: ${chunk.crossReferences.length}\n`;
                for (const ref of chunk.crossReferences.slice(0, 3)) {
                    report += `    → ${ref.description}\n`;
                }
            }
            report += '\n';
        }

        report += 'FILE DISTRIBUTION\n';
        report += '-'.repeat(30) + '\n';
        
        for (const [filename, chunkIndices] of analysis.files.entries()) {
            report += `${filename}: Chunk(s) ${chunkIndices.map(i => i + 1).join(', ')}\n`;
        }

        return report;
    }
}