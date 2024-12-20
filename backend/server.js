import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store active connections
const clients = new Map();

// Handle WebSocket connections
wss.on('connection', (ws) => {
    const clientId = Date.now();
    clients.set(ws, clientId);

    console.log(`Client ${clientId} connected`);

    // Handle incoming messages
    ws.on('message', async (message) => {
        try {
            // Convert message to Buffer if it's not already
            const audioData = Buffer.from(message);
            
            // Here we'll add speaker diarization and transcription
            // For now, just echo back the data
            ws.send(JSON.stringify({
                type: 'audio_processed',
                data: {
                    clientId,
                    timestamp: Date.now(),
                    // This is where we'll add processed data
                }
            }));
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Error processing audio data'
            }));
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        console.log(`Client ${clientId} disconnected`);
        clients.delete(ws);
    });

    // Send initial connection confirmation
    ws.send(JSON.stringify({
        type: 'connected',
        clientId
    }));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Internal Server Error'
    });
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    console.log('Starting graceful shutdown...');

    // Close all WebSocket connections
    wss.clients.forEach((client) => {
        client.close(1000, 'Server shutting down');
    });

    // Close the WebSocket server
    wss.close(() => {
        console.log('WebSocket server closed');
        // Close the HTTP server
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    });

    // If nothing happens after 5s, force shutdown
    setTimeout(() => {
        console.log('Forcing shutdown after timeout');
        process.exit(1);
    }, 5000);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});