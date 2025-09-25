const net = require('net');

const DEFAULT_MAX_ATTEMPTS = 10;

function probePort(port) {
    return new Promise((resolve, reject) => {
        const tester = net.createServer();

        tester.once('error', (err) => {
            tester.close(() => reject(err));
        });

        tester.once('listening', () => {
            tester.close(() => resolve(port));
        });

        tester.listen(port, '0.0.0.0');
    });
}

async function findAvailablePort(startPort, maxAttempts = DEFAULT_MAX_ATTEMPTS) {
    let attempt = 0;
    let port = startPort;

    while (attempt < maxAttempts) {
        try {
            await probePort(port);
            return port;
        } catch (error) {
            if (['EADDRINUSE', 'EACCES'].includes(error.code)) {
                attempt += 1;
                port += 1;
                continue;
            }

            throw error;
        }
    }

    throw new Error(`No available port found in range ${startPort}-${port}`);
}

module.exports = {
    findAvailablePort,
};
