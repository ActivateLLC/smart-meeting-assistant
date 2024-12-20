# Smart Meeting Assistant

An AI-powered meeting assistant that transcribes conversations, distinguishes between speakers, and provides intelligent summaries of business meetings.

## Features

- Real-time voice recognition with speaker diarization
- Live transcription with speaker labels
- AI-powered meeting summarization
- Key points extraction per speaker
- Action items identification
- Meeting analytics

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd frontend && npm install
   ```
3. Copy `.env.example` to `.env` and configure your environment variables
4. Start the development server:
   ```bash
   npm run dev:full
   ```

## Architecture

### Frontend
- React.js for UI components
- Web Audio API for audio recording and visualization
- WebSocket client for real-time communication
- Tailwind CSS for styling

### Backend
- Node.js/Express server
- WebSocket server for real-time audio streaming
- Speaker diarization processing
- MongoDB for data storage

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.