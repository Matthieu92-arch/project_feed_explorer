export class ResizerManager {
    setup() {
        try {
            const resizer = document.getElementById('resizer');
            const fileContent = document.querySelector('.file-content');
            const fileExplorer = document.querySelector('.file-explorer');
            const resizeIndicator = document.getElementById('resizeIndicator');

            if (!resizer || !fileContent || !fileExplorer) {
                console.warn('Resizer elements not found, skipping resizer setup');
                return;
            }

            let isResizing = false;
            let startX = 0;
            let startFileContentWidth = 0;
            let startFileExplorerWidth = 0;

            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startFileContentWidth = fileContent.offsetWidth;
                startFileExplorerWidth = fileExplorer.offsetWidth;

                resizer.classList.add('dragging');
                if (resizeIndicator) {
                    resizeIndicator.style.opacity = '1';
                }

                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';

                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const deltaX = e.clientX - startX;
                const mainContainer = document.querySelector('.main-container');
                if (!mainContainer) return;

                const containerWidth = mainContainer.offsetWidth;

                let newFileContentWidth = startFileContentWidth + deltaX;
                let newFileExplorerWidth = startFileExplorerWidth - deltaX;

                const minFileContentWidth = 300;
                const maxFileContentWidth = containerWidth - 250;
                const minFileExplorerWidth = 250;
                const maxFileExplorerWidth = 800;

                newFileContentWidth = Math.max(minFileContentWidth, Math.min(maxFileContentWidth, newFileContentWidth));
                newFileExplorerWidth = Math.max(minFileExplorerWidth, Math.min(maxFileExplorerWidth, containerWidth - newFileContentWidth));

                fileContent.style.flex = 'none';
                fileContent.style.width = newFileContentWidth + 'px';
                fileExplorer.style.width = newFileExplorerWidth + 'px';

                e.preventDefault();
            });

            document.addEventListener('mouseup', () => {
                if (!isResizing) return;

                isResizing = false;
                resizer.classList.remove('dragging');
                if (resizeIndicator) {
                    resizeIndicator.style.opacity = '0';
                }

                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            });

            resizer.addEventListener('dblclick', () => {
                fileContent.style.flex = '1';
                fileContent.style.width = '';
                fileExplorer.style.width = '400px';
            });

            console.log('✅ Resizer setup completed successfully');
        } catch (error) {
            console.error('❌ Error setting up resizer:', error);
        }
    }
}