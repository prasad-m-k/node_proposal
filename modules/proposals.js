const { v4: uuidv4 } = require('uuid');
const GeminiService = require('./geminiService');
const FileService = require('./fileService');

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
        this.geminiService = new GeminiService();
        this.fileService = new FileService();
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

        // Clean up generated files for this proposal
        await this.fileService.deleteGeneratedFiles(proposalId);

        await this.db.deleteProposalRecord(userId, proposalId);
        return true;
    }

    async processRFPDocument(userId, proposalId, filePath, originalName) {
        try {
            // Get the proposal
            const proposal = await this.db.getProposalRecord(userId, proposalId);
            if (!proposal) {
                throw new Error('Proposal not found');
            }

            // Convert uploaded file to markdown format for better Gemini analysis
            const markdownContent = await this.fileService.convertToMarkdown(filePath, originalName, proposalId);

            // Save the converted markdown in the proposal directory for analysis
            const safeBaseName = (proposal.name || 'proposal').replace(/\s+/g, '-').toLowerCase();
            const markdownFileName = `${safeBaseName}-source-document.md`;
            const markdownFile = await this.fileService.saveGeneratedFile(
                markdownContent,
                markdownFileName,
                proposalId,
                'text'
            );

            // Analyze the document with Gemini using the markdown version
            const analysis = await this.geminiService.analyzeRFPDocument(
                markdownFile.path,
                markdownFileName,
                proposal.name
            );

            // Generate the three required files
            const nunjucksTemplate = this.geminiService.generateNunjucksTemplate(analysis);
            const variableTemplate = this.geminiService.generateVariableTemplate(analysis);
            const requirementsDoc = this.geminiService.generateRequirementsMarkdown(analysis);

            // Save the generated files

            const templateFile = await this.fileService.saveGeneratedFile(
                nunjucksTemplate,
                `${safeBaseName}-response-template.md`,
                proposalId,
                'text'
            );

            const variableFile = await this.fileService.saveGeneratedFile(
                variableTemplate,
                `${safeBaseName}-variables.json`,
                proposalId,
                'json'
            );

            const requirementsFile = await this.fileService.saveGeneratedFile(
                requirementsDoc,
                `${safeBaseName}-requirements.md`,
                proposalId,
                'text'
            );

            // Update proposal with document and artifacts
            proposal.documents = proposal.documents || [];
            proposal.documents.push({
                id: uuidv4(),
                name: originalName,
                uploadedAt: new Date().toISOString(),
                analysisCompleted: true
            });

            proposal.artifacts = proposal.artifacts || {};
            proposal.artifacts.outputs = [
                {
                    id: markdownFile.id,
                    type: 'Source Document',
                    name: markdownFile.name,
                    filePath: markdownFile.path,
                    createdAt: markdownFile.createdAt
                },
                {
                    id: templateFile.id,
                    type: 'Template',
                    name: templateFile.name,
                    filePath: templateFile.path,
                    createdAt: templateFile.createdAt
                },
                {
                    id: variableFile.id,
                    type: 'Variables',
                    name: variableFile.name,
                    filePath: variableFile.path,
                    createdAt: variableFile.createdAt
                },
                {
                    id: requirementsFile.id,
                    type: 'Requirements',
                    name: requirementsFile.name,
                    filePath: requirementsFile.path,
                    createdAt: requirementsFile.createdAt
                }
            ];

            proposal.artifacts.analysis = analysis;

            // Update the upload_rfp subtask status
            const uploadTask = proposal.subtasks.find(task => task.key === 'upload_rfp');
            if (uploadTask) {
                uploadTask.status = 'completed';
                uploadTask.metadata = {
                    completedAt: new Date().toISOString(),
                    documentsProcessed: 1
                };
            }

            proposal.updatedAt = new Date().toISOString();

            // Save the updated proposal
            await this.db.saveProposalRecord(proposal);

            // Clean up the uploaded file
            await this.fileService.deleteUploadedFile(filePath);

            return {
                proposal,
                analysis,
                artifacts: proposal.artifacts.outputs
            };

        } catch (error) {
            console.error('Error processing RFP document:', error);
            // Clean up uploaded file on error
            await this.fileService.deleteUploadedFile(filePath);
            throw error;
        }
    }

    async getProposalArtifacts(userId, proposalId) {
        const proposal = await this.db.getProposalRecord(userId, proposalId);
        if (!proposal) {
            throw new Error('Proposal not found');
        }

        return proposal.artifacts || { outputs: [], analysis: null };
    }

    async downloadArtifact(userId, proposalId, fileName) {
        const proposal = await this.db.getProposalRecord(userId, proposalId);
        if (!proposal) {
            throw new Error('Proposal not found');
        }

        return await this.fileService.getGeneratedFile(proposalId, fileName);
    }

    async updateArtifact(userId, proposalId, fileName, content) {
        const proposal = await this.db.getProposalRecord(userId, proposalId);
        if (!proposal) {
            throw new Error('Proposal not found');
        }

        // Find the artifact in the proposal
        const artifact = proposal.artifacts?.outputs?.find(a => a.name === fileName);
        if (!artifact) {
            throw new Error('Artifact not found');
        }

        // Update the file content
        const updatedFile = await this.fileService.updateGeneratedFile(proposalId, fileName, content);

        // Update artifact metadata
        artifact.size = updatedFile.size;
        artifact.updatedAt = new Date().toISOString();

        // Save the updated proposal
        proposal.updatedAt = new Date().toISOString();
        await this.db.saveProposalRecord(proposal);

        return {
            id: artifact.id,
            name: fileName,
            size: updatedFile.size,
            updated: artifact.updatedAt
        };
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
