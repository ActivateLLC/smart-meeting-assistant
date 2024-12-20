const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);