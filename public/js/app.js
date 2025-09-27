/**
 * Main Application Entry Point
 * Orchestrates all modules and manages application state
 */

import { WorkflowManager } from './modules/workflow.js';
import { ProposalManager } from './modules/proposal.js';
import { ApiService } from './modules/api.js';
import { ThemeUtils, DomUtils, StorageUtils, AsyncUtils, EventEmitter, Logger } from './modules/utils.js';

class RfpProposalApp extends EventEmitter {
    constructor() {
        super();

        // Initialize logger
        this.logger = new Logger('RfpApp', 'info');

        // Initialize services
        this.apiService = new ApiService({
            baseUrl: '',
            credentials: 'include'
        });

        // Initialize managers
        this.workflowManager = null;
        this.proposalManager = null;

        // DOM elements
        this.initDomElements();

        // Application state
        this.currentUser = null;
        this.isInitialized = false;

        this.logger.info('Application initialized');
    }

    initDomElements() {
        this.elements = {
            // Layout elements
            layoutContainer: DomUtils.querySelector('.layout-container'),
            leftPanel: DomUtils.querySelector('.left-panel'),
            rightPanel: DomUtils.querySelector('.right-panel'),
            resizeHandle: DomUtils.getElementById('resizeHandle'),
            themeToggle: DomUtils.getElementById('themeToggle'),

            // User elements
            username: DomUtils.getElementById('username'),
            userAvatar: DomUtils.getElementById('userAvatar'),

            // File upload elements
            rfpUpload: DomUtils.getElementById('rfpUpload'),
            processRfpBtn: DomUtils.getElementById('processRfpBtn'),
            uploadStatus: DomUtils.getElementById('uploadStatus'),
            generatedArtifacts: DomUtils.getElementById('generatedArtifacts'),
            artifactList: DomUtils.getElementById('artifactList')
        };
    }

    async init() {
        try {
            this.logger.info('Starting application initialization');

            // Initialize theme
            ThemeUtils.initializeTheme();

            // Load user data and authenticate
            await this.loadUserData();

            // Initialize managers
            this.initializeManagers();

            // Bind global events
            this.bindGlobalEvents();

            // Initialize resizable pane
            this.initializeResizablePane();

            // Load initial data
            await this.loadInitialData();

            this.isInitialized = true;
            this.emit('initialized');
            this.logger.info('Application initialization complete');

        } catch (error) {
            this.logger.error('Application initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    async loadUserData() {
        try {
            const userData = await this.apiService.getCurrentUser();
            this.currentUser = userData;

            // Update UI
            if (this.elements.username) {
                this.elements.username.textContent = userData.username;
            }
            if (this.elements.userAvatar) {
                this.elements.userAvatar.textContent = userData.username.charAt(0).toUpperCase();
            }

            // Apply user's theme preference
            const theme = userData.theme || 'bright';
            ThemeUtils.applyTheme(theme);

            // Update theme toggle button
            if (this.elements.themeToggle) {
                this.elements.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
            }

            this.logger.info('User data loaded:', userData.username);
        } catch (error) {
            this.logger.error('Failed to load user data:', error);
            throw error;
        }
    }

    initializeManagers() {
        // Initialize workflow manager
        this.workflowManager = new WorkflowManager({
            maxSteps: 4,
            onStepChange: (step, previousStep) => {
                this.logger.debug(`Workflow step changed: ${previousStep} -> ${step}`);
                this.emit('stepChanged', { step, previousStep });
            },
            onStepComplete: (step) => {
                this.logger.info(`Workflow step completed: ${step}`);
                this.emit('stepCompleted', { step });
            }
        });

        // Initialize proposal manager
        this.proposalManager = new ProposalManager({
            apiService: this.apiService,
            onProposalSelect: (proposal) => {
                this.logger.debug('Proposal selected:', proposal.name);
                this.handleProposalSelect(proposal);
                this.emit('proposalSelected', { proposal });
            },
            onProposalCreate: (proposal) => {
                this.logger.info('Proposal created:', proposal.name);
                this.emit('proposalCreated', { proposal });
            },
            onProposalDelete: (proposal) => {
                this.logger.info('Proposal deleted:', proposal.name);
                this.emit('proposalDeleted', { proposal });
            },
            onError: (error) => {
                this.logger.error('Proposal manager error:', error);
                this.emit('error', { error, source: 'proposalManager' });
            }
        });

        this.logger.info('Managers initialized');
    }

    bindGlobalEvents() {
        // File upload events
        if (this.elements.rfpUpload) {
            DomUtils.addEventListener(this.elements.rfpUpload, 'change', () => {
                this.handleFileSelection();
            });
        }

        if (this.elements.processRfpBtn) {
            DomUtils.addEventListener(this.elements.processRfpBtn, 'click', () => {
                this.handleRfpProcessing();
            });
        }

        // Theme toggle events
        if (this.elements.themeToggle) {
            DomUtils.addEventListener(this.elements.themeToggle, 'click', () => {
                this.toggleTheme();
            });
        }

        // Global error handling
        window.addEventListener('error', (event) => {
            this.logger.error('Global error:', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logger.error('Unhandled promise rejection:', event.reason);
        });

        this.logger.debug('Global events bound');
    }

    initializeResizablePane() {
        if (!this.elements.resizeHandle || !this.elements.leftPanel) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        // Load saved width from localStorage
        const savedWidth = StorageUtils.get('left-panel-width');
        if (savedWidth) {
            document.documentElement.style.setProperty('--left-panel-width', savedWidth + 'px');
        }

        const startResize = (e) => {
            isResizing = true;
            startX = e.clientX || e.touches[0].clientX;
            startWidth = this.elements.leftPanel.offsetWidth;

            this.elements.resizeHandle.classList.add('dragging');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';

            e.preventDefault();
        };

        const doResize = (e) => {
            if (!isResizing) return;

            const clientX = e.clientX || e.touches[0].clientX;
            const deltaX = clientX - startX;
            const newWidth = Math.max(250, Math.min(500, startWidth + deltaX));

            document.documentElement.style.setProperty('--left-panel-width', newWidth + 'px');
        };

        const stopResize = () => {
            if (!isResizing) return;

            isResizing = false;
            this.elements.resizeHandle.classList.remove('dragging');
            document.body.style.userSelect = '';
            document.body.style.cursor = '';

            // Save the width
            const currentWidth = this.elements.leftPanel.offsetWidth;
            StorageUtils.set('left-panel-width', currentWidth);
        };

        // Mouse events
        DomUtils.addEventListener(this.elements.resizeHandle, 'mousedown', startResize);
        DomUtils.addEventListener(document, 'mousemove', doResize);
        DomUtils.addEventListener(document, 'mouseup', stopResize);

        // Touch events for mobile
        DomUtils.addEventListener(this.elements.resizeHandle, 'touchstart', startResize);
        DomUtils.addEventListener(document, 'touchmove', doResize);
        DomUtils.addEventListener(document, 'touchend', stopResize);

        this.logger.debug('Resizable left panel initialized');
    }

    async loadInitialData() {
        try {
            await this.proposalManager.loadProposals();
            this.logger.info('Initial data loaded');
        } catch (error) {
            this.logger.error('Failed to load initial data:', error);
            // Don't throw - allow app to continue with empty state
        }
    }

    handleProposalSelect(proposal) {
        // Initialize workflow state for the selected proposal
        this.workflowManager.reset();

        // Check if step 1 is already completed (has artifacts)
        if (proposal.artifacts && proposal.artifacts.outputs && proposal.artifacts.outputs.length > 0) {
            this.workflowManager.markStepCompleted(1);
        }

        // Render artifacts
        this.renderArtifacts(proposal.artifacts?.outputs || []);

        // Update file upload UI state
        this.updateFileUploadState();
    }

    handleFileSelection() {
        if (this.elements.rfpUpload.files && this.elements.rfpUpload.files.length) {
            if (this.elements.processRfpBtn) {
                this.elements.processRfpBtn.disabled = false;
            }
            if (this.elements.uploadStatus) {
                this.elements.uploadStatus.textContent = `${this.elements.rfpUpload.files[0].name} selected.`;
            }
        } else {
            if (this.elements.processRfpBtn) {
                this.elements.processRfpBtn.disabled = true;
            }
            if (this.elements.uploadStatus) {
                this.elements.uploadStatus.textContent = '';
            }
        }
    }

    async handleRfpProcessing() {
        if (!this.elements.rfpUpload.files || !this.elements.rfpUpload.files.length) {
            this.proposalManager.showError('Please select a document before analyzing.');
            return;
        }

        const activeProposal = this.proposalManager.getActiveProposal();
        if (!activeProposal) {
            this.proposalManager.showError('Please select a proposal before analyzing documents.');
            return;
        }

        const file = this.elements.rfpUpload.files[0];

        try {
            this.proposalManager.clearError();

            // Update UI to show processing state
            if (this.elements.processRfpBtn) {
                this.elements.processRfpBtn.disabled = true;
                this.elements.processRfpBtn.textContent = 'Analyzing…';
            }
            if (this.elements.uploadStatus) {
                this.elements.uploadStatus.textContent = `Uploading ${file.name}…`;
            }

            // Process the document
            if (this.elements.uploadStatus) {
                this.elements.uploadStatus.textContent = 'Analyzing with Gemini 2.0 Flash (hallucination guard enabled)…';
            }

            const data = await this.apiService.uploadRfpDocument(activeProposal.id, file);

            // Update success state
            if (this.elements.uploadStatus) {
                this.elements.uploadStatus.textContent = 'Artifacts generated successfully by Gemini 2.0 Flash.';
            }
            if (this.elements.processRfpBtn) {
                this.elements.processRfpBtn.textContent = 'Analyze with Gemini';
                this.elements.processRfpBtn.disabled = false;
            }

            // Update proposal data
            this.proposalManager.updateProposal(activeProposal.id, data.proposal);

            // Render artifacts
            this.renderArtifacts(data.artifacts || []);

            // Clear file input
            if (this.elements.rfpUpload) {
                this.elements.rfpUpload.value = '';
            }

            // Mark step 1 as completed and enable step 2
            this.workflowManager.enableNextStep();

            this.logger.info('RFP document processed successfully');

        } catch (error) {
            this.logger.error('Error processing RFP document:', error);
            this.proposalManager.showError(error.message || 'Failed to process document');

            // Reset UI state
            if (this.elements.processRfpBtn) {
                this.elements.processRfpBtn.textContent = 'Analyze with Gemini';
                this.elements.processRfpBtn.disabled = false;
            }
            if (this.elements.uploadStatus) {
                this.elements.uploadStatus.textContent = '';
            }
        }
    }

    renderArtifacts(outputs = []) {
        if (!this.elements.artifactList) return;

        this.elements.artifactList.innerHTML = '';

        if (!outputs.length) {
            if (this.elements.generatedArtifacts) {
                this.elements.generatedArtifacts.hidden = true;
            }
            return;
        }

        if (this.elements.generatedArtifacts) {
            this.elements.generatedArtifacts.hidden = false;
        }

        outputs.forEach((artifact) => {
            const item = this.createArtifactItem(artifact);
            this.elements.artifactList.appendChild(item);
        });
    }

    createArtifactItem(artifact) {
        const item = DomUtils.createElement('li', { className: 'artifact-item' });

        const type = DomUtils.createElement('span', { className: 'artifact-type' }, artifact.type);
        const name = DomUtils.createElement('span', { className: 'artifact-name' }, artifact.name);

        const actions = DomUtils.createElement('div', { className: 'artifact-actions' });

        const viewBtn = DomUtils.createElement('button', { className: 'artifact-view' }, 'View');
        DomUtils.addEventListener(viewBtn, 'click', () => {
            this.viewArtifact(artifact.name);
        });

        const downloadBtn = DomUtils.createElement('button', { className: 'artifact-download secondary' }, 'Download');
        DomUtils.addEventListener(downloadBtn, 'click', () => {
            this.downloadArtifact(artifact.name);
        });

        actions.appendChild(viewBtn);
        actions.appendChild(downloadBtn);

        item.appendChild(type);
        item.appendChild(name);
        item.appendChild(actions);

        return item;
    }

    async viewArtifact(fileName) {
        const activeProposal = this.proposalManager.getActiveProposal();
        if (!activeProposal) {
            this.proposalManager.showError('No active proposal selected.');
            return;
        }

        try {
            const response = await fetch(`/api/proposals/${activeProposal.id}/artifacts/${fileName}/view`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to load artifact');
            }

            this.showArtifactModal(data);
        } catch (error) {
            console.error('View artifact error:', error);
            this.proposalManager.showError('Failed to load artifact: ' + error.message);
        }
    }

    async downloadArtifact(fileName) {
        const activeProposal = this.proposalManager.getActiveProposal();
        if (!activeProposal) {
            this.proposalManager.showError('No active proposal selected.');
            return;
        }

        try {
            const blob = await this.apiService.downloadArtifact(activeProposal.id, fileName);
            this.apiService.downloadBlob(blob, fileName);
            this.logger.info('Artifact downloaded:', fileName);
        } catch (error) {
            this.logger.error('Error downloading artifact:', error);
            this.proposalManager.showError(error.message || 'Failed to download artifact');
        }
    }

    showArtifactModal(artifactData) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('artifactModal');
        if (!modal) {
            modal = this.createArtifactModal();
            document.body.appendChild(modal);
        }

        // Populate modal content
        const title = modal.querySelector('.modal-title');
        const editor = modal.querySelector('.artifact-editor');
        const saveBtn = modal.querySelector('.save-artifact');
        const closeBtn = modal.querySelector('.close-modal');

        title.textContent = artifactData.fileName;
        editor.value = artifactData.content;

        // Store current artifact data for saving
        modal.dataset.fileName = artifactData.fileName;

        // Show modal
        modal.style.display = 'flex';

        // Focus editor
        editor.focus();

        // Bind events
        saveBtn.onclick = () => this.saveArtifact(artifactData.fileName, editor.value);
        closeBtn.onclick = () => this.closeArtifactModal();

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeArtifactModal();
            }
        };

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                this.closeArtifactModal();
            }
        });
    }

    createArtifactModal() {
        const modal = document.createElement('div');
        modal.id = 'artifactModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content artifact-modal">
                <div class="modal-header">
                    <h3 class="modal-title">Artifact Viewer</h3>
                    <button class="close-modal" type="button">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="editor-toolbar">
                        <button class="editor-btn preview-btn" type="button">Preview</button>
                        <button class="editor-btn markdown-btn active" type="button">Markdown</button>
                    </div>
                    <textarea class="artifact-editor" placeholder="Loading content..."></textarea>
                    <div class="artifact-preview" style="display: none;"></div>
                </div>
                <div class="modal-footer">
                    <button class="save-artifact" type="button">Save Changes</button>
                    <button class="cancel-edit" type="button">Cancel</button>
                </div>
            </div>
        `;

        // Add preview toggle functionality
        const previewBtn = modal.querySelector('.preview-btn');
        const markdownBtn = modal.querySelector('.markdown-btn');
        const editor = modal.querySelector('.artifact-editor');
        const preview = modal.querySelector('.artifact-preview');

        previewBtn.onclick = () => {
            previewBtn.classList.add('active');
            markdownBtn.classList.remove('active');
            preview.innerHTML = this.markdownToHtml(editor.value);
            editor.style.display = 'none';
            preview.style.display = 'block';
        };

        markdownBtn.onclick = () => {
            markdownBtn.classList.add('active');
            previewBtn.classList.remove('active');
            preview.style.display = 'none';
            editor.style.display = 'block';
        };

        const cancelBtn = modal.querySelector('.cancel-edit');
        cancelBtn.onclick = () => this.closeArtifactModal();

        return modal;
    }

    async saveArtifact(fileName, content) {
        const activeProposal = this.proposalManager.getActiveProposal();
        if (!activeProposal) {
            this.proposalManager.showError('No active proposal selected.');
            return;
        }

        try {
            const response = await fetch(`/api/proposals/${activeProposal.id}/artifacts/${fileName}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to save artifact');
            }

            this.proposalManager.showError(''); // Clear any existing errors
            this.closeArtifactModal();

            // Refresh the proposal data to update artifact info
            await this.proposalManager.loadProposals(activeProposal.id);

            this.logger.info('Artifact saved:', fileName);
        } catch (error) {
            console.error('Save artifact error:', error);
            this.proposalManager.showError('Failed to save artifact: ' + error.message);
        }
    }

    closeArtifactModal() {
        const modal = document.getElementById('artifactModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    markdownToHtml(markdown) {
        // Simple markdown to HTML converter
        return markdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/!\[([^\]]*)\]\(([^\)]*)\)/gim, '<img alt="$1" src="$2" />')
            .replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2">$1</a>')
            .replace(/\n$/gim, '<br />');
    }

    toggleTheme() {
        const currentTheme = ThemeUtils.getCurrentTheme();
        const newTheme = currentTheme === 'bright' ? 'dark' : 'bright';

        ThemeUtils.applyTheme(newTheme);

        // Update theme toggle button
        if (this.elements.themeToggle) {
            this.elements.themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }

        // Save user preference via API if logged in
        if (this.currentUser) {
            this.apiService.updateUserTheme(newTheme).catch(error => {
                this.logger.error('Failed to save theme preference:', error);
            });
        }

        this.logger.debug('Theme toggled to:', newTheme);
    }

    updateFileUploadState() {
        // Reset file upload state when switching proposals
        if (this.elements.rfpUpload) {
            this.elements.rfpUpload.value = '';
        }
        if (this.elements.processRfpBtn) {
            this.elements.processRfpBtn.disabled = true;
        }
        if (this.elements.uploadStatus) {
            this.elements.uploadStatus.textContent = '';
        }
    }

    handleInitializationError(error) {
        if (error.message && error.message.includes('401')) {
            // Redirect to login
            window.location.href = '/login';
        } else {
            // Show generic error
            console.error('Application failed to initialize:', error);
            alert('Application failed to initialize. Please refresh the page and try again.');
        }
    }

    // Public API methods
    getWorkflowManager() {
        return this.workflowManager;
    }

    getProposalManager() {
        return this.proposalManager;
    }

    getApiService() {
        return this.apiService;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isReady() {
        return this.isInitialized;
    }

    async logout() {
        try {
            await this.apiService.logout();
            window.location.href = '/login';
        } catch (error) {
            this.logger.error('Logout error:', error);
        }
    }
}

// Global application instance
let app = null;

// Initialize application when DOM is ready
async function initApp() {
    try {
        app = new RfpProposalApp();
        await app.init();

        // Make app available globally for debugging
        if (typeof window !== 'undefined') {
            window.rfpApp = app;
            window.logout = () => app.logout();
            window.goBack = () => window.history.back();
        }

    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export default RfpProposalApp;