// Global variables
let currentStep = 1;
let originalPrompt = '';
let currentSession = null;

// Mock data for demonstration
const mockRFPRequirements = `
**1. PROJECT OVERVIEW**
- Develop a comprehensive customer relationship management (CRM) system
- Target timeline: 6 months implementation
- Budget range: $500,000 - $750,000

**2. MANDATORY REQUIREMENTS**
- Cloud-based architecture with 99.9% uptime SLA
- GDPR and SOC 2 compliance certification
- Minimum 5 years of enterprise software development experience
- Integration with existing ERP systems (SAP, Oracle)

**3. DELIVERABLES EXPECTED**
- Complete CRM application with mobile responsiveness
- User training documentation and video tutorials
- 24/7 technical support for first 12 months
- Data migration from legacy systems

**4. EVALUATION CRITERIA**
- Technical approach and architecture (40%)
- Team experience and qualifications (25%)
- Cost effectiveness and value proposition (20%)
- Implementation timeline and methodology (15%)

**5. TECHNICAL SPECIFICATIONS**
- Support for 10,000+ concurrent users
- RESTful API architecture
- Multi-tenant SaaS deployment
- Advanced analytics and reporting capabilities

**6. ORGANIZATIONAL REQUIREMENTS**
- Dedicated project manager with PMP certification
- Development team with minimum 3 years CRM experience
- References from at least 3 similar enterprise implementations
- ISO 27001 security certification preferred
`;

const mockOrgAnalysis = `
**1. COMPANY PROFILE**
- TechSolutions Inc. - 15 years in business, 200+ employees
- Specialized in enterprise software development and cloud solutions
- Market leader in CRM implementations with 95% client satisfaction rate

**2. CORE COMPETENCIES & SERVICES**
- Custom software development and system integration
- Cloud migration and SaaS platform development
- Enterprise CRM solutions and customer experience optimization

**3. TECHNICAL CAPABILITIES**
- Expertise in modern web technologies (React, Node.js, Python)
- Cloud platforms: AWS, Azure, Google Cloud
- Agile development methodologies and DevOps practices

**4. EXPERIENCE & TRACK RECORD**
- 50+ successful CRM implementations for Fortune 500 companies
- Average project delivery time: 4.5 months
- 98% on-time delivery rate with zero security breaches

**5. TEAM EXPERTISE**
- 25 certified developers with average 7 years experience
- 5 PMP-certified project managers
- Dedicated QA team with automated testing expertise

**6. CERTIFICATIONS & QUALIFICATIONS**
- ISO 27001, SOC 2 Type II, GDPR compliance certified
- AWS Advanced Consulting Partner
- Microsoft Gold Partner for Cloud Platform

**7. DIFFERENTIATORS & VALUE PROPOSITIONS**
- Proprietary CRM framework reducing development time by 40%
- 24/7 global support with 15-minute response time SLA
- Industry-leading data migration success rate of 99.8%
`;

const mockMatchingTable = [
    {
        requirement: "Cloud-based architecture with 99.9% uptime SLA",
        capability: "AWS Advanced Consulting Partner with proven 99.95% uptime track record across 50+ implementations",
        match: "Strong",
        notes: "Exceeds requirement with higher uptime guarantee and extensive cloud expertise"
    },
    {
        requirement: "GDPR and SOC 2 compliance certification",
        capability: "ISO 27001, SOC 2 Type II, GDPR compliance certified with annual audits",
        match: "Strong",
        notes: "Full compliance with all required certifications and additional ISO 27001"
    },
    {
        requirement: "Minimum 5 years of enterprise software development experience",
        capability: "15 years in business with 200+ employees specializing in enterprise solutions",
        match: "Strong",
        notes: "Significantly exceeds minimum requirement with triple the experience"
    },
    {
        requirement: "Integration with existing ERP systems (SAP, Oracle)",
        capability: "Extensive experience with system integration and enterprise platforms",
        match: "Medium",
        notes: "Strong integration capabilities, recommend showcasing specific SAP/Oracle projects"
    },
    {
        requirement: "Support for 10,000+ concurrent users",
        capability: "Proven scalable architecture with cloud-native solutions",
        match: "Strong",
        notes: "Cloud expertise ensures scalability, highlight specific high-volume implementations"
    },
    {
        requirement: "RESTful API architecture",
        capability: "Modern web technologies expertise including API development",
        match: "Strong",
        notes: "Core competency in modern API development and microservices architecture"
    },
    {
        requirement: "Multi-tenant SaaS deployment",
        capability: "SaaS platform development and cloud migration expertise",
        match: "Strong",
        notes: "Direct experience in SaaS development and multi-tenant architectures"
    },
    {
        requirement: "Advanced analytics and reporting capabilities",
        capability: "Custom software development with focus on data solutions",
        match: "Medium",
        notes: "General capability present, recommend highlighting specific analytics projects"
    },
    {
        requirement: "Dedicated project manager with PMP certification",
        capability: "5 PMP-certified project managers on staff",
        match: "Strong",
        notes: "Multiple certified PMs available, exceeds requirement for dedicated resource"
    },
    {
        requirement: "Development team with minimum 3 years CRM experience",
        capability: "25 certified developers with average 7 years experience, 50+ CRM implementations",
        match: "Strong",
        notes: "Significantly exceeds requirement with specialized CRM expertise"
    },
    {
        requirement: "References from at least 3 similar enterprise implementations",
        capability: "50+ successful CRM implementations for Fortune 500 companies",
        match: "Strong",
        notes: "Extensive reference portfolio available, far exceeds minimum requirement"
    },
    {
        requirement: "ISO 27001 security certification preferred",
        capability: "ISO 27001, SOC 2 Type II, GDPR compliance certified",
        match: "Strong",
        notes: "Meets preferred requirement with additional security certifications"
    }
];

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadSessions();
});

function initializeApp() {
    // Set initial step
    goToStep(1);
}

function setupEventListeners() {
    // File input listeners
    document.getElementById('rfpFileInput').addEventListener('change', handleRFPUpload);
    document.getElementById('orgFileInput').addEventListener('change', handleOrgUpload);
    
    // Drag and drop listeners
    setupDragAndDrop('rfpUploadArea', 'rfpFileInput');
    setupDragAndDrop('orgUploadArea', 'orgFileInput');
}

function setupDragAndDrop(areaId, inputId) {
    const area = document.getElementById(areaId);
    const input = document.getElementById(inputId);
    
    area.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        area.classList.add('drag-over');
    });
    
    area.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        area.classList.remove('drag-over');
    });
    
    area.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        area.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(files[0]);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change'));
        }
    });
    
    area.addEventListener('click', function(e) {
        if (!e.target.classList.contains('btn')) {
            input.click();
        }
    });
}

function handleRFPUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!isValidFileType(file)) {
        showError('Please select a valid file type (PDF, TXT, or DOCX)');
        return;
    }
    
    uploadRFP(file);
}

function handleOrgUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!isValidFileType(file)) {
        showError('Please select a valid file type (PDF, TXT, or DOCX)');
        return;
    }
    
    uploadOrg(file);
}

function isValidFileType(file) {
    const validTypes = [
        'application/pdf',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    return validTypes.includes(file.type) || 
           file.name.toLowerCase().endsWith('.pdf') ||
           file.name.toLowerCase().endsWith('.txt') ||
           file.name.toLowerCase().endsWith('.docx');
}

async function uploadRFP(file) {
    showLoading('Analyzing RFP requirements...');
    
    // Simulate API call with mock data
    setTimeout(() => {
        displayRFPAnalysis(mockRFPRequirements);
        showSuccess('RFP analyzed successfully!');
        hideLoading();
    }, 2000);
}

async function uploadOrg(file) {
    showLoading('Analyzing organization details...');
    
    // Simulate API call with mock data
    setTimeout(() => {
        displayOrgAnalysis(mockOrgAnalysis, mockMatchingTable);
        originalPrompt = generateMockPrompt();
        document.getElementById('responsePrompt').value = originalPrompt;
        showSuccess('Organization analyzed successfully!');
        hideLoading();
    }, 2500);
}

function generateMockPrompt() {
    return `Create a comprehensive and compelling RFP response for TechSolutions Inc. that addresses all requirements and showcases our competitive advantages:

**EXECUTIVE SUMMARY**
Position TechSolutions Inc. as the ideal partner for this CRM implementation, highlighting our 15 years of experience, 50+ successful CRM deployments, and 95% client satisfaction rate.

**TECHNICAL APPROACH**
- Emphasize our cloud-native architecture expertise with AWS Advanced Consulting Partner status
- Detail our proprietary CRM framework that reduces development time by 40%
- Highlight our 99.95% uptime track record exceeding the required 99.9% SLA

**TEAM QUALIFICATIONS**
- Showcase our 25 certified developers with average 7 years experience
- Emphasize our 5 PMP-certified project managers
- Highlight our dedicated QA team with automated testing expertise

**COMPLIANCE & SECURITY**
- Detail our ISO 27001, SOC 2 Type II, and GDPR certifications
- Emphasize our zero security breaches track record
- Highlight our 24/7 global support with 15-minute response time SLA

**IMPLEMENTATION METHODOLOGY**
- Present our proven Agile development approach
- Detail our 4.5-month average delivery time (faster than the 6-month requirement)
- Showcase our 98% on-time delivery rate

**VALUE PROPOSITION**
- Emphasize our industry-leading 99.8% data migration success rate
- Highlight cost savings through our efficient development framework
- Detail our comprehensive 24/7 support and training programs

**RISK MITIGATION**
- Address potential challenges and our proven solutions
- Highlight our extensive Fortune 500 client references
- Detail our quality assurance and testing methodologies

The response should be professional, detailed, and demonstrate clear understanding of the client's needs while positioning TechSolutions Inc. as the superior choice for this CRM implementation project.`;
}

function displayRFPAnalysis(requirements) {
    const analysisDiv = document.getElementById('rfpAnalysis');
    const requirementsDiv = document.getElementById('rfpRequirements');
    
    requirementsDiv.innerHTML = formatRequirementsVisually(requirements);
    analysisDiv.classList.remove('hidden');
}

function formatRequirementsVisually(requirements) {
    // Convert markdown-style formatting to HTML
    let formatted = requirements
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    // Wrap consecutive <li> elements in <ul>
    formatted = formatted.replace(/(<li>.*<\/li>(?:\s*<br>\s*<li>.*<\/li>)*)/gs, '<ul>$1</ul>');
    
    // Clean up extra <br> tags around lists
    formatted = formatted.replace(/<br>\s*<ul>/g, '<ul>');
    formatted = formatted.replace(/<\/ul>\s*<br>/g, '</ul>');
    
    return `<p>${formatted}</p>`;
}

function displayOrgAnalysis(analysis, matchingTable) {
    const analysisDiv = document.getElementById('orgAnalysis');
    const capabilitiesDiv = document.getElementById('orgCapabilities');
    const matchingDiv = document.getElementById('matchingTable');
    
    capabilitiesDiv.innerHTML = formatRequirementsVisually(analysis);
    displayMatchingAnalysis(matchingTable, matchingDiv);
    
    analysisDiv.classList.remove('hidden');
}

function displayMatchingAnalysis(matchingTable, container) {
    const stats = calculateMatchingStats(matchingTable);
    
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card strong">
                <div class="stat-number">${stats.strong}</div>
                <div class="stat-label">Strong Matches</div>
            </div>
            <div class="stat-card medium">
                <div class="stat-number">${stats.medium}</div>
                <div class="stat-label">Medium Matches</div>
            </div>
            <div class="stat-card weak">
                <div class="stat-number">${stats.weak}</div>
                <div class="stat-label">Weak Matches</div>
            </div>
            <div class="stat-card none">
                <div class="stat-number">${stats.none}</div>
                <div class="stat-label">Missing</div>
            </div>
        </div>
        
        <div class="matching-analysis">
            <div class="matching-table-container">
                <h4><i class="fas fa-table"></i> Detailed Requirements Analysis</h4>
                <div class="matching-items"></div>
            </div>
            <div class="matching-summary">
                <h4>Match Distribution</h4>
                <div class="chart-container">
                    <canvas id="matchingChart" width="300" height="300"></canvas>
                </div>
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-color strong"></div>
                        <span class="legend-text">Strong</span>
                        <span class="legend-count">${stats.strong}</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color medium"></div>
                        <span class="legend-text">Medium</span>
                        <span class="legend-count">${stats.medium}</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color weak"></div>
                        <span class="legend-text">Weak</span>
                        <span class="legend-count">${stats.weak}</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color none"></div>
                        <span class="legend-text">Missing</span>
                        <span class="legend-count">${stats.none}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Display individual match items
    const matchingItemsContainer = container.querySelector('.matching-items');
    matchingTable.forEach(match => {
        const matchItem = document.createElement('div');
        const strengthClass = match.match.toLowerCase();
        matchItem.className = `match-item ${strengthClass}`;
        
        matchItem.innerHTML = `
            <div class="match-header">
                <div class="match-requirement">${match.requirement}</div>
                <div class="match-strength match-${strengthClass}">${match.match}</div>
            </div>
            <div class="match-capability">${match.capability}</div>
            ${match.notes ? `<div class="match-notes">${match.notes}</div>` : ''}
        `;
        
        matchingItemsContainer.appendChild(matchItem);
    });
    
    // Create pie chart
    setTimeout(() => createMatchingPieChart(stats), 100);
}

function calculateMatchingStats(matchingTable) {
    const stats = { strong: 0, medium: 0, weak: 0, none: 0 };
    
    matchingTable.forEach(match => {
        const strength = match.match.toLowerCase();
        if (stats.hasOwnProperty(strength)) {
            stats[strength]++;
        }
    });
    
    return stats;
}

function createMatchingPieChart(stats) {
    const canvas = document.getElementById('matchingChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Data and colors
    const data = [
        { label: 'Strong', value: stats.strong, color: '#28a745' },
        { label: 'Medium', value: stats.medium, color: '#ffc107' },
        { label: 'Weak', value: stats.weak, color: '#dc3545' },
        { label: 'Missing', value: stats.none, color: '#6c757d' }
    ];
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
        // Draw empty state
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#bbbbbb';
        ctx.font = '16px Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', centerX, centerY);
        return;
    }
    
    let currentAngle = -Math.PI / 2; // Start from top
    
    data.forEach(item => {
        if (item.value > 0) {
            const sliceAngle = (item.value / total) * 2 * Math.PI;
            
            // Draw slice
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fill();
            
            // Draw slice border
            ctx.strokeStyle = '#1e1e1e';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw percentage label if slice is large enough
            const percentage = ((item.value / total) * 100).toFixed(1);
            if (item.value / total > 0.05) {
                const labelAngle = currentAngle + sliceAngle / 2;
                const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
                const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Roboto';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Add text shadow for better readability
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                
                ctx.fillText(`${percentage}%`, labelX, labelY);
                
                // Reset shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
            
            currentAngle += sliceAngle;
        }
    });
    
    // Draw center circle for donut effect
    const innerRadius = radius * 0.4;
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add total count in center
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total.toString(), centerX, centerY - 5);
    
    ctx.font = '12px Roboto';
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText('Total', centerX, centerY + 15);
}

async function generateDocument() {
    const prompt = document.getElementById('responsePrompt').value;
    
    if (!prompt.trim()) {
        showError('Please enter a response prompt');
        return;
    }
    
    showLoading('Generating DOCX document...');
    
    // Simulate document generation
    setTimeout(() => {
        showDownloadSection();
        showSuccess('Document generated successfully!');
        hideLoading();
    }, 3000);
}

function showDownloadSection() {
    const downloadSection = document.getElementById('downloadSection');
    const downloadBtn = document.getElementById('downloadBtn');
    
    downloadBtn.onclick = function() {
        // Simulate download
        showSuccess('Download started! (This is a demo)');
    };
    
    downloadSection.classList.remove('hidden');
}

function resetPrompt() {
    if (originalPrompt) {
        document.getElementById('responsePrompt').value = originalPrompt;
        showSuccess('Prompt reset to original');
    } else {
        showError('No original prompt available');
    }
}

function goToStep(step) {
    // Update progress steps
    document.querySelectorAll('.progress-step').forEach((el, index) => {
        el.classList.toggle('active', index + 1 <= step);
        if (index + 1 < step) {
            el.classList.add('completed');
        }
    });
    
    // Update content sections
    document.querySelectorAll('.content-section').forEach((el, index) => {
        el.classList.toggle('active', index + 1 === step);
    });
    
    currentStep = step;
}

function loadSessions() {
    const sessionsList = document.getElementById('sessionsList');
    sessionsList.innerHTML = '<div style="color: #bbb; text-align: center; padding: 20px;">No sessions yet<br><small>Upload an RFP to get started</small></div>';
}

// Utility functions
function showLoading(message = 'Processing...') {
    document.getElementById('loadingText').textContent = message;
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showError(message) {
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').classList.remove('hidden');
    
    // Auto hide after 5 seconds
    setTimeout(hideError, 5000);
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

function showSuccess(message) {
    document.getElementById('successText').textContent = message;
    document.getElementById('successMessage').classList.remove('hidden');
    
    // Auto hide after 3 seconds
    setTimeout(hideSuccess, 3000);
}

function hideSuccess() {
    document.getElementById('successMessage').classList.add('hidden');
}

// Make functions globally available
window.goToStep = goToStep;
window.resetPrompt = resetPrompt;
window.generateDocument = generateDocument;
window.hideError = hideError;
window.hideSuccess = hideSuccess;
