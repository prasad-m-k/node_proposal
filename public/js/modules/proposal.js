/**
 * Proposal Management Module
 * Handles proposal CRUD operations, state management, and UI updates
 */

export class ProposalManager {
    constructor(options = {}) {
        this.proposals = [];
        this.activeProposalId = null;
        this.apiService = options.apiService;

        // DOM elements
        this.proposalTree = document.getElementById('proposalTree');
        this.proposalError = document.getElementById('proposalError');
        this.newProposalBtn = document.getElementById('newProposalBtn');
        this.activeProposalName = document.getElementById('activeProposalName');
        this.activeProposalSubtitle = document.getElementById('activeProposalSubtitle');
        this.workArea = document.getElementById('workArea');
        this.homeContent = document.getElementById('homeContent');

        // Event callbacks
        this.onProposalSelect = options.onProposalSelect || (() => {});
        this.onProposalCreate = options.onProposalCreate || (() => {});
        this.onProposalDelete = options.onProposalDelete || (() => {});
        this.onError = options.onError || ((error) => console.error(error));

        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        if (this.newProposalBtn) {
            this.newProposalBtn.addEventListener('click', () => this.showCreateProposalDialog());
        }
    }

    async loadProposals(selectedId = null) {
        try {
            this.clearError();

            if (!this.apiService) {
                throw new Error('API service not configured');
            }

            const data = await this.apiService.getProposals();
            this.proposals = data.proposals || [];

            let targetId = selectedId ?? this.activeProposalId;
            if (!this.proposals.some(proposal => proposal.id === targetId)) {
                targetId = null;
            }

            if (!this.proposals.length) {
                this.setActiveProposal(null);
            } else if (targetId) {
                this.setActiveProposal(targetId);
            } else {
                this.setActiveProposal(null);
            }

            this.renderProposalTree();
            return this.proposals;
        } catch (error) {
            this.handleError('Failed to load proposals', error);
            return [];
        }
    }

    async createProposal(name) {
        try {
            this.clearError();

            // Validate name
            const trimmed = name.trim();
            if (!trimmed) {
                throw new Error('Proposal name cannot be empty.');
            }

            const duplicate = this.proposals.some(proposal =>
                proposal.name.toLowerCase() === trimmed.toLowerCase()
            );
            if (duplicate) {
                throw new Error('A proposal with this name already exists. Please choose another name.');
            }

            const data = await this.apiService.createProposal(trimmed);
            await this.loadProposals(data.proposal.id);
            this.onProposalCreate(data.proposal);

            return data.proposal;
        } catch (error) {
            this.handleError('Failed to create proposal', error);
            throw error;
        }
    }

    async deleteProposal(id) {
        try {
            this.clearError();

            const proposal = this.proposals.find(p => p.id === id);
            if (!proposal) {
                throw new Error('Proposal not found');
            }

            await this.apiService.deleteProposal(id);
            await this.loadProposals();
            this.onProposalDelete(proposal);

            return true;
        } catch (error) {
            this.handleError('Failed to delete proposal', error);
            throw error;
        }
    }

    setActiveProposal(proposalId) {
        this.activeProposalId = proposalId;

        if (!proposalId) {
            this.showHomeView();
            this.renderProposalTree();
            return null;
        }

        const proposal = this.proposals.find(p => p.id === proposalId);
        if (!proposal) {
            console.warn(`Proposal with ID ${proposalId} not found`);
            return null;
        }

        this.showWorkView(proposal);
        this.renderProposalTree();
        this.onProposalSelect(proposal);

        return proposal;
    }

    showHomeView() {
        console.log('ProposalManager: showHomeView called');

        if (this.activeProposalName) {
            this.activeProposalName.textContent = 'Select a proposal to get started';
        }
        if (this.activeProposalSubtitle) {
            this.activeProposalSubtitle.textContent = 'Choose a proposal on the left to walk through the workflow.';
        }

        // Hide work area
        if (this.workArea) {
            console.log('Hiding work area');
            this.workArea.classList.remove('visible');
            this.workArea.hidden = true;
        }

        // Show home content
        if (this.homeContent) {
            console.log('Showing home content');
            this.homeContent.hidden = false;
            this.homeContent.style.display = '';
        }
    }

    showWorkView(proposal) {
        console.log('ProposalManager: showWorkView called for proposal:', proposal.name);

        if (this.activeProposalName) {
            this.activeProposalName.textContent = proposal.name || 'Untitled Proposal';
        }
        if (this.activeProposalSubtitle) {
            this.activeProposalSubtitle.textContent = 'Work through each step to build a complete proposal.';
        }

        // Hide home content
        if (this.homeContent) {
            console.log('Hiding home content');
            this.homeContent.hidden = true;
            this.homeContent.style.display = 'none';
        }

        // Show work area
        if (this.workArea) {
            console.log('Showing work area');
            this.workArea.removeAttribute('hidden');
            this.workArea.hidden = false;
            this.workArea.classList.add('visible');
        }
    }

    renderProposalTree() {
        if (!this.proposalTree) return;

        this.proposalTree.innerHTML = '';

        if (!this.proposals.length) {
            this.renderEmptyState();
            return;
        }

        const sortedProposals = [...this.proposals].sort((a, b) => {
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeA - timeB;
        });

        sortedProposals.forEach(proposal => {
            const node = this.createProposalNode(proposal);
            this.proposalTree.appendChild(node);
        });
    }

    renderEmptyState() {
        const emptyState = document.createElement('div');
        emptyState.className = 'proposal-empty';
        emptyState.textContent = 'No proposals yet. Create one to get started.';
        this.proposalTree.appendChild(emptyState);
    }

    createProposalNode(proposal) {
        const node = document.createElement('div');
        node.className = 'proposal-node';
        if (proposal.id === this.activeProposalId) {
            node.classList.add('active');
        }
        node.setAttribute('role', 'treeitem');
        node.setAttribute('aria-expanded', 'true');

        const heading = this.createProposalHeading(proposal);
        const treeList = this.createProposalBranch(proposal);

        node.appendChild(heading);
        node.appendChild(treeList);

        return node;
    }

    createProposalHeading(proposal) {
        const heading = document.createElement('div');
        heading.className = 'proposal-heading';

        const title = this.createProposalTitle(proposal);
        const actions = this.createProposalActions(proposal);

        heading.appendChild(title);
        heading.appendChild(actions);

        return heading;
    }

    createProposalTitle(proposal) {
        const title = document.createElement('div');
        title.className = 'proposal-title';
        title.addEventListener('click', () => this.setActiveProposal(proposal.id));

        const bullet = document.createElement('span');
        bullet.className = 'proposal-bullet';
        bullet.textContent = proposal.name?.charAt(0).toUpperCase() || 'P';
        bullet.addEventListener('click', () => this.setActiveProposal(proposal.id));

        const textWrap = document.createElement('div');
        const nameEl = document.createElement('p');
        nameEl.className = 'proposal-name';
        nameEl.textContent = proposal.name || 'Untitled Proposal';

        const metaEl = document.createElement('p');
        metaEl.className = 'proposal-meta';
        const documentCount = Array.isArray(proposal.documents) ? proposal.documents.length : 0;
        const subtaskCount = Array.isArray(proposal.subtasks) ? proposal.subtasks.length : 0;
        metaEl.textContent = `${documentCount} documents • ${subtaskCount} subtasks`;

        textWrap.appendChild(nameEl);
        textWrap.appendChild(metaEl);
        title.appendChild(bullet);
        title.appendChild(textWrap);

        return title;
    }

    createProposalActions(proposal) {
        const actions = document.createElement('div');
        actions.className = 'proposal-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'proposal-edit';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => this.setActiveProposal(proposal.id));

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'proposal-delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.dataset.id = proposal.id;

        if (this.proposals.length === 1) {
            deleteBtn.disabled = true;
            deleteBtn.title = 'At least one proposal is required.';
        } else {
            deleteBtn.addEventListener('click', () => this.confirmDeleteProposal(proposal));
        }

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        return actions;
    }

    createProposalBranch(proposal) {
        const treeList = document.createElement('ul');
        treeList.className = 'proposal-branch';
        treeList.setAttribute('role', 'group');

        // Documents section
        const documentsItem = this.createDocumentsSection(proposal);
        treeList.appendChild(documentsItem);

        // Artifacts section
        const artifactOutputs = (proposal.artifacts && proposal.artifacts.outputs) || [];
        if (artifactOutputs.length) {
            const artifactsItem = this.createArtifactsSection(artifactOutputs);
            treeList.appendChild(artifactsItem);
        }

        // Subtasks section
        (proposal.subtasks || []).forEach((task) => {
            const taskItem = this.createTaskItem(task);
            treeList.appendChild(taskItem);
        });

        return treeList;
    }

    createDocumentsSection(proposal) {
        const documentsItem = document.createElement('li');
        documentsItem.className = 'proposal-branch-item';

        const documentsTitle = document.createElement('div');
        documentsTitle.className = 'task-title';
        documentsTitle.textContent = 'Documents';
        documentsItem.appendChild(documentsTitle);

        const documentCount = Array.isArray(proposal.documents) ? proposal.documents.length : 0;
        if (documentCount > 0) {
            const docList = document.createElement('ul');
            docList.className = 'proposal-sublist';
            proposal.documents.forEach((doc) => {
                const docItem = document.createElement('li');
                docItem.className = 'proposal-subitem';
                docItem.textContent = doc.name || 'Untitled document';
                docList.appendChild(docItem);
            });
            documentsItem.appendChild(docList);
        }

        return documentsItem;
    }

    createArtifactsSection(artifactOutputs) {
        const artifactsItem = document.createElement('li');
        artifactsItem.className = 'proposal-branch-item';

        const artifactsTitle = document.createElement('div');
        artifactsTitle.className = 'task-title';
        artifactsTitle.textContent = 'Artifacts';
        artifactsItem.appendChild(artifactsTitle);

        const artifactList = document.createElement('ul');
        artifactList.className = 'proposal-sublist';
        artifactOutputs.forEach((artifact) => {
            const artifactItem = document.createElement('li');
            artifactItem.className = 'proposal-subitem';
            artifactItem.textContent = `${artifact.type}: ${artifact.name}`;
            artifactList.appendChild(artifactItem);
        });
        artifactsItem.appendChild(artifactList);

        return artifactsItem;
    }

    createTaskItem(task) {
        const taskItem = document.createElement('li');
        taskItem.className = `proposal-branch-item task-${task.status}`;

        const taskTitle = document.createElement('div');
        taskTitle.className = 'task-title';
        taskTitle.textContent = task.title;

        const taskStatus = document.createElement('div');
        taskStatus.className = 'task-status';
        taskStatus.textContent = this.formatStatus(task.status);

        taskItem.appendChild(taskTitle);
        taskItem.appendChild(taskStatus);

        return taskItem;
    }

    showCreateProposalDialog() {
        const defaultName = `Proposal ${this.proposals.length + 1}`;
        const proposalName = prompt('Enter a name for the new proposal task:', defaultName);

        if (proposalName !== null) {
            this.createProposal(proposalName);
        }
    }

    confirmDeleteProposal(proposal) {
        if (confirm(`Delete ${proposal.name}?`)) {
            this.deleteProposal(proposal.id);
        }
    }

    updateProposal(proposalId, updates) {
        const proposalIndex = this.proposals.findIndex(p => p.id === proposalId);
        if (proposalIndex >= 0) {
            this.proposals[proposalIndex] = { ...this.proposals[proposalIndex], ...updates };
            this.renderProposalTree();
        }
    }

    getActiveProposal() {
        return this.proposals.find(p => p.id === this.activeProposalId) || null;
    }

    getAllProposals() {
        return [...this.proposals];
    }

    formatStatus(status) {
        if (!status) return 'Pending';
        return status
            .replace(/_/g, ' ')
            .replace(/\b\w/g, match => match.toUpperCase());
    }

    handleError(message, error) {
        console.error(message, error);
        this.showError(error.message || message);
        this.onError(error);
    }

    showError(message) {
        if (this.proposalError) {
            this.proposalError.textContent = message;
            this.proposalError.style.display = 'block';
        }
    }

    clearError() {
        if (this.proposalError) {
            this.proposalError.textContent = '';
            this.proposalError.style.display = 'none';
        }
    }
}