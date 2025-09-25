const SimpleDatabase = require('./database');

class AuthMiddleware {
    constructor() {
        this.db = new SimpleDatabase();
    }

    // Middleware to check if user is authenticated
    requireAuth = async (req, res, next) => {
        try {
            const sessionId = req.session?.sessionId;

            if (!sessionId) {
                return this.redirectToLogin(req, res);
            }

            const session = await this.db.findSession(sessionId);

            if (!session) {
                req.session.destroy((err) => {
                    if (err) console.error('Session destroy error:', err);
                });
                return this.redirectToLogin(req, res);
            }

            // Get full user info including theme
            const user = await this.db.findUserByUsername(session.username);

            // Add user info to request
            req.user = {
                id: session.userId,
                username: session.username,
                theme: user?.theme || 'bright'
            };

            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            return this.redirectToLogin(req, res);
        }
    }

    // Middleware to redirect authenticated users from login page
    redirectIfAuthenticated = async (req, res, next) => {
        try {
            const sessionId = req.session?.sessionId;

            if (sessionId) {
                const session = await this.db.findSession(sessionId);
                if (session) {
                    return res.redirect('/');
                }
            }

            next();
        } catch (error) {
            console.error('Redirect middleware error:', error);
            next();
        }
    }

    // Helper method to handle login redirects
    redirectToLogin(req, res) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        return res.redirect('/login');
    }

    // Login method
    async login(username, password, rememberMe = false) {
        try {
            // Validate credentials
            const isValid = await this.db.validatePassword(username, password);

            if (!isValid) {
                throw new Error('Invalid username or password');
            }

            // Get user info
            const user = await this.db.findUserByUsername(username);

            if (!user) {
                throw new Error('User not found');
            }

            // Create session with remember me option
            const sessionId = await this.db.createSession(user.id, user.username, rememberMe);

            if (!sessionId) {
                throw new Error('Failed to create session');
            }

            return {
                sessionId,
                user: {
                    id: user.id,
                    username: user.username,
                    theme: user.theme || 'bright'
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Register method
    async register(username, password, email, theme) {
        try {
            // Basic validation
            if (!username || !password) {
                throw new Error('Username and password are required');
            }

            if (username.length < 3 || username.length > 20) {
                throw new Error('Username must be between 3 and 20 characters');
            }

            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            // Validate username format (alphanumeric, lowercase, starts with letter)
            const usernameRegex = /^[a-z][a-z0-9]*$/;
            if (!usernameRegex.test(username)) {
                throw new Error('Username must be lowercase alphanumeric and start with a letter');
            }

            // Validate email format if provided
            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new Error('Please enter a valid email address');
                }
            }

            // Validate theme
            if (theme && !['bright', 'dark'].includes(theme)) {
                throw new Error('Theme must be either bright or dark');
            }

            const user = await this.db.createUser(username, password, email, theme);
            return user;
        } catch (error) {
            throw error;
        }
    }

    // Logout method
    async logout(sessionId) {
        try {
            if (sessionId) {
                await this.db.deleteSession(sessionId);
            }
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }

    // Update profile method
    async updateProfile(userId, updates, currentPassword) {
        try {
            // Validate current password
            const user = await this.db.findUserByUsername(updates.username || '');
            if (!user || !(await this.db.validatePassword(user.username, currentPassword))) {
                // If username not provided, find user by ID
                const users = await this.db.readFile(this.db.usersFile);
                const userById = users.find(u => u.id === userId);
                if (!userById || !(await this.db.validatePassword(userById.username, currentPassword))) {
                    throw new Error('Current password is incorrect');
                }
            }

            // Validate email format if provided
            if (updates.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(updates.email)) {
                    throw new Error('Please enter a valid email address');
                }
            }

            // Validate theme
            if (updates.theme && !['bright', 'dark'].includes(updates.theme)) {
                throw new Error('Theme must be either bright or dark');
            }

            // Validate new password if provided
            if (updates.newPassword) {
                if (updates.newPassword.length < 6) {
                    throw new Error('New password must be at least 6 characters long');
                }
                updates.password = updates.newPassword;
                delete updates.newPassword;
            }

            const updatedUser = await this.db.updateUser(userId, updates);
            return updatedUser;
        } catch (error) {
            throw error;
        }
    }

    // Get user info from session
    async getUserFromSession(sessionId) {
        try {
            if (!sessionId) {
                return null;
            }

            const session = await this.db.findSession(sessionId);

            if (!session) {
                return null;
            }

            return {
                id: session.userId,
                username: session.username
            };
        } catch (error) {
            console.error('Get user from session error:', error);
            return null;
        }
    }
}

module.exports = AuthMiddleware;