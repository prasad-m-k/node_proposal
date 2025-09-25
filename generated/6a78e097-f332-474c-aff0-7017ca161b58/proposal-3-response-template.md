# {{ metadata.proposalName }} - Response to {{ overview.title }}

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
