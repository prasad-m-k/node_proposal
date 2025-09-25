// Load environment variables
require('dotenv').config();

const createApp = require('./app');
const { findAvailablePort } = require('./modules/serverUtils');

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_ATTEMPTS = 10;

async function startServer() {
    try {
        const port = await findAvailablePort(DEFAULT_PORT, MAX_PORT_ATTEMPTS);
        process.env.PORT = String(port);

        const app = createApp();
        app.listen(port, () => {
            console.log(`AI RFP Proposal Generator running at http://localhost:${port}`);
            console.log(`Login page: http://localhost:${port}/login`);
        }).on('error', (err) => {
            console.error('Failed to start server:', err);
            process.exit(1);
        });
    } catch (error) {
        console.error(`Unable to find an available port starting from ${DEFAULT_PORT}:`, error.message);
        console.error('Tip: ensure no other process is using the desired port or set PORT env variable.');
        process.exit(1);
    }
}

startServer();
