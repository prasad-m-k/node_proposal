const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class SimpleDatabase {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'data');
        this.usersFile = path.join(this.dataDir, 'users.json');
        this.sessionsFile = path.join(this.dataDir, 'sessions.json');
        this.proposalsFile = path.join(this.dataDir, 'proposals.json');
        this.init();
    }

    async init() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });

            // Initialize users file if it doesn't exist
            try {
                await fs.access(this.usersFile);
            } catch {
                await fs.writeFile(this.usersFile, JSON.stringify([], null, 2));
            }

            // Initialize sessions file if it doesn't exist
            try {
                await fs.access(this.sessionsFile);
            } catch {
                await fs.writeFile(this.sessionsFile, JSON.stringify([], null, 2));
            }

            // Initialize proposals file if it doesn't exist
            try {
                await fs.access(this.proposalsFile);
            } catch {
                await fs.writeFile(this.proposalsFile, JSON.stringify([], null, 2));
            }
        } catch (error) {
            console.error('Database initialization error:', error);
        }
    }

    async readFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return [];
        }
    }

    async writeFile(filePath, data) {
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
            return false;
        }
    }

    async getAllProposals() {
        return this.readFile(this.proposalsFile);
    }

    async saveAllProposals(proposals) {
        return this.writeFile(this.proposalsFile, proposals);
    }

    // User management methods
    async createUser(username, password, email, theme) {
        try {
            const users = await this.readFile(this.usersFile);

            // Check if username already exists
            if (users.find(user => user.username === username)) {
                throw new Error('Username already exists');
            }

            // Check if email already exists
            if (email && users.find(user => user.email === email)) {
                throw new Error('Email already exists');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new user
            const newUser = {
                id: uuidv4(),
                username,
                email: email || null,
                theme: theme || 'bright',
                password: hashedPassword,
                createdAt: new Date().toISOString()
            };

            users.push(newUser);
            await this.writeFile(this.usersFile, users);

            // Return user without password
            const { password: _, ...userWithoutPassword } = newUser;
            return userWithoutPassword;
        } catch (error) {
            throw error;
        }
    }

    async findUserByUsername(username) {
        try {
            const users = await this.readFile(this.usersFile);
            return users.find(user => user.username === username) || null;
        } catch (error) {
            console.error('Error finding user:', error);
            return null;
        }
    }

    async validatePassword(username, password) {
        try {
            const user = await this.findUserByUsername(username);
            if (!user) {
                return false;
            }

            return await bcrypt.compare(password, user.password);
        } catch (error) {
            console.error('Error validating password:', error);
            return false;
        }
    }

    async updateUser(userId, updates) {
        try {
            const users = await this.readFile(this.usersFile);
            const userIndex = users.findIndex(user => user.id === userId);

            if (userIndex === -1) {
                throw new Error('User not found');
            }

            const user = users[userIndex];

            // Update allowed fields
            if (updates.email !== undefined) {
                // Check if new email already exists (only if different from current)
                if (updates.email !== user.email && updates.email) {
                    const existingUser = users.find(u => u.email === updates.email && u.id !== userId);
                    if (existingUser) {
                        throw new Error('Email already exists');
                    }
                }
                user.email = updates.email;
            }

            if (updates.theme !== undefined) {
                user.theme = updates.theme;
            }

            if (updates.password !== undefined) {
                user.password = await bcrypt.hash(updates.password, 10);
            }

            user.updatedAt = new Date().toISOString();
            users[userIndex] = user;

            await this.writeFile(this.usersFile, users);

            // Return user without password
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            throw error;
        }
    }

    // Session management methods
    async createSession(userId, username, rememberMe = false) {
        try {
            const sessions = await this.readFile(this.sessionsFile);

            const sessionId = uuidv4();

            // Set expiration: 24 hours default, 30 days if remember me
            const expirationTime = rememberMe
                ? 30 * 24 * 60 * 60 * 1000  // 30 days
                : 24 * 60 * 60 * 1000;      // 24 hours

            const newSession = {
                id: sessionId,
                userId,
                username,
                rememberMe: rememberMe || false,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + expirationTime).toISOString()
            };

            sessions.push(newSession);
            await this.writeFile(this.sessionsFile, sessions);

            return sessionId;
        } catch (error) {
            console.error('Error creating session:', error);
            return null;
        }
    }

    async findSession(sessionId) {
        try {
            const sessions = await this.readFile(this.sessionsFile);
            const session = sessions.find(s => s.id === sessionId);

            if (!session) {
                return null;
            }

            // Check if session is expired
            if (new Date(session.expiresAt) < new Date()) {
                await this.deleteSession(sessionId);
                return null;
            }

            return session;
        } catch (error) {
            console.error('Error finding session:', error);
            return null;
        }
    }

    async deleteSession(sessionId) {
        try {
            const sessions = await this.readFile(this.sessionsFile);
            const filteredSessions = sessions.filter(s => s.id !== sessionId);
            await this.writeFile(this.sessionsFile, filteredSessions);
            return true;
        } catch (error) {
            console.error('Error deleting session:', error);
            return false;
        }
    }

    async deleteAllUserSessions(userId) {
        try {
            const sessions = await this.readFile(this.sessionsFile);
            const filteredSessions = sessions.filter(s => s.userId !== userId);
            await this.writeFile(this.sessionsFile, filteredSessions);
            return true;
        } catch (error) {
            console.error('Error deleting user sessions:', error);
            return false;
        }
    }

    async cleanExpiredSessions() {
        try {
            const sessions = await this.readFile(this.sessionsFile);
            const now = new Date();
            const activeSessions = sessions.filter(s => new Date(s.expiresAt) > now);

            if (activeSessions.length !== sessions.length) {
                await this.writeFile(this.sessionsFile, activeSessions);
                console.log(`Cleaned ${sessions.length - activeSessions.length} expired sessions`);
            }

            return true;
        } catch (error) {
            console.error('Error cleaning expired sessions:', error);
            return false;
        }
    }

    // Proposal management methods
    async getProposalsByUser(userId) {
        try {
            const proposals = await this.getAllProposals();
            return proposals.filter(proposal => proposal.userId === userId);
        } catch (error) {
            console.error('Error fetching proposals:', error);
            return [];
        }
    }

    async getProposalRecord(userId, proposalId) {
        try {
            const proposals = await this.getAllProposals();
            return proposals.find(proposal => proposal.id === proposalId && proposal.userId === userId) || null;
        } catch (error) {
            console.error('Error fetching proposal:', error);
            return null;
        }
    }

    async saveProposalRecord(proposal) {
        const proposals = await this.getAllProposals();
        const existingIndex = proposals.findIndex(p => p.id === proposal.id && p.userId === proposal.userId);

        if (existingIndex >= 0) {
            // Update existing proposal
            proposals[existingIndex] = proposal;
        } else {
            // Add new proposal
            proposals.push(proposal);
        }

        await this.saveAllProposals(proposals);
        return proposal;
    }

    async updateProposalRecord(proposal) {
        const proposals = await this.getAllProposals();
        const index = proposals.findIndex(p => p.id === proposal.id && p.userId === proposal.userId);

        if (index === -1) {
            throw new Error('Proposal not found');
        }

        proposals[index] = proposal;
        await this.saveAllProposals(proposals);
        return proposal;
    }

    async deleteProposalRecord(userId, proposalId) {
        const proposals = await this.getAllProposals();
        const filtered = proposals.filter(p => !(p.id === proposalId && p.userId === userId));

        if (filtered.length === proposals.length) {
            throw new Error('Proposal not found');
        }

        await this.saveAllProposals(filtered);
        return true;
    }
}

module.exports = SimpleDatabase;
