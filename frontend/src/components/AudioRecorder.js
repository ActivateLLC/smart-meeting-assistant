import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader, AlertCircle, Activity } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const WS_URL = `ws://${window.location.hostname}:3001`;

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  const [error, setError] = useState(null);
  const [recordedSegments, setRecordedSegments] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const circleCanvasRef = useRef(null);
  const analyserRef = useRef(null);
  const waveformAnimationRef = useRef(null);
  const circleAnimationRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    setAudioContext(context);

    return () => {
      [waveformAnimationRef, circleAnimationRef].forEach(ref => {
        if (ref.current) cancelAnimationFrame(ref.current);
      });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) wsRef.current.close();
      if (audioContext) audioContext.close();
    };
  }, []);

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    wsRef.current = new WebSocket(WS_URL);

    wsRef.current.onopen = () => {
      setIsConnecting(false);
      setError(null);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received:', data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    wsRef.current.onerror = () => {
      setError('WebSocket connection error');
      setIsConnecting(false);
    };

    wsRef.current.onclose = () => {
      setIsConnecting(false);
      if (isRecording) {
        setError('WebSocket connection closed');
        stopRecording();
      }
    };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      connectWebSocket();

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(e.data);
          }
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedSegments(prev => [...prev, {
          id: Date.now(),
          blob,
          url: URL.createObjectURL(blob)
        }]);
      };

      recorder.start(1000);
      setIsRecording(true);
      startVisualizers();
      setError(null);
    } catch (err) {
      setError(`Microphone access error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
    }
    [waveformAnimationRef, circleAnimationRef].forEach(ref => {
      if (ref.current) cancelAnimationFrame(ref.current);
    });
    setIsRecording(false);
    setAudioLevel(0);
  };

  const startVisualizers = () => {
    drawWaveform();
    drawCircleVisualizer();
  };

  const drawWaveform = () => {
    const canvas = waveformCanvasRef.current;
    const analyser = analyserRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      analyser.getByteTimeDomainData(dataArray);
      
      ctx.fillStyle = 'rgb(15, 23, 42)';
      ctx.fillRect(0, 0, width, height);
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(56, 189, 248)';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += Math.abs(dataArray[i] - 128);
      }
      const average = sum / bufferLength;
      setAudioLevel(average / 128);

      waveformAnimationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const drawCircleVisualizer = () => {
    const canvas = circleCanvasRef.current;
    const analyser = analyserRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = 'rgb(15, 23, 42)';
      ctx.fillRect(0, 0, width, height);

      const maxRadius = Math.min(width, height) / 3;
      const bands = 3;
      
      for (let band = 0; band < bands; band++) {
        const radius = maxRadius * ((band + 1) / bands);
        const segments = 32;
        const segmentAngle = (2 * Math.PI) / segments;
        
        ctx.beginPath();
        for (let i = 0; i < segments; i++) {
          const angle = i * segmentAngle;
          const frequencyIndex = Math.floor(i * bufferLength / segments);
          const value = dataArray[frequencyIndex];
          const scale = (value / 255) * 0.3 + 0.7;
          
          const x = centerX + Math.cos(angle) * radius * scale;
          const y = centerY + Math.sin(angle) * radius * scale;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        
        const hue = (band * 40 + Date.now() * 0.05) % 360;
        ctx.strokeStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      circleAnimationRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-slate-900 rounded-xl shadow-xl p-8 border border-slate-800">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center">
            <Activity className="w-8 h-8 mr-3 text-blue-400" />
            Meeting Recorder
          </h2>
          <p className="text-slate-400">Record and analyze conversations in real-time</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 border-red-800 bg-red-950">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-slate-400 mb-2 text-sm font-medium">Waveform</h3>
            <canvas
              ref={waveformCanvasRef}
              className="w-full h-32 rounded-lg"
              width={800}
              height={128}
            />
          </div>

          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <h3 className="text-slate-400 mb-2 text-sm font-medium">Frequency Analysis</h3>
            <canvas
              ref={circleCanvasRef}
              className="w-full h-32 rounded-lg"
              width={400}
              height={128}
            />
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isConnecting}
            className={`relative flex items-center px-8 py-4 rounded-full font-medium transition-all duration-300 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className={`absolute inset-0 rounded-full ${
              isRecording ? 'animate-ping bg-red-400' : ''
            } opacity-75`} />
            
            {isConnecting ? (
              <>
                <Loader className="w-5 h-5 mr-3 animate-spin" />
                Connecting...
              </>
            ) : isRecording ? (
              <>
                <MicOff className="w-5 h-5 mr-3" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-3" />
                Start Recording
              </>
            )}
          </button>
        </div>

        {recordedSegments.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">Recorded Segments</h3>
            <div className="grid gap-4">
              {recordedSegments.map((segment) => (
                <div 
                  key={segment.id} 
                  className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                >
                  <audio
                    src={segment.url}
                    controls
                    className="w-full"
                    onEnded={() => URL.revokeObjectURL(segment.url)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;