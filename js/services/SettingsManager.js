// js/services/SettingsManager.js
export class SettingsManager {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
        this.settings = {
            defaultPath: '',
            includeDockerFiles: false,
            customPrompt: '',
            projectTypes: {
                django: false,
                react: false
            }
        };
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            this.settings = await response.json();
            console.log('Settings loaded:', this.settings);

            if (this.settings.defaultPath) {
                this.fileExplorer.currentPath = this.settings.defaultPath;
                await this.fileExplorer.fileManager.loadDirectory(this.fileExplorer.currentPath);
            }

            if (this.settings.includeDockerFiles) {
                await this.fileExplorer.projectScanner.scanForDockerFiles();
            }

            if (this.settings.projectTypes?.django || this.settings.projectTypes?.react) {
                await this.fileExplorer.projectScanner.scanForProjectFiles();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.settings)
            });
            return response.ok;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    async openNativeFileBrowser() {
        try {
            const response = await fetch('/api/browse-directory', {
                method: 'POST'
            });
            const result = await response.json();
            if (result.success) {
                return result.path;
            }
            return null;
        } catch (error) {
            console.error('Error opening file browser:', error);
            return null;
        }
    }

    async directoryExists(dirPath) {
        return await this.fileExplorer.fileManager.directoryExists(dirPath);
    }

    async saveSettingsFromModal() {
        const defaultPathInput = document.getElementById('defaultPath');
        const includeDockerCheckbox = document.getElementById('includeDockerFiles');
        const customPromptTextarea = document.getElementById('customPrompt');
        const djangoCheckbox = document.getElementById('includeDjangoFiles');
        const reactCheckbox = document.getElementById('includeReactFiles');
        const showHiddenCheckbox = document.getElementById('showHiddenFiles');

        const newSettings = {
            defaultPath: defaultPathInput ? defaultPathInput.value.trim() : '',
            includeDockerFiles: includeDockerCheckbox ? includeDockerCheckbox.checked : false,
            customPrompt: customPromptTextarea ? customPromptTextarea.value.trim() : '',
            showHiddenFiles: showHiddenCheckbox ? showHiddenCheckbox.checked : false,
            projectTypes: {
                django: djangoCheckbox ? djangoCheckbox.checked : false,
                react: reactCheckbox ? reactCheckbox.checked : false
            }
        };

        // Validate default path if provided
        if (newSettings.defaultPath && !await this.directoryExists(newSettings.defaultPath)) {
            alert('❌ The specified default path does not exist or is not accessible.');
            return false;
        }

        const oldSettings = { ...this.settings };
        this.settings = { ...this.settings, ...newSettings };

        const saved = await this.saveSettings();
        if (saved) {
            await this.handleSettingsChanges(oldSettings, newSettings);
            if (oldSettings.showHiddenFiles !== newSettings.showHiddenFiles) {
            await this.fileExplorer.fileManager.loadDirectory(this.fileExplorer.currentPath);
        }
            this.fileExplorer.updateValidateButton();
            this.fileExplorer.updateVisibleCheckboxes();
            this.fileExplorer.hideSettingsModal();
            alert('✅ Settings saved successfully!');
            return true;
        } else {
            alert('❌ Failed to save settings. Please try again.');
            return false;
        }
    }

    async handleSettingsChanges(oldSettings, newSettings) {
        // Handle Docker files changes
        if (oldSettings.includeDockerFiles !== newSettings.includeDockerFiles) {
            if (newSettings.includeDockerFiles) {
                await this.fileExplorer.projectScanner.scanForDockerFiles();
            } else {
                this.clearDockerFiles();
            }
        }

        // Handle project type changes
        const djangoChanged = oldSettings.projectTypes?.django !== newSettings.projectTypes.django;
        const reactChanged = oldSettings.projectTypes?.react !== newSettings.projectTypes.react;

        if (djangoChanged || reactChanged) {
            if (!newSettings.projectTypes.django && oldSettings.projectTypes?.django) {
                this.clearDjangoFiles();
            }

            if (!newSettings.projectTypes.react && oldSettings.projectTypes?.react) {
                this.clearReactFiles();
            }

            if (newSettings.defaultPath &&
                (newSettings.projectTypes.django || newSettings.projectTypes.react)) {
                await this.fileExplorer.projectScanner.scanForProjectFiles();
            }
        }
    }

    clearDockerFiles() {
        if (this.fileExplorer.dockerFiles) {
            this.fileExplorer.dockerFiles.forEach(dockerFile => {
                this.fileExplorer.selectedFiles.delete(dockerFile.path);
            });
            this.fileExplorer.dockerFiles = [];
        }
    }

    clearDjangoFiles() {
        if (this.fileExplorer.djangoFiles) {
            this.fileExplorer.djangoFiles.forEach(djangoFile => {
                this.fileExplorer.selectedFiles.delete(djangoFile.path);
            });
            this.fileExplorer.djangoFiles = [];
        }
    }

    clearReactFiles() {
        if (this.fileExplorer.reactFiles) {
            this.fileExplorer.reactFiles.forEach(reactFile => {
                this.fileExplorer.selectedFiles.delete(reactFile.path);
            });
            this.fileExplorer.reactFiles = [];
        }
    }
}