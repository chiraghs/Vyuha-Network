import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Mic, Square, FileDown, ShieldCheck, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatAssistantProps {
  token: string;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ token }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '🛡️ <b>KSP SCRB Intellibot Activated.</b><br/>You can query criminal records, discover crime patterns, and map accomplice networks in natural language (English / ಕನ್ನಡ). You can type or use the voice recording button below.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat audit history on startup
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('/api/chat/history', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data && res.data.length > 0) {
          const historicalMessages = res.data.reverse().flatMap((audit: any) => [
            {
              id: `q-${audit.id}`,
              sender: 'user',
              text: audit.query_text,
              timestamp: new Date(audit.timestamp).toLocaleTimeString()
            },
            {
              id: `r-${audit.id}`,
              sender: 'assistant',
              text: audit.reply_text,
              timestamp: new Date(audit.timestamp).toLocaleTimeString()
            }
          ]);
          setMessages(prev => [...prev, ...historicalMessages]);
        }
      } catch (err) {
        console.error('Error fetching chat history:', err);
      }
    };
    fetchHistory();
  }, [token]);

  // Submit Text Query
  const handleSendMessage = async (text: string, voiceBase64?: string) => {
    if (!text && !voiceBase64) return;
    
    setIsLoading(true);
    const userMsgId = `user-${Date.now()}`;
    const userText = text || "🎤 [ Kannada Voice Note Ingested ]";
    
    setMessages(prev => [...prev, {
      id: userMsgId,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString()
    }]);
    
    setInputText('');

    try {
      const res = await axios.post('/api/chat', {
        query_text: text,
        voice_audio_base64: voiceBase64
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const reply = res.data;
      setMessages(prev => [...prev, {
        id: `assist-${Date.now()}`,
        sender: 'assistant',
        text: reply.reply_text,
        timestamp: new Date(reply.timestamp).toLocaleTimeString(),
        translated: reply.translated_query !== reply.original_query ? reply.translated_query : undefined,
        hash: reply.verification_hash
      }]);
    } catch (err) {
      console.error('Error querying chat assistant:', err);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: '❌ <b>System connection dropped.</b> Please check if the backend service is running.',
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Start Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        
        // Convert Blob to Base64 String
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Strip data header prefix if present (e.g. "data:audio/wav;base64,")
          const rawBase64 = base64String.split(',')[1];
          handleSendMessage('', rawBase64);
        };

        // Stop all audio stream tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied or unavailable.');
    }
  };

  // Stop Voice Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Export Audit PDF Report
  const handleExportPDF = async () => {
    try {
      const response = await axios.get('/api/chat/export-pdf', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `KSP_SCRB_Audit_Ledger_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Error exporting PDF report.');
    }
  };

  return (
    <div className="chat-sidebar" style={{ height: '100%' }}>
      {/* Sidebar Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border-glass)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-secondary)'
      }}>
        <div>
          <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
            SCRB Intelligent Chat
          </h3>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            🟢 Secure Session Active
          </span>
        </div>
        <button
          onClick={handleExportPDF}
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '11px', gap: '4px' }}
          title="Export Session Audit Log to signed PDF"
        >
          <FileDown size={14} />
          PDF
        </button>
      </div>

      {/* Messages Window */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`msg-wrapper ${msg.sender}`}>
            <div
              className="msg-bubble"
              dangerouslySetInnerHTML={{ __html: msg.text }}
            />
            <div className={`msg-meta ${msg.sender}`}>
              <span>{msg.timestamp}</span>
              {msg.translated && (
                <span style={{ color: 'var(--accent-gold)' }}>
                  Translated: "{msg.translated}"
                </span>
              )}
              {msg.hash && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#16a34a' }}>
                  <ShieldCheck size={10} />
                  Ledger Ver.
                </span>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="msg-wrapper assistant">
            <div className="msg-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Loader2 size={16} className="spin-slow" />
              <span>Analyzing patterns & databases...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Action Controls */}
      <div className="chat-input-bar">
        {isRecording ? (
          <button
            onClick={stopRecording}
            className="btn btn-danger"
            style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0 }}
            title="Stop Recording"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            onClick={startRecording}
            className="btn btn-secondary"
            style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0 }}
            title="Record Voice Query (English/Kannada)"
            disabled={isLoading}
          >
            <Mic size={16} />
          </button>
        )}

        <input
          type="text"
          className="chat-text-area"
          placeholder={isRecording ? "Listening to voice input..." : "Query database (e.g. theft cases)..."}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSendMessage(inputText);
            }
          }}
          disabled={isLoading || isRecording}
        />

        <button
          onClick={() => handleSendMessage(inputText)}
          className="btn btn-primary"
          style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0 }}
          disabled={isLoading || isRecording || !inputText.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
