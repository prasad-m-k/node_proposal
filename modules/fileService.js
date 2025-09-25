const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

class FileService {
    constructor() {
        this.uploadDir = path.join(__dirname, '..', 'uploads');
        this.outputDir = path.join(__dirname, '..', 'generated');

        // Ensure directories exist
        fs.ensureDirSync(this.uploadDir);
        fs.ensureDirSync(this.outputDir);

        // Configure multer for file uploads
        this.storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, this.uploadDir);
            },
            filename: (req, file, cb) => {
                const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
                cb(null, uniqueName);
            }
        });

        this.fileFilter = (req, file, cb) => {
            // Allow these file types for RFP documents
            const allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                'text/markdown',
                'application/rtf'
            ];

            if (allowedTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error('Only PDF, Word, TXT, Markdown, and RTF files are allowed'), false);
            }
        };

        this.upload = multer({
            storage: this.storage,
            fileFilter: this.fileFilter,
            limits: {
                fileSize: 10 * 1024 * 1024 // 10MB limit
            }
        });
    }

    getUploadMiddleware() {
        return this.upload.single('rfpDocument');
    }

    async saveGeneratedFile(content, fileName, proposalId, type = 'text') {
        try {
            const proposalDir = path.join(this.outputDir, proposalId);
            await fs.ensureDir(proposalDir);

            const filePath = path.join(proposalDir, fileName);

            if (type === 'json') {
                await fs.writeJson(filePath, content, { spaces: 2 });
            } else {
                await fs.writeFile(filePath, content, 'utf-8');
            }

            return {
                id: uuidv4(),
                name: fileName,
                path: filePath,
                type: type,
                createdAt: new Date().toISOString(),
                size: (await fs.stat(filePath)).size
            };
        } catch (error) {
            console.error('Error saving generated file:', error);
            throw new Error(`Failed to save file: ${error.message}`);
        }
    }

    async getGeneratedFile(proposalId, fileName) {
        try {
            const filePath = path.join(this.outputDir, proposalId, fileName);
            const exists = await fs.pathExists(filePath);

            if (!exists) {
                throw new Error('File not found');
            }

            const content = await fs.readFile(filePath, 'utf-8');
            const stats = await fs.stat(filePath);

            return {
                content,
                size: stats.size,
                modified: stats.mtime
            };
        } catch (error) {
            console.error('Error reading generated file:', error);
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }

    async listGeneratedFiles(proposalId) {
        try {
            const proposalDir = path.join(this.outputDir, proposalId);
            const exists = await fs.pathExists(proposalDir);

            if (!exists) {
                return [];
            }

            const files = await fs.readdir(proposalDir);
            const fileDetails = await Promise.all(
                files.map(async (file) => {
                    const filePath = path.join(proposalDir, file);
                    const stats = await fs.stat(filePath);

                    return {
                        name: file,
                        size: stats.size,
                        created: stats.birthtime,
                        modified: stats.mtime,
                        type: this.getFileType(file)
                    };
                })
            );

            return fileDetails;
        } catch (error) {
            console.error('Error listing generated files:', error);
            throw new Error(`Failed to list files: ${error.message}`);
        }
    }

    getFileType(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        switch (ext) {
            case '.md':
                return 'markdown';
            case '.json':
                return 'json';
            case '.yaml':
            case '.yml':
                return 'yaml';
            case '.txt':
                return 'text';
            default:
                return 'unknown';
        }
    }

    async deleteUploadedFile(filePath) {
        try {
            await fs.remove(filePath);
        } catch (error) {
            console.error('Error deleting uploaded file:', error);
        }
    }

    async deleteGeneratedFiles(proposalId) {
        try {
            const proposalDir = path.join(this.outputDir, proposalId);
            await fs.remove(proposalDir);
        } catch (error) {
            console.error('Error deleting generated files:', error);
        }
    }
}

module.exports = FileService;