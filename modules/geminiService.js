const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs-extra');
const path = require('path');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;

        // Debug logging to help troubleshoot
        console.log('Environment variables check:');
        console.log('GEMINI_API_KEY exists:', !!this.apiKey);
        console.log('GEMINI_API_KEY length:', this.apiKey ? this.apiKey.length : 0);
        console.log('GEMINI_API_KEY starts with:', this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'N/A');

        if (!this.apiKey) {
            console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('GEMINI')));
            throw new Error('GEMINI_API_KEY environment variable is required');
        }

        this.genAI = new GoogleGenerativeAI(this.apiKey);

        // Fallback model order - try these in sequence if one fails
        /*this.modelFallbacks = [
            'gemini-2.0-flash',  // Most capable, but often has quota issues
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-pro',  // Legacy stable model
            'gemini-2.0-flash-exp'  // Keep as last option due to quota issues
        ]; */
        this.modelFallbacks = [
            'gemini-2.0-flash'
        ];
        

        this.currentModelIndex = 0;
        this.model = this.genAI.getGenerativeModel({ model: this.modelFallbacks[0] });
    }

    async analyzeRFPDocument(filePath, fileName, proposalName) {

        //const result = await this.model.generateContent("Give me a three-line poem about the sea.");
        //const response = result.response;
        //const analysisText = response.text();
        //console.log(analysisText);
        //return analysisText;

        console.log(`Starting analysis for file: ${filePath}/${fileName} under proposal: ${proposalName}`);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return await this.analyzeWithFallback(fileContent, fileName, proposalName);
    }

    async analyzeWithFallback(fileContent, fileName, proposalName, attemptCount = 0) {
        if (attemptCount >= this.modelFallbacks.length) {
            throw new Error('All Gemini models failed. Please try again later or check your API quota.');
        }

        const currentModel = this.modelFallbacks[attemptCount];
        console.log(`Attempting analysis with model: ${currentModel} (attempt ${attemptCount + 1})`);

        try {
            const model = this.genAI.getGenerativeModel({ model: currentModel });

            const prompt = `
You are an expert RFP (Request for Proposal) analyst. Analyze the following RFP document and extract structured information to help create a winning proposal response.

CRITICAL INSTRUCTIONS:
- Do NOT hallucinate or make up information that is not in the document
- If information is unclear or missing, explicitly state "Not specified in RFP"
- Focus on factual extraction only
- Be precise and comprehensive

DOCUMENT TO ANALYZE:
${fileContent}

Please provide a comprehensive analysis in the following JSON format:

{
    "metadata": {
        "fileName": "${fileName}",
        "analysisDate": "${new Date().toISOString()}",
        "proposalName": "${proposalName}",
        "modelUsed": "${currentModel}"
    },
    "overview": {
        "title": "RFP title or project name",
        "organization": "Requesting organization name",
        "dueDate": "Proposal submission deadline",
        "projectSummary": "Brief description of what they want"
    },
    "requirements": {
        "functional": [
            "List of functional requirements"
        ],
        "technical": [
            "List of technical requirements"
        ],
        "compliance": [
            "Compliance and regulatory requirements"
        ],
        "deliverables": [
            "Expected deliverables"
        ]
    },
    "evaluation": {
        "criteria": [
            "How proposals will be evaluated"
        ],
        "weights": "Scoring weights if specified",
        "timeline": "Project timeline expectations"
    },
    "constraints": {
        "budget": "Budget information if available",
        "timeline": "Timeline constraints",
        "resources": "Resource constraints",
        "other": [
            "Any other constraints"
        ]
    },
    "questions": [
        "Key questions that need to be addressed in our proposal"
    ],
    "opportunities": [
        "Areas where we can differentiate our proposal"
    ]
}

Remember: Only include information that is explicitly stated or clearly implied in the RFP. Mark uncertain information as "Needs clarification" or "Not specified in RFP".
`;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const analysisText = response.text();

            // Try to parse JSON from response
            let analysisData;
            try {
                // Extract JSON from the response (might be wrapped in markdown)
                const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    analysisData = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                console.error('Failed to parse Gemini JSON response:', parseError);
                // Fallback to structured text analysis
                analysisData = this.parseStructuredResponse(analysisText, fileName, proposalName, currentModel);
            }

            console.log(`Successfully analyzed RFP with model: ${currentModel}`);
            return analysisData;

        } catch (error) {
            console.error(`Model ${currentModel} failed:`, error.message);

            // Check if this is a quota error specifically
            if (error.message.includes('429') || error.message.includes('quota')) {
                console.log(`Quota exceeded for ${currentModel}, trying next model...`);
            } else {
                console.log(`Error with ${currentModel}, trying next model...`);
            }

            // Try next model in fallback chain
            return await this.analyzeWithFallback(fileContent, fileName, proposalName, attemptCount + 1);
        }
    }

    parseStructuredResponse(text, fileName, proposalName, modelUsed = 'unknown') {
        // Fallback parser if JSON parsing fails
        return {
            metadata: {
                fileName: fileName,
                analysisDate: new Date().toISOString(),
                proposalName: proposalName,
                modelUsed: modelUsed
            },
            overview: {
                title: "Analysis completed - see full text",
                organization: "Not specified in RFP",
                dueDate: "Not specified in RFP",
                projectSummary: text.substring(0, 500) + "..."
            },
            requirements: {
                functional: ["See full analysis text"],
                technical: ["See full analysis text"],
                compliance: ["See full analysis text"],
                deliverables: ["See full analysis text"]
            },
            evaluation: {
                criteria: ["See full analysis text"],
                weights: "Not specified in RFP",
                timeline: "See full analysis text"
            },
            constraints: {
                budget: "Not specified in RFP",
                timeline: "See full analysis text",
                resources: "Not specified in RFP",
                other: ["See full analysis text"]
            },
            questions: ["Review full analysis for key questions"],
            opportunities: ["Review full analysis for opportunities"],
            fullText: text
        };
    }

    generateNunjucksTemplate(analysis) {
        const template = `# {{ metadata.proposalName }} - Response to {{ overview.title }}

**Prepared for:** {{ overview.organization }}
**Due Date:** {{ overview.dueDate }}
**Generated:** {{ metadata.analysisDate | date('YYYY-MM-DD') }}

---

## Executive Summary

{{ executiveSummary }}

## Understanding of Requirements

### Project Overview
{{ overview.projectSummary }}

### Functional Requirements Response
{% for requirement in requirements.functional %}
- **{{ requirement }}**: {{ responses.functional[loop.index0] }}
{% endfor %}

### Technical Requirements Response
{% for requirement in requirements.technical %}
- **{{ requirement }}**: {{ responses.technical[loop.index0] }}
{% endfor %}

### Compliance & Regulatory
{% for requirement in requirements.compliance %}
- **{{ requirement }}**: {{ responses.compliance[loop.index0] }}
{% endfor %}

## Proposed Solution

### Solution Overview
{{ solution.overview }}

### Technical Approach
{{ solution.technicalApproach }}

### Implementation Timeline
{% for milestone in solution.timeline %}
- **{{ milestone.phase }}**: {{ milestone.description }} ({{ milestone.duration }})
{% endfor %}

## Deliverables

{% for deliverable in requirements.deliverables %}
- **{{ deliverable }}**: {{ responses.deliverables[loop.index0] }}
{% endfor %}

## Team & Qualifications

### Key Personnel
{% for person in team.keyPersonnel %}
- **{{ person.name }}** ({{ person.role }}): {{ person.qualifications }}
{% endfor %}

### Company Qualifications
{{ company.qualifications }}

### Relevant Experience
{% for project in company.relevantProjects %}
- **{{ project.name }}**: {{ project.description }} ({{ project.year }})
{% endfor %}

## Budget & Pricing

### Cost Summary
{% for item in budget.items %}
- {{ item.category }}: {{ item.cost }}
{% endfor %}

**Total Project Cost**: {{ budget.total }}

## Risk Management

{% for risk in riskManagement %}
- **Risk**: {{ risk.description }}
- **Mitigation**: {{ risk.mitigation }}
{% endfor %}

## Why Choose Us

{{ differentiators }}

---

*This proposal is generated using AI assistance to ensure comprehensive coverage of all RFP requirements. All content should be reviewed and customized with actual company information.*
`;

        return template;
    }

    generateVariableTemplate(analysis) {
        const variables = {
            metadata: analysis.metadata,
            overview: analysis.overview,
            requirements: analysis.requirements,
            evaluation: analysis.evaluation,
            constraints: analysis.constraints,

            // Template variables to be filled by user
            executiveSummary: "{{ TO_BE_FILLED: Brief executive summary highlighting key value proposition }}",

            solution: {
                overview: "{{ TO_BE_FILLED: High-level solution description }}",
                technicalApproach: "{{ TO_BE_FILLED: Detailed technical approach }}",
                timeline: [
                    {
                        phase: "{{ TO_BE_FILLED: Phase 1 name }}",
                        description: "{{ TO_BE_FILLED: Phase 1 description }}",
                        duration: "{{ TO_BE_FILLED: Duration estimate }}"
                    }
                ]
            },

            team: {
                keyPersonnel: [
                    {
                        name: "{{ TO_BE_FILLED: Team member name }}",
                        role: "{{ TO_BE_FILLED: Role/title }}",
                        qualifications: "{{ TO_BE_FILLED: Relevant qualifications }}"
                    }
                ]
            },

            company: {
                qualifications: "{{ TO_BE_FILLED: Company qualifications and certifications }}",
                relevantProjects: [
                    {
                        name: "{{ TO_BE_FILLED: Project name }}",
                        description: "{{ TO_BE_FILLED: Project description }}",
                        year: "{{ TO_BE_FILLED: Year completed }}"
                    }
                ]
            },

            budget: {
                items: [
                    {
                        category: "{{ TO_BE_FILLED: Budget category }}",
                        cost: "{{ TO_BE_FILLED: Cost estimate }}"
                    }
                ],
                total: "{{ TO_BE_FILLED: Total project cost }}"
            },

            responses: {
                functional: analysis.requirements.functional.map(() => "{{ TO_BE_FILLED: Response to functional requirement }}"),
                technical: analysis.requirements.technical.map(() => "{{ TO_BE_FILLED: Response to technical requirement }}"),
                compliance: analysis.requirements.compliance.map(() => "{{ TO_BE_FILLED: Compliance response }}"),
                deliverables: analysis.requirements.deliverables.map(() => "{{ TO_BE_FILLED: Deliverable details }}")
            },

            riskManagement: [
                {
                    description: "{{ TO_BE_FILLED: Identified risk }}",
                    mitigation: "{{ TO_BE_FILLED: Mitigation strategy }}"
                }
            ],

            differentiators: "{{ TO_BE_FILLED: Key differentiators and unique value proposition }}"
        };

        return variables;
    }

    generateRequirementsMarkdown(analysis) {
        let markdown = `# Requirements Analysis: ${analysis.overview.title}\n\n`;
        markdown += `**Generated:** ${analysis.metadata.analysisDate}\n`;
        markdown += `**Source:** ${analysis.metadata.fileName}\n`;
        markdown += `**Organization:** ${analysis.overview.organization}\n`;
        markdown += `**Due Date:** ${analysis.overview.dueDate}\n\n`;

        markdown += `## Project Overview\n\n${analysis.overview.projectSummary}\n\n`;

        if (analysis.requirements.functional.length > 0) {
            markdown += `## Functional Requirements\n\n`;
            analysis.requirements.functional.forEach((req, i) => {
                markdown += `${i + 1}. ${req}\n`;
            });
            markdown += `\n`;
        }

        if (analysis.requirements.technical.length > 0) {
            markdown += `## Technical Requirements\n\n`;
            analysis.requirements.technical.forEach((req, i) => {
                markdown += `${i + 1}. ${req}\n`;
            });
            markdown += `\n`;
        }

        if (analysis.requirements.compliance.length > 0) {
            markdown += `## Compliance Requirements\n\n`;
            analysis.requirements.compliance.forEach((req, i) => {
                markdown += `${i + 1}. ${req}\n`;
            });
            markdown += `\n`;
        }

        if (analysis.requirements.deliverables.length > 0) {
            markdown += `## Expected Deliverables\n\n`;
            analysis.requirements.deliverables.forEach((del, i) => {
                markdown += `${i + 1}. ${del}\n`;
            });
            markdown += `\n`;
        }

        if (analysis.evaluation.criteria.length > 0) {
            markdown += `## Evaluation Criteria\n\n`;
            analysis.evaluation.criteria.forEach((criteria, i) => {
                markdown += `${i + 1}. ${criteria}\n`;
            });
            markdown += `\n`;
        }

        if (analysis.constraints.budget || analysis.constraints.timeline) {
            markdown += `## Project Constraints\n\n`;
            if (analysis.constraints.budget) {
                markdown += `**Budget:** ${analysis.constraints.budget}\n`;
            }
            if (analysis.constraints.timeline) {
                markdown += `**Timeline:** ${analysis.constraints.timeline}\n`;
            }
            if (analysis.constraints.other.length > 0) {
                markdown += `**Other Constraints:**\n`;
                analysis.constraints.other.forEach((constraint, i) => {
                    markdown += `- ${constraint}\n`;
                });
            }
            markdown += `\n`;
        }

        if (analysis.questions.length > 0) {
            markdown += `## Key Questions to Address\n\n`;
            analysis.questions.forEach((question, i) => {
                markdown += `${i + 1}. ${question}\n`;
            });
            markdown += `\n`;
        }

        if (analysis.opportunities.length > 0) {
            markdown += `## Opportunities for Differentiation\n\n`;
            analysis.opportunities.forEach((opp, i) => {
                markdown += `${i + 1}. ${opp}\n`;
            });
        }

        return markdown;
    }
}

module.exports = GeminiService;