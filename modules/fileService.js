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
                // Create user-specific upload directory
                const userId = req.user?.id || 'anonymous';
                const userUploadDir = path.join(this.uploadDir, userId);
                fs.ensureDirSync(userUploadDir);
                cb(null, userUploadDir);
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

    async updateGeneratedFile(proposalId, fileName, content) {
        try {
            const proposalDir = path.join(this.outputDir, proposalId);
            const filePath = path.join(proposalDir, fileName);

            const exists = await fs.pathExists(filePath);
            if (!exists) {
                throw new Error('File not found');
            }

            await fs.writeFile(filePath, content, 'utf-8');
            const stats = await fs.stat(filePath);

            return {
                size: stats.size,
                modified: stats.mtime
            };
        } catch (error) {
            console.error('Error updating generated file:', error);
            throw new Error(`Failed to update file: ${error.message}`);
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

    async convertToMarkdown(filePath, originalName, proposalId = null) {
        try {
            // Check if we have a cached markdown version for this file
            if (proposalId) {
                const cacheKey = this.generateCacheKey(originalName, filePath);
                const cachedMarkdown = await this.getCachedMarkdown(proposalId, cacheKey);
                if (cachedMarkdown) {
                    console.log(`Using cached markdown for ${originalName}`);
                    return cachedMarkdown;
                }
            }

            const ext = path.extname(originalName).toLowerCase();
            let content = '';

            if (ext === '.md' || ext === '.txt') {
                // Already text-based, read directly
                content = await fs.readFile(filePath, 'utf-8');
            } else if (ext === '.pdf') {
                // For PDF, we need to extract text - for now, read as binary and add note
                const buffer = await fs.readFile(filePath);
                content = `# PDF Document: ${originalName}\n\n[PDF content would be extracted here. Current implementation reads binary data.]\n\nFile size: ${buffer.length} bytes\n\nPlease ensure this PDF contains readable text for proper analysis.`;
            } else if (ext === '.doc' || ext === '.docx') {
                // For Word docs, read as binary and add note
                const buffer = await fs.readFile(filePath);
                content = `# Word Document: ${originalName}\n\n[Word document content would be extracted here. Current implementation reads binary data.]\n\nFile size: ${buffer.length} bytes\n\nPlease convert this document to PDF or plain text for better analysis.`;
            } else {
                // Unknown format, try to read as text
                try {
                    content = await fs.readFile(filePath, 'utf-8');
                } catch (readError) {
                    content = `# Unknown File Format: ${originalName}\n\n[Could not read file content as text.]\n\nPlease ensure the file is in a supported text format (TXT, MD, PDF with text).`;
                }
            }

            // Ensure content is properly formatted as markdown
            if (!content.trim().startsWith('#')) {
                content = `# RFP Document: ${originalName}\n\n${content}`;
            }

            // Cache the converted markdown
            if (proposalId) {
                const cacheKey = this.generateCacheKey(originalName, filePath);
                await this.cacheMarkdown(proposalId, cacheKey, content, originalName);
            }

            return content;
        } catch (error) {
            console.error('Error converting file to markdown:', error);
            return `# Error Reading File: ${originalName}\n\n[Error: ${error.message}]\n\nPlease try uploading the file again in a supported format.`;
        }
    }

    generateCacheKey(originalName, filePath) {
        // Create a cache key based on filename and file modification time
        const crypto = require('crypto');
        const hash = crypto.createHash('md5');
        hash.update(originalName);
        try {
            const stats = fs.statSync(filePath);
            hash.update(stats.mtime.toISOString());
        } catch (error) {
            // If we can't get file stats, just use current time
            hash.update(Date.now().toString());
        }
        return hash.digest('hex');
    }

    async getCachedMarkdown(proposalId, cacheKey) {
        try {
            const cacheDir = path.join(this.outputDir, proposalId, '.cache');
            const cacheFile = path.join(cacheDir, `${cacheKey}.md`);
            const metaFile = path.join(cacheDir, `${cacheKey}.meta.json`);

            const cacheExists = await fs.pathExists(cacheFile);
            const metaExists = await fs.pathExists(metaFile);

            if (cacheExists && metaExists) {
                const content = await fs.readFile(cacheFile, 'utf-8');
                const meta = await fs.readJson(metaFile);

                // Check if cache is still valid (less than 24 hours old)
                const cacheAge = Date.now() - new Date(meta.cachedAt).getTime();
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours

                if (cacheAge < maxAge) {
                    return content;
                }
            }
        } catch (error) {
            console.log('Cache miss or error reading cache:', error.message);
        }
        return null;
    }

    async cacheMarkdown(proposalId, cacheKey, content, originalName) {
        try {
            const cacheDir = path.join(this.outputDir, proposalId, '.cache');
            await fs.ensureDir(cacheDir);

            const cacheFile = path.join(cacheDir, `${cacheKey}.md`);
            const metaFile = path.join(cacheDir, `${cacheKey}.meta.json`);

            await fs.writeFile(cacheFile, content, 'utf-8');
            await fs.writeJson(metaFile, {
                originalName,
                cacheKey,
                cachedAt: new Date().toISOString(),
                contentLength: content.length
            }, { spaces: 2 });

            console.log(`Cached markdown for ${originalName}`);
        } catch (error) {
            console.error('Error caching markdown:', error);
            // Don't throw - caching is optional
        }
    }
}

module.exports = FileService;