const { v4: uuidv4 } = require('uuid');

const DEFAULT_PROPOSAL_COUNT = 1;

const SUBTASK_DEFINITIONS = [
    {
        key: 'upload_rfp',
        title: 'Upload RFP Document',
        description: 'Upload the client RFP and generate structured artifacts.'
    },
    {
        key: 'org_details',
        title: 'Upload Organization Details',
        description: 'Attach your organization profile and reusable assets.'
    },
    {
        key: 'solution_outline',
        title: 'Draft Solution Outline',
        description: 'Outline the solution approach and key differentiators.'
    },
    {
        key: 'review_finalize',
        title: 'Review & Finalize',
        description: 'Review generated content and prepare submission package.'
    }
];

function buildSubtasks() {
    return SUBTASK_DEFINITIONS.map(def => ({
        id: uuidv4(),
        key: def.key,
        title: def.title,
        description: def.description,
        status: 'pending',
        metadata: {}
    }));
}

class ProposalService {
    constructor(db) {
        this.db = db;
    }

    async ensureSeedProposals(userId, username) {
        const existing = await this.db.getProposalsByUser(userId);
        if (existing.length > 0) {
            return existing;
        }

        const seedProposals = [];
        for (let index = 1; index <= DEFAULT_PROPOSAL_COUNT; index += 1) {
            const proposal = this._buildProposal({
                userId,
                name: `Proposal ${index}`,
                summary: `${username}'s proposal ${index}`
            });
            await this.db.saveProposalRecord(proposal);
            seedProposals.push(proposal);
        }
        return seedProposals;
    }

    async listProposals(userId) {
        const proposals = await this.db.getProposalsByUser(userId);
        return proposals.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    async createProposal(userId, username, name) {
        const proposals = await this.db.getProposalsByUser(userId);
        const requestedName = name?.trim();
        if (!requestedName) {
            throw new Error('Proposal name is required.');
        }

        const duplicate = proposals.some(p => p.name.toLowerCase() === requestedName.toLowerCase());
        if (duplicate) {
            throw new Error('A proposal with this name already exists. Choose a different name.');
        }

        const proposal = this._buildProposal({
            userId,
            name: requestedName,
            summary: `${username}'s ${requestedName}`,
            order: proposals.length + 1
        });

        await this.db.saveProposalRecord(proposal);
        return proposal;
    }

    async deleteProposal(userId, proposalId) {
        const proposals = await this.db.getProposalsByUser(userId);
        if (proposals.length <= 1) {
            throw new Error('At least one proposal task is required. Create another proposal before deleting this one.');
        }

        await this.db.deleteProposalRecord(userId, proposalId);
        return true;
    }

    _buildProposal({ userId, name, summary, order }) {
        const now = new Date().toISOString();
        return {
            id: uuidv4(),
            userId,
            name,
            summary: summary || '',
            status: 'draft',
            documents: [],
            subtasks: buildSubtasks(),
            artifacts: {
                templates: [],
                requirements: []
            },
            order: order || 0,
            createdAt: now,
            updatedAt: now
        };
    }
}

module.exports = ProposalService;
