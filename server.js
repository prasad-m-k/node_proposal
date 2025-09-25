// Load environment variables first
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const nunjucks = require('nunjucks');
const moment = require('moment');

// Import authentication middleware
const { optionalAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set in environment variables');
  console.error('Please create a .env file with your Gemini API key');
  process.exit(1);
}

console.log('✅ Gemini API key loaded successfully');
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Configure Nunjucks
nunjucks.configure(path.join(__dirname, 'templates'), {
  autoescape: true,
  express: app
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: 'rfp-generator-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Ensure necessary directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const sessionsDir = path.join(__dirname, 'sessions');
const templatesDir = path.join(__dirname, 'templates');

fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(sessionsDir);
fs.ensureDirSync(templatesDir);

// Session file types
const SESSION_FILES = {
  RFP_ORIGINAL: 'rfp-original',
  RFP_REQUIREMENTS: 'rfp-requirements.md',
  RFP_VARIABLES: 'rfp-variables.json',
  RFP_TEMPLATE: 'rfp-template.njk',
  ORG_ORIGINAL: 'org-original',
  ORG_ANALYSIS: 'org-analysis.md'
};

// Helper functions
function getSessionDir(sessionId) {
  return path.join(sessionsDir, sessionId);
}

function ensureSessionDir(sessionId) {
  const sessionDir = getSessionDir(sessionId);
  fs.ensureDirSync(sessionDir);
  return sessionDir;
}

function getSessionName(sessionId) {
  const sessionDir = getSessionDir(sessionId);
  const metaPath = path.join(sessionDir, 'session-meta.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return meta.name || sessionId;
  }
  return sessionId;
}

function saveSessionMeta(sessionId, name, description = '') {
  const sessionDir = ensureSessionDir(sessionId);
  const metaPath = path.join(sessionDir, 'session-meta.json');
  const meta = {
    id: sessionId,
    name: name,
    description: description,
    createdAt: new Date(),
    lastModified: new Date()
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

function getSessionMeta(sessionId) {
  const sessionDir = getSessionDir(sessionId);
  const metaPath = path.join(sessionDir, 'session-meta.json');

  if (!fs.existsSync(metaPath)) {
    return {
      id: sessionId,
      name: sessionId,
      description: '',
      createdAt: new Date(),
      lastModified: new Date()
    };
  }

  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (error) {
    console.error('Error reading session meta:', error);
    return {
      id: sessionId,
      name: sessionId,
      description: '',
      createdAt: new Date(),
      lastModified: new Date()
    };
  }
}

function getAllSessions() {
  const sessions = [];
  if (fs.existsSync(sessionsDir)) {
    const sessionDirs = fs.readdirSync(sessionsDir);
    for (const sessionId of sessionDirs) {
      const sessionDir = path.join(sessionsDir, sessionId);
      if (fs.statSync(sessionDir).isDirectory()) {
        const metaPath = path.join(sessionDir, 'session-meta.json');
        let meta = { id: sessionId, name: sessionId, createdAt: new Date() };
        if (fs.existsSync(metaPath)) {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }

        // Check what files exist
        const files = getSessionFiles(sessionId);
        const hasRfp = files.RFP_ORIGINAL.exists;
        const hasOrg = files.ORG_ORIGINAL.exists;

        sessions.push({
          ...meta,
          hasRfp,
          hasOrg,
          fileCount: Object.values(files).filter(f => f.exists).length
        });
      }
    }
  }
  return sessions.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
}

function getSessionFiles(sessionId) {
  const sessionDir = getSessionDir(sessionId);
  const files = {};

  // Check which files exist
  Object.entries(SESSION_FILES).forEach(([key, filename]) => {
    const filePath = path.join(sessionDir, filename);
    files[key] = {
      exists: fs.existsSync(filePath),
      path: filePath,
      filename: filename
    };
  });

  return files;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.session.currentSessionId || req.session.id;
    const sessionDir = ensureSessionDir(sessionId);
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    // Use consistent filename based on file field name
    const ext = path.extname(file.originalname);
    if (file.fieldname === 'rfpFile') {
      cb(null, `${SESSION_FILES.RFP_ORIGINAL}${ext}`);
    } else if (file.fieldname === 'orgFile') {
      cb(null, `${SESSION_FILES.ORG_ORIGINAL}${ext}`);
    } else {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype) ||
      file.originalname.match(/\.(pdf|txt|docx)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, TXT, and DOCX files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// File processing utilities
async function extractTextFromFile(filePath, mimetype) {
  try {
    if (mimetype === 'application/pdf' || filePath.endsWith('.pdf')) {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filePath.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (mimetype === 'text/plain' || filePath.endsWith('.txt')) {
      return await fs.readFile(filePath, 'utf8');
    }
    throw new Error('Unsupported file type');
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw error;
  }
}

// Gemini AI utilities - Enhanced for systematic RFP analysis
async function analyzeRFPRequirements(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are analyzing a legal RFP (Request for Proposal) document. Be systematic, factual, and precise. No hallucination allowed.

CRITICAL: Extract ONLY facts explicitly stated in the document. If something is unclear or not stated, mark it as "Not specified in RFP".

Analyze this RFP document and create a comprehensive requirements analysis in markdown format:

RFP DOCUMENT:
${text}

OUTPUT FORMAT (strict markdown):

# RFP Requirements Analysis

## 1. PROJECT OVERVIEW
- **Project Title**: [exact title from document]
- **Requesting Organization**: [exact name]
- **Project Duration**: [if specified]
- **Budget Range**: [if specified]
- **Project Description**: [factual summary from document]

## 2. MANDATORY REQUIREMENTS
[List each mandatory requirement exactly as stated in the document]
- Requirement 1: [exact text]
- Requirement 2: [exact text]

## 3. TECHNICAL SPECIFICATIONS
[List all technical requirements with exact specifications]
- [Specification 1]: [exact details]
- [Specification 2]: [exact details]

## 4. DELIVERABLES EXPECTED
[List all deliverables mentioned in the document]
- [Deliverable 1]: [description and timeline if provided]
- [Deliverable 2]: [description and timeline if provided]

## 5. EVALUATION CRITERIA
[List evaluation criteria with weights if provided]
- [Criterion 1]: [weight/importance if stated]
- [Criterion 2]: [weight/importance if stated]

## 6. ORGANIZATIONAL REQUIREMENTS
[Qualifications, certifications, experience requirements]
- [Requirement 1]: [exact specification]
- [Requirement 2]: [exact specification]

## 7. TIMELINE AND MILESTONES
[All dates, deadlines, and milestones mentioned]
- [Event/Milestone]: [date/timeframe]

## 8. COMPLIANCE AND REGULATORY REQUIREMENTS
[Any compliance, security, or regulatory requirements]
- [Requirement 1]: [exact specification]

## 9. ADDITIONAL REQUIREMENTS
[Any other requirements not covered above]
- [Requirement 1]: [description]

Be factual and systematic. Only include information explicitly stated in the document.`;

    const result = await model.generateContent(prompt);
    return await result.response.text();
  } catch (error) {
    console.error('Error analyzing RFP requirements:', error);
    throw error;
  }
}

async function extractRFPVariables(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this RFP document and extract ALL variables that would be needed in a response template. Be systematic and comprehensive.

RFP DOCUMENT:
${text}

Extract variables in the following categories and return as JSON:

{
  "organization_info": {
    "company_name": "",
    "company_address": "",
    "contact_person": "",
    "phone": "",
    "email": "",
    "website": ""
  },
  "project_details": {
    "project_title": "",
    "our_proposed_timeline": "",
    "our_proposed_budget": "",
    "project_manager_name": "",
    "project_start_date": ""
  },
  "technical_approach": {
    "methodology": "",
    "technologies_used": [],
    "architecture_approach": "",
    "security_measures": []
  },
  "team_information": {
    "team_size": "",
    "key_personnel": [],
    "certifications": [],
    "relevant_experience_years": ""
  },
  "deliverables": {
    "main_deliverables": [],
    "documentation": [],
    "training_provided": []
  },
  "references": {
    "client_references": [],
    "similar_projects": []
  },
  "compliance": {
    "certifications_held": [],
    "compliance_standards": []
  },
  "additional_info": {
    "value_proposition": "",
    "differentiators": "",
    "support_model": "",
    "warranty_terms": ""
  }
}

Return ONLY the JSON object. Include empty strings for variables that should be filled by the organization.`;

    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not extract JSON from Gemini response');
    }
  } catch (error) {
    console.error('Error extracting RFP variables:', error);
    throw error;
  }
}

async function generateRFPTemplate(requirementsText, variablesJson) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Create a Nunjucks template for an RFP response document. The template should be professional, comprehensive, and use the provided variables.

REQUIREMENTS:
${requirementsText}

VARIABLES AVAILABLE:
${JSON.stringify(variablesJson, null, 2)}

Create a complete Nunjucks template (.njk) that addresses all requirements systematically. Use proper Nunjucks syntax with {{ variable_name }} for variables and {% for %} loops where needed.

The template should include:
1. Executive Summary
2. Company Overview
3. Technical Approach
4. Project Timeline
5. Team Qualifications
6. Deliverables
7. Pricing (if applicable)
8. References
9. Compliance Information

Use professional business language and structure. Make sure to address each requirement from the RFP systematically.

OUTPUT ONLY THE NUNJUCKS TEMPLATE CODE:`;

    const result = await model.generateContent(prompt);
    return await result.response.text();
  } catch (error) {
    console.error('Error generating RFP template:', error);
    throw error;
  }
}

async function analyzeOrganization(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze the following organization document systematically. Extract ONLY factual information explicitly stated in the document.

CRITICAL: Be factual and precise. No hallucination allowed.

ORGANIZATION DOCUMENT:
${text}

OUTPUT FORMAT (strict markdown):

# Organization Analysis

## 1. COMPANY PROFILE
- **Company Name**: [exact name from document]
- **Founded**: [if specified]
- **Size**: [number of employees if stated]
- **Headquarters**: [location if stated]
- **Business Description**: [factual summary from document]

## 2. CORE COMPETENCIES & SERVICES
[List each service/competency exactly as stated in the document]
- Service/Competency 1: [exact description]
- Service/Competency 2: [exact description]

## 3. TECHNICAL CAPABILITIES
[List all technical skills, technologies, platforms mentioned]
- Technology/Platform 1: [exact details]
- Technology/Platform 2: [exact details]

## 4. EXPERIENCE & TRACK RECORD
[List quantifiable experience metrics]
- Projects Completed: [number if stated]
- Years of Experience: [specific experience areas]
- Client Success Metrics: [any metrics provided]

## 5. TEAM EXPERTISE
[Team information and qualifications]
- Team Size: [if specified]
- Key Personnel: [names and roles if mentioned]
- Certifications: [exact certifications listed]

## 6. CERTIFICATIONS & QUALIFICATIONS
[All certifications, accreditations, partnerships]
- Certification 1: [exact name and details]
- Certification 2: [exact name and details]

## 7. DIFFERENTIATORS & VALUE PROPOSITIONS
[Unique selling points mentioned in document]
- Differentiator 1: [exact claim from document]
- Differentiator 2: [exact claim from document]

Be systematic and factual. Only include information explicitly stated in the document.`;

    const result = await model.generateContent(prompt);
    return await result.response.text();
  } catch (error) {
    console.error('Error analyzing organization:', error);
    throw error;
  }
}

async function generateRequirementsMapping(requirementsText, organizationText) {
  const prompt = `You are an expert business analyst. Analyze the RFP requirements and organization capabilities to create a detailed mapping showing how well the organization meets each requirement.

Please create a JSON object with the following structure:

{
  "mappings": [
    {
      "requirement_id": "1",
      "requirement_text": "[exact requirement text]",
      "match_status": "FULL_MATCH|PARTIAL_MATCH|NO_MATCH|POTENTIAL_MATCH",
      "confidence_score": [0-100],
      "organization_evidence": "[specific evidence from organization document]",
      "gap_analysis": "[what's missing if not full match]",
      "recommendations": "[how to address gaps]"
    }
  ],
  "summary": {
    "total_requirements": [number],
    "full_matches": [number],
    "partial_matches": [number],
    "no_matches": [number],
    "potential_matches": [number],
    "overall_score": [0-100],
    "key_strengths": ["strength1", "strength2"],
    "critical_gaps": ["gap1", "gap2"]
  }
}

RFP Requirements:
${requirementsText}

Organization Capabilities:
${organizationText}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    // Clean the response to extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return null;
  } catch (error) {
    console.error('Error generating requirements mapping:', error);
    return null;
  }
}

async function extractVariablesFromOrganization(orgAnalysis, rfpVariables) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Based on the organization analysis, extract and fill as many variables as possible from the RFP variables template.

ORGANIZATION ANALYSIS:
${orgAnalysis}

RFP VARIABLES TEMPLATE:
${JSON.stringify(rfpVariables, null, 2)}

Instructions:
1. Fill in variables with information from the organization analysis
2. Use exact information from the organization document
3. Leave variables empty ("") if information is not available in the organization analysis
4. For arrays, extract relevant items from the organization analysis

Return the filled variables in the same JSON structure:`;

    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not extract JSON from Gemini response');
    }
  } catch (error) {
    console.error('Error extracting variables from organization:', error);
    throw error;
  }
}

async function generateMatchingAnalysis(rfpAnalysis, orgAnalysis) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Based on the RFP requirements and organization capabilities below, create a detailed matching analysis. For each requirement, assess the organization's capability to meet it and provide a match strength (Strong/Medium/Weak/None) and brief notes.

RFP REQUIREMENTS:
${rfpAnalysis}

ORGANIZATION CAPABILITIES:
${orgAnalysis}

Please provide the analysis in the following JSON format:
{
  "matches": [
    {
      "requirement": "specific requirement text",
      "capability": "matching organization capability",
      "match": "Strong|Medium|Weak|None",
      "notes": "brief explanation of the match assessment"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Could not extract JSON from Gemini response');
    }
  } catch (error) {
    console.error('Error generating matching analysis:', error);
    throw error;
  }
}

async function generateRFPResponse(prompt, rfpAnalysis, orgAnalysis) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fullPrompt = `${prompt}

Based on the following RFP requirements and organization capabilities, generate a comprehensive and professional RFP response:

RFP REQUIREMENTS:
${rfpAnalysis}

ORGANIZATION CAPABILITIES:
${orgAnalysis}

Please structure the response with clear sections and professional formatting suitable for a business proposal.`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating RFP response:', error);
    throw error;
  }
}

// Routes
// Authentication routes
app.use('/api/auth', authRoutes);

// Apply optional auth to all API routes to get user info if available
app.use('/api', optionalAuth);

app.get('/', (req, res) => {
  // Always redirect to login page - authentication will be handled by frontend
  res.redirect('/login.html');
});

// Serve the main application (protected route)
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get all sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = getAllSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Create new session
app.post('/api/sessions', (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const sessionId = uuidv4();
    saveSessionMeta(sessionId, name.trim(), description || '');

    // Update current session
    req.session.currentSessionId = sessionId;
    req.session.sessionName = name.trim();

    res.json({
      success: true,
      sessionId,
      name: name.trim(),
      description: description || ''
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Create new session (route that frontend expects)
app.post('/api/session/create', (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const sessionId = uuidv4();
    saveSessionMeta(sessionId, name.trim(), description || '');

    // Update current session
    req.session.currentSessionId = sessionId;
    req.session.sessionName = name.trim();

    res.json({
      success: true,
      sessionId,
      name: name.trim(),
      description: description || ''
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Select existing session (route that frontend expects)
app.post('/api/session/select', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const sessionDir = getSessionDir(sessionId);
    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Load session metadata
    const sessionMeta = getSessionMeta(sessionId);
    const sessionFiles = getSessionFiles(sessionId);

    // Update current session
    req.session.currentSessionId = sessionId;
    req.session.sessionName = sessionMeta.name;

    // Clear and reload session data from files
    req.session.rfpData = null;
    req.session.orgData = null;

    // Load RFP data if variables file exists
    if (sessionFiles.RFP_VARIABLES.exists) {
      try {
        const variablesContent = await fs.readFile(sessionFiles.RFP_VARIABLES.path, 'utf8');
        req.session.rfpData = JSON.parse(variablesContent);
      } catch (error) {
        console.error('Error loading RFP variables:', error);
      }
    }

    res.json({
      success: true,
      sessionId: sessionId,
      sessionName: sessionMeta.name
    });
  } catch (error) {
    console.error('Error selecting session:', error);
    res.status(500).json({ error: 'Failed to select session' });
  }
});

// Clear all sessions
app.post('/api/sessions/clear-all', (req, res) => {
  try {
    const sessionsDir = path.join(__dirname, 'sessions');
    if (fs.existsSync(sessionsDir)) {
      fs.rmSync(sessionsDir, { recursive: true, force: true });
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // Reset current session
    req.session.currentSessionId = uuidv4();
    req.session.sessionName = null;

    res.json({
      success: true,
      message: 'All sessions cleared'
    });
  } catch (error) {
    console.error('Error clearing sessions:', error);
    res.status(500).json({ error: 'Failed to clear sessions' });
  }
});

// Delete specific session
app.post('/api/session/delete', (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const sessionDir = getSessionDir(sessionId);
    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete the session directory and all its files
    fs.rmSync(sessionDir, { recursive: true, force: true });

    // If we deleted the current session, reset it
    if (req.session.currentSessionId === sessionId) {
      req.session.currentSessionId = uuidv4();
      req.session.sessionName = null;
      req.session.rfpData = null;
      req.session.orgData = null;
    }

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Switch to existing session
app.post('/api/sessions/:sessionId/switch', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const sessionDir = getSessionDir(sessionId);

    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionName = getSessionName(sessionId);
    req.session.currentSessionId = sessionId;
    req.session.sessionName = sessionName;

    res.json({
      success: true,
      sessionId,
      name: sessionName
    });

  } catch (error) {
    console.error('Error switching session:', error);
    res.status(500).json({ error: 'Failed to switch session' });
  }
});

// Upload RFP file and generate all required files
app.post('/api/upload/rfp', upload.single('rfpFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sessionId = req.session.currentSessionId || req.session.id;
    const sessionDir = ensureSessionDir(sessionId);
    const sessionFiles = getSessionFiles(sessionId);

    // Extract text from uploaded file
    const text = await extractTextFromFile(req.file.path, req.file.mimetype);

    // Check if cached files exist and use_cache parameter
    const useCache = req.body.use_cache !== 'false';

    let requirements, variables, template;

    if (useCache && sessionFiles.RFP_REQUIREMENTS.exists &&
        sessionFiles.RFP_VARIABLES.exists && sessionFiles.RFP_TEMPLATE.exists) {

      // Load from cache
      console.log('Loading RFP analysis from cache');
      requirements = await fs.readFile(sessionFiles.RFP_REQUIREMENTS.path, 'utf8');
      variables = JSON.parse(await fs.readFile(sessionFiles.RFP_VARIABLES.path, 'utf8'));
      template = await fs.readFile(sessionFiles.RFP_TEMPLATE.path, 'utf8');

    } else {
      // Generate new analysis
      console.log('Generating new RFP analysis with Gemini');

      requirements = await analyzeRFPRequirements(text);
      variables = await extractRFPVariables(text);
      template = await generateRFPTemplate(requirements, variables);

      // Save to session directory
      await fs.writeFile(sessionFiles.RFP_REQUIREMENTS.path, requirements);
      await fs.writeFile(sessionFiles.RFP_VARIABLES.path, JSON.stringify(variables, null, 2));
      await fs.writeFile(sessionFiles.RFP_TEMPLATE.path, template);
    }

    // Store session data
    req.session.rfpData = {
      originalFileName: req.file.originalname,
      uploadedAt: new Date(),
      textContent: text
    };

    res.json({
      success: true,
      sessionId: sessionId,
      files: {
        original: req.file.originalname,
        requirements: SESSION_FILES.RFP_REQUIREMENTS,
        variables: SESSION_FILES.RFP_VARIABLES,
        template: SESSION_FILES.RFP_TEMPLATE
      },
      fromCache: useCache && sessionFiles.RFP_REQUIREMENTS.exists
    });

  } catch (error) {
    console.error('RFP upload error:', error);
    res.status(500).json({ error: 'Failed to process RFP file: ' + error.message });
  }
});

// Upload organization file and analyze
app.post('/api/upload/organization', upload.single('orgFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sessionId = req.session.currentSessionId || req.session.id;
    const sessionFiles = getSessionFiles(sessionId);

    // Check if RFP was uploaded first
    if (!sessionFiles.RFP_VARIABLES.exists) {
      return res.status(400).json({ error: 'Please upload and analyze an RFP document first' });
    }

    // Extract text from uploaded file
    const text = await extractTextFromFile(req.file.path, req.file.mimetype);

    // Check if cached organization analysis exists
    const useCache = req.body.use_cache !== 'false';
    let orgAnalysis;

    if (useCache && sessionFiles.ORG_ANALYSIS.exists) {
      // Load from cache
      console.log('Loading organization analysis from cache');
      orgAnalysis = await fs.readFile(sessionFiles.ORG_ANALYSIS.path, 'utf8');
    } else {
      // Generate new analysis
      console.log('Generating new organization analysis with Gemini');
      orgAnalysis = await analyzeOrganization(text);

      // Save organization analysis
      await fs.writeFile(sessionFiles.ORG_ANALYSIS.path, orgAnalysis);

      // Generate requirements-organization mapping if RFP requirements exist
      if (sessionFiles.RFP_REQUIREMENTS.exists) {
        console.log('Generating requirements-organization mapping with Gemini');
        const requirementsText = await fs.readFile(sessionFiles.RFP_REQUIREMENTS.path, 'utf8');
        const mappingData = await generateRequirementsMapping(requirementsText, orgAnalysis);

        if (mappingData) {
          const sessionId = req.session.currentSessionId || req.session.id;
          const mappingPath = path.join(getSessionDir(sessionId), 'requirements-mapping.json');
          await fs.writeFile(mappingPath, JSON.stringify(mappingData, null, 2));
        }
      }
    }

    // Load RFP variables and auto-fill with organization data
    const rfpVariables = JSON.parse(await fs.readFile(sessionFiles.RFP_VARIABLES.path, 'utf8'));
    const filledVariables = await extractVariablesFromOrganization(orgAnalysis, rfpVariables);

    // Store session data
    req.session.orgData = {
      originalFileName: req.file.originalname,
      uploadedAt: new Date(),
      textContent: text,
      analysis: orgAnalysis,
      filledVariables: filledVariables
    };

    res.json({
      success: true,
      sessionId: sessionId,
      files: {
        original: req.file.originalname,
        analysis: SESSION_FILES.ORG_ANALYSIS
      },
      analysis: orgAnalysis,
      filledVariables: filledVariables,
      fromCache: useCache && sessionFiles.ORG_ANALYSIS.exists
    });

  } catch (error) {
    console.error('Organization upload error:', error);
    res.status(500).json({ error: 'Failed to process organization file: ' + error.message });
  }
});


// Generate DOCX document
app.post('/api/generate/docx', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!req.session.rfpFile || !req.session.orgFile) {
      return res.status(400).json({ error: 'Both RFP and organization files must be uploaded first' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Generate the response content using Gemini
    const responseContent = await generateRFPResponse(
      prompt,
      req.session.rfpFile.analysis,
      req.session.orgFile.analysis
    );

    // Create DOCX document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "RFP Response Document",
                bold: true,
                size: 32,
              }),
            ],
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated on: ${new Date().toLocaleDateString()}`,
                italics: true,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          ...responseContent.split('\n\n').map(paragraph =>
            new Paragraph({
              children: [
                new TextRun({
                  text: paragraph.trim(),
                }),
              ],
            })
          ),
        ],
      }],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Save file to session directory
    const fileName = `rfp-response-${Date.now()}.docx`;
    const sessionDir = path.join(uploadsDir, req.session.id);
    const filePath = path.join(sessionDir, fileName);

    await fs.writeFile(filePath, buffer);

    req.session.generatedDoc = {
      fileName,
      filePath,
      content: responseContent
    };

    res.json({
      success: true,
      fileName,
      downloadUrl: `/api/download/${fileName}`
    });

  } catch (error) {
    console.error('DOCX generation error:', error);
    res.status(500).json({ error: 'Failed to generate document: ' + error.message });
  }
});

// Download generated document
app.get('/api/download/:filename', (req, res) => {
  try {
    const fileName = req.params.filename;
    const sessionDir = path.join(uploadsDir, req.session.id);
    const filePath = path.join(sessionDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Get session data and files
app.get('/api/session', (req, res) => {
  const sessionId = req.session.currentSessionId || req.session.id;
  const sessionName = req.session.sessionName || getSessionName(sessionId);
  const sessionFiles = getSessionFiles(sessionId);
  const rfpData = req.session.rfpData;
  const orgData = req.session.orgData;

  res.json({
    sessionId: sessionId,
    sessionName: sessionName,
    files: Object.entries(sessionFiles).map(([key, file]) => ({
      type: key,
      filename: file.filename,
      exists: file.exists,
      path: `/api/session/file/${file.filename}`
    })),
    rfpData: rfpData ? {
      originalFileName: rfpData.originalFileName,
      uploadedAt: rfpData.uploadedAt
    } : null,
    orgData: orgData ? {
      originalFileName: orgData.originalFileName,
      uploadedAt: orgData.uploadedAt,
      filledVariables: orgData.filledVariables
    } : null
  });
});

// Get specific session file content
app.get('/api/session/file/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const sessionId = req.session.currentSessionId || req.session.id;
    const sessionDir = getSessionDir(sessionId);
    const filePath = path.join(sessionDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'text/plain';

    if (ext === '.json') {
      contentType = 'application/json';
    } else if (ext === '.md') {
      contentType = 'text/markdown';
    } else if (ext === '.njk') {
      contentType = 'text/plain';
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.type(contentType).send(content);

  } catch (error) {
    console.error('Error reading session file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Refresh/regenerate specific files
app.post('/api/session/refresh', async (req, res) => {
  try {
    const { files } = req.body; // Array of file types to refresh: ['requirements', 'variables', 'template']

    if (!req.session.rfpData) {
      return res.status(400).json({ error: 'No RFP data found. Please upload an RFP first.' });
    }

    const sessionFiles = getSessionFiles(req.session.id);
    const text = req.session.rfpData.textContent;

    const refreshed = {};

    for (const fileType of files) {
      console.log(`Refreshing ${fileType} with Gemini`);

      if (fileType === 'requirements') {
        const requirements = await analyzeRFPRequirements(text);
        await fs.writeFile(sessionFiles.RFP_REQUIREMENTS.path, requirements);
        refreshed.requirements = requirements;

      } else if (fileType === 'variables') {
        const variables = await extractRFPVariables(text);
        await fs.writeFile(sessionFiles.RFP_VARIABLES.path, JSON.stringify(variables, null, 2));
        refreshed.variables = variables;

      } else if (fileType === 'template') {
        // Need both requirements and variables for template
        let requirements = refreshed.requirements;
        if (!requirements && sessionFiles.RFP_REQUIREMENTS.exists) {
          requirements = await fs.readFile(sessionFiles.RFP_REQUIREMENTS.path, 'utf8');
        }

        let variables = refreshed.variables;
        if (!variables && sessionFiles.RFP_VARIABLES.exists) {
          variables = JSON.parse(await fs.readFile(sessionFiles.RFP_VARIABLES.path, 'utf8'));
        }

        if (requirements && variables) {
          const template = await generateRFPTemplate(requirements, variables);
          await fs.writeFile(sessionFiles.RFP_TEMPLATE.path, template);
          refreshed.template = template;
        }
      }
    }

    res.json({
      success: true,
      refreshed: Object.keys(refreshed),
      sessionId: req.session.id
    });

  } catch (error) {
    console.error('Error refreshing files:', error);
    res.status(500).json({ error: 'Failed to refresh files: ' + error.message });
  }
});

// Helper function to find missing required variables
function findMissingVariables(variables) {
  const missingVariables = [];

  function checkObject(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        checkObject(value, fieldPath);
      } else {
        // Check if value is empty (required fields)
        if (value === '' || value === null || value === undefined ||
            (Array.isArray(value) && value.length === 0)) {
          missingVariables.push({
            path: fieldPath,
            section: prefix || key,
            field: key,
            displayName: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          });
        }
      }
    }
  }

  checkObject(variables);
  return missingVariables;
}

// Generate final document using template and variables
app.post('/api/generate/document', async (req, res) => {
  try {
    const { variables } = req.body;

    if (!variables) {
      return res.status(400).json({ error: 'Variables are required' });
    }

    const sessionId = req.session.currentSessionId || req.session.id;
    const sessionFiles = getSessionFiles(sessionId);

    if (!sessionFiles.RFP_TEMPLATE.exists) {
      return res.status(400).json({ error: 'Template file not found. Please upload and process an RFP first.' });
    }

    // Check for missing variables and show specific error
    const missingVariables = findMissingVariables(variables);
    if (missingVariables.length > 0) {
      const firstMissing = missingVariables[0];
      return res.status(400).json({
        error: `Missing required variable: "${firstMissing.displayName}" in ${firstMissing.section.replace(/_/g, ' ').toUpperCase()} section`,
        missingVariable: firstMissing,
        totalMissing: missingVariables.length
      });
    }

    // Read template
    const template = await fs.readFile(sessionFiles.RFP_TEMPLATE.path, 'utf8');

    // Render template with variables using Nunjucks
    const renderedContent = nunjucks.renderString(template, variables);

    // Create DOCX document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "RFP Response Document",
                bold: true,
                size: 32,
              }),
            ],
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated on: ${moment().format('MMMM Do YYYY, h:mm:ss a')}`,
                italics: true,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          ...renderedContent.split('\n\n').map(paragraph =>
            new Paragraph({
              children: [
                new TextRun({
                  text: paragraph.trim(),
                }),
              ],
            })
          ),
        ],
      }],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Save file to session directory
    const fileName = `rfp-response-${Date.now()}.docx`;
    const sessionDir = getSessionDir(sessionId);
    const filePath = path.join(sessionDir, fileName);

    await fs.writeFile(filePath, buffer);

    res.json({
      success: true,
      fileName,
      downloadUrl: `/api/download/${fileName}`,
      content: renderedContent
    });

  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({ error: 'Failed to generate document: ' + error.message });
  }
});

// Clear session
app.post('/api/session/clear', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session clear error:', err);
      return res.status(500).json({ error: 'Failed to clear session' });
    }
    res.json({ success: true });
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`RFP Generator server running at http://localhost:${port}`);
  console.log('Make sure to set your GEMINI_API_KEY environment variable');
});
