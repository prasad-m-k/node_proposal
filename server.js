const express = require('express');
const session = require('express-session');
const path = require('path');
const AuthMiddleware = require('./modules/auth');

const app = express();
const port = process.env.PORT || 3000;

// Initialize authentication
const auth = new AuthMiddleware();

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
setInterval(() => {
    auth.db.cleanExpiredSessions();
}, 60 * 60 * 1000);

// Routes

// Login page (redirect if already authenticated)
app.get('/login', auth.redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Main app (requires authentication)
app.get('/', auth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Profile page (requires authentication)
app.get('/profile', auth.requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// API Routes

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email, theme } = req.body;
        const user = await auth.register(username, password, email, theme);

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

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;
        const loginResult = await auth.login(username, password, rememberMe);

        // Store session ID in session
        req.session.sessionId = loginResult.sessionId;

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

// Logout endpoint
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

// Get current user info
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

// Update user profile
app.put('/api/profile', auth.requireAuth, async (req, res) => {
    try {
        const { email, theme, currentPassword, newPassword, confirmPassword } = req.body;

        // Validate required current password
        if (!currentPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password is required'
            });
        }

        // Validate password confirmation if new password provided
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

app.listen(port, () => {
    console.log(`AI RFP Proposal Generator running at http://localhost:${port}`);
    console.log(`Login page: http://localhost:${port}/login`);
});