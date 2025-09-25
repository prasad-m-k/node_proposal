const express = require('express');
const session = require('express-session');
const path = require('path');
const AuthMiddleware = require('./modules/auth');
const ProposalService = require('./modules/proposals');

function createApp() {
    const app = express();
    const auth = new AuthMiddleware();
    const proposalService = new ProposalService(auth.db);

    // Session configuration
    app.use(session({
        secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // Set to true in production with HTTPS
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }));

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static('public'));

    // Clean expired sessions periodically (every hour)
    const cleanupInterval = setInterval(() => {
        auth.db.cleanExpiredSessions();
    }, 60 * 60 * 1000);
    cleanupInterval.unref();

    // Page routes
    app.get('/login', auth.redirectIfAuthenticated, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });

    app.get('/', auth.requireAuth, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.get('/profile', auth.requireAuth, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'profile.html'));
    });

    // API routes
    app.post('/api/register', async (req, res) => {
        try {
            const { username, password, email, theme } = req.body;
            const user = await auth.register(username, password, email, theme);
            await proposalService.ensureSeedProposals(user.id, user.username);

            res.json({
                success: true,
                message: 'Registration successful',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    theme: user.theme
                }
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    });

    app.post('/api/login', async (req, res) => {
        try {
            const { username, password, rememberMe } = req.body;
            const loginResult = await auth.login(username, password, rememberMe);

            req.session.sessionId = loginResult.sessionId;

            await proposalService.ensureSeedProposals(loginResult.user.id, loginResult.user.username);

            res.json({
                success: true,
                message: 'Login successful',
                user: loginResult.user
            });
        } catch (error) {
            res.status(401).json({
                success: false,
                message: error.message
            });
        }
    });

    app.post('/api/logout', async (req, res) => {
        try {
            const sessionId = req.session?.sessionId;

            if (sessionId) {
                await auth.logout(sessionId);
            }

            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Logout failed'
                    });
                }

                res.json({
                    success: true,
                    message: 'Logout successful'
                });
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
    });

    app.get('/api/user', auth.requireAuth, async (req, res) => {
        try {
            res.json(req.user);
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user information'
            });
        }
    });

    app.put('/api/profile', auth.requireAuth, async (req, res) => {
        try {
            const { email, theme, currentPassword, newPassword, confirmPassword } = req.body;

            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is required'
                });
            }

            if (newPassword && newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'New passwords do not match'
                });
            }

            const updates = {
                email,
                theme
            };

            if (newPassword) {
                updates.newPassword = newPassword;
            }

            const updatedUser = await auth.updateProfile(req.user.id, updates, currentPassword);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: updatedUser
            });
        } catch (error) {
            console.error('Profile update error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    });

    // Proposal routes
    app.get('/api/proposals', auth.requireAuth, async (req, res) => {
        try {
            await proposalService.ensureSeedProposals(req.user.id, req.user.username);
            const proposals = await proposalService.listProposals(req.user.id);
            res.json({ success: true, proposals });
        } catch (error) {
            console.error('List proposals error:', error);
            res.status(500).json({ success: false, message: 'Failed to load proposals' });
        }
    });

    app.post('/api/proposals', auth.requireAuth, async (req, res) => {
        try {
            const { name } = req.body;
            const proposal = await proposalService.createProposal(req.user.id, req.user.username, name);
            res.status(201).json({ success: true, proposal });
        } catch (error) {
            console.error('Create proposal error:', error);
            res.status(400).json({ success: false, message: error.message || 'Failed to create proposal' });
        }
    });

    app.delete('/api/proposals/:proposalId', auth.requireAuth, async (req, res) => {
        try {
            await proposalService.deleteProposal(req.user.id, req.params.proposalId);
            res.json({ success: true });
        } catch (error) {
            console.error('Delete proposal error:', error);
            res.status(400).json({ success: false, message: error.message || 'Failed to delete proposal' });
        }
    });

    // 404 handler
    app.use((req, res) => {
        res.status(404).redirect('/login');
    });

    // Error handler
    app.use((err, req, res, next) => {
        console.error('Server error:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    });

    return app;
}

module.exports = createApp;
