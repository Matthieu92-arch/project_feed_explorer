export class ProjectScanner {
    constructor(fileExplorer) {
        this.fileExplorer = fileExplorer;
    }

    async scanForProjectFiles() {
        try {
            const projectTypes = [];
            if (this.fileExplorer.settingsManager.settings.projectTypes?.django) projectTypes.push('django');
            if (this.fileExplorer.settingsManager.settings.projectTypes?.react) projectTypes.push('react');

            for (const projectType of projectTypes) {
                const response = await fetch('/api/project-files', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ projectType, startPath: this.fileExplorer.currentPath })
                });

                if (response.ok) {
                    const files = await response.json();
                    console.log(`🔧 Found ${files.length} ${projectType} files`);

                    if (projectType === 'django') {
                        this.fileExplorer.djangoFiles = files;
                        files.forEach(file => this.fileExplorer.selectedFiles.add(file.path));
                    } else if (projectType === 'react') {
                        this.fileExplorer.reactFiles = files;
                        files.forEach(file => this.fileExplorer.selectedFiles.add(file.path));
                    }
                }
            }

            this.fileExplorer.updateValidateButton();
            this.fileExplorer.updateVisibleCheckboxes();
        } catch (error) {
            console.error('Error scanning for project files:', error);
        }
    }

    async scanForDockerFiles() {
        try {
            const response = await fetch('/api/docker-files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ startPath: this.fileExplorer.currentPath })
            });

            if (response.ok) {
                this.fileExplorer.dockerFiles = await response.json();
                console.log(`🐳 Found ${this.fileExplorer.dockerFiles.length} Docker files`);

                this.fileExplorer.dockerFiles.forEach(dockerFile => {
                    this.fileExplorer.selectedFiles.add(dockerFile.path);
                });

                this.fileExplorer.updateValidateButton();
                this.fileExplorer.updateVisibleCheckboxes();
            }
        } catch (error) {
            console.error('Error scanning for Docker files:', error);
        }
    }
}