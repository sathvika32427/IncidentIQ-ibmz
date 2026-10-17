import React, { useState } from 'react';
import { MessageSquare, X, Send, Sparkles, RefreshCw, Terminal, ArrowRight, User } from 'lucide-react';
import { Role } from '../../types';
import { api } from '../../services/api';

interface AssistantChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: Role;
  userId: string;
  onSelectIncident: (id: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  mode?: 'rule-based' | 'ai-assisted';
  sourceIncidents?: string[];
  timestamp: string;
}

export const AssistantChatDrawer: React.FC<AssistantChatDrawerProps> = ({
  isOpen,
  onClose,
  userRole,
  userId,
  onSelectIncident
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-01',
      sender: 'assistant',
      text: `Hello! I am the IncidentIQ Assistant. I can help you search similar incidents, explain raw Linux log patterns, review past successful/failed actions, and guide your escalation requests.\n\nHow can I help you investigate today?`,
      mode: 'rule-based',
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    const query = input.trim();
    setInput('');
    setLoading(true);

    try {
      const res = await api.sendChatMessage({
        message: query,
        role: userRole,
        userId: userId
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        mode: res.mode,
        sourceIncidents: res.source_incidents,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `Service response error: ${err.message || 'Unable to connect to assistant'}.`,
          timestamp: 'Now'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sampleQuestions = [
    'Show similar incidents for SSH brute force',
    'What was the verified resolution for INC-Z-1042?',
    'Why did the logrotate daemon fail with exit code 1?',
    'Explain the Manager Escalation review requirements'
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[560px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>IncidentIQ Assistant</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300">
                {userRole.toUpperCase()}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Outcome-Aware Enterprise Chatbot</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`p-3.5 rounded-2xl max-w-[85%] space-y-1.5 leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-500/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-200'
              }`}
            >
              {m.mode && (
                <div className="text-[9px] font-mono uppercase text-cyan-400/80 tracking-wider">
                  Engine: {m.mode}
                </div>
              )}
              <div className="whitespace-pre-line">{m.text}</div>

              {m.sourceIncidents && m.sourceIncidents.length > 0 && (
                <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] font-mono text-slate-400">Source:</span>
                  {m.sourceIncidents.map(incId => (
                    <button
                      key={incId}
                      onClick={() => onSelectIncident(incId)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-950 text-cyan-300 border border-slate-700 text-[10px] font-mono flex items-center gap-1"
                    >
                      <span>{incId}</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[9px] text-slate-500 mt-1 px-1">{m.timestamp}</span>
          </div>
        ))}

        {loading && (
          <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs flex items-center gap-2 w-fit">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>Consulting incident memory records...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Questions */}
      <div className="px-3 py-2 bg-slate-950/60 border-t border-slate-800/60 flex items-center gap-1.5 overflow-x-auto text-[10px] text-slate-400">
        <span className="shrink-0 text-slate-500">Quick:</span>
        {sampleQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => {
              setInput(q);
            }}
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 whitespace-nowrap shrink-0 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about incidents, log evidence, or procedures..."
          className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2 text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 rounded-xl transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
