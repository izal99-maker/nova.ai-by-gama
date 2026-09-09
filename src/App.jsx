import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Menu, Plus, Star, MessageSquare, Pencil, Trash2, X, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { initChat, sendMessageToNova } from './ai';
import './index.css';

const NovaLogo = ({ size = 24, className = '', stroke, strokeWidth = 2 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke || "currentColor"}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <g transform="matrix(0.45, 0, 0, 0.45, 6.6, 4.5)" strokeWidth={strokeWidth * 2.2}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.2 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </g>
  </svg>
);

function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const messagesEndRef = useRef(null);

  // Load history from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem('nova_sessions');
    const savedCurrentId = localStorage.getItem('nova_current_session');

    if (savedSessions) {
      const parsedSessions = JSON.parse(savedSessions);
      setSessions(parsedSessions);

      if (savedCurrentId) {
        const activeSession = parsedSessions.find(s => s.id === savedCurrentId);
        if (activeSession) {
          setCurrentSessionId(savedCurrentId);
          setMessages(activeSession.messages);
        }
      }
    }
    initChat();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSession = (id) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      localStorage.setItem('nova_current_session', id);
      initChat();
      if (window.innerWidth <= 768) setIsSidebarOpen(false);
    }
  };

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    localStorage.removeItem('nova_current_session');
    initChat();
    if (window.innerWidth <= 768) setIsSidebarOpen(false);
  };

  const startEditing = (e, session) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const saveEditing = (e, id) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      const updatedSessions = sessions.map(s =>
        s.id === id ? { ...s, title: editingTitle.trim() } : s
      );
      setSessions(updatedSessions);
      localStorage.setItem('nova_sessions', JSON.stringify(updatedSessions));
    }
    setEditingSessionId(null);
  };

  const cancelEditing = (e) => {
    e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleEditKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      saveEditing(e, id);
    } else if (e.key === 'Escape') {
      cancelEditing(e);
    }
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    const updatedSessions = sessions.filter(s => s.id !== id);
    setSessions(updatedSessions);
    localStorage.setItem('nova_sessions', JSON.stringify(updatedSessions));

    if (currentSessionId === id && updatedSessions.length >= 0) {
      createNewChat();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input;
    const userMsg = { role: 'user', content: userText };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let sessionId = currentSessionId;
    let currentSessions = [...sessions];

    if (!sessionId) {
      sessionId = Date.now().toString();
      setCurrentSessionId(sessionId);
      localStorage.setItem('nova_current_session', sessionId);

      const newSession = {
        id: sessionId,
        title: userText.length > 30 ? userText.slice(0, 30) + '...' : userText,
        messages: newMessages,
        updatedAt: Date.now()
      };
      currentSessions = [newSession, ...currentSessions];
    } else {
      currentSessions = currentSessions.map(s =>
        s.id === sessionId ? { ...s, messages: newMessages, updatedAt: Date.now() } : s
      );
      // Sort so active session moves to top
      currentSessions.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    setSessions(currentSessions);
    localStorage.setItem('nova_sessions', JSON.stringify(currentSessions));

    try {
      const responseText = await sendMessageToNova(userText);
      const botMsg = { role: 'bot', content: responseText };

      setMessages(prev => {
        const updatedMsgs = [...prev, botMsg];
        const updatedSessions = currentSessions.map(s =>
          s.id === sessionId ? { ...s, messages: updatedMsgs, updatedAt: Date.now() } : s
        );
        updatedSessions.sort((a, b) => b.updatedAt - a.updatedAt);
        setSessions(updatedSessions);
        localStorage.setItem('nova_sessions', JSON.stringify(updatedSessions));
        return updatedMsgs;
      });
    } catch {
      setMessages(prev => [...prev, { role: 'bot', content: "Terjadi kesalahan saat menghubungkan ke sistem. Silakan coba lagi." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="app-container">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="nova-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="#a855f7" offset="0%" />
            <stop stopColor="#3b82f6" offset="100%" />
          </linearGradient>
        </defs>
      </svg>
      {/* Sidebar - Gemini Style */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="icon-btn" onClick={toggleSidebar}>
              <Menu size={20} />
            </button>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isSidebarOpen ? 1 : 0,
              transition: 'opacity 0.2s',
              whiteSpace: 'nowrap'
            }}>
            </div>
          </div>

          <button className={`new-chat-btn ${isSidebarOpen ? '' : 'collapsed'}`} onClick={createNewChat}>
            <Plus size={20} />
            {isSidebarOpen && "New chat"}
          </button>
        </div>

        <div style={{ opacity: isSidebarOpen ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isSidebarOpen ? 'auto' : 'none', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="sidebar-menu">
            <div className="menu-item">
              <Star size={18} />
              My stuff
            </div>
          </div>

          <div className="sidebar-section" style={{ flex: 1, overflowY: 'auto' }}>
            <div className="section-title">Chats</div>
            <div className="history-list">
              {sessions.map(s => (
                <div
                  key={s.id}
                  className={`history-item ${s.id === currentSessionId ? 'active' : ''}`}
                  onClick={() => loadSession(s.id)}
                >
                  {editingSessionId === s.id ? (
                    <div className="history-item-edit-mode" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => handleEditKeyDown(e, s.id)}
                        autoFocus
                      />
                      <button onClick={(e) => saveEditing(e, s.id)} title="Save"><Check size={14} /></button>
                      <button onClick={cancelEditing} title="Cancel"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <span className="history-item-title">{s.title}</span>
                      <div className="history-actions">
                        <button className="action-btn" onClick={(e) => startEditing(e, s)} title="Rename chat">
                          <Pencil size={14} />
                        </button>
                        <button className="action-btn delete" onClick={(e) => deleteSession(e, s.id)} title="Delete chat">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="chat-container">
        <header className="main-header">
          {!isSidebarOpen && (
            <button className="icon-btn desktop-hide" onClick={toggleSidebar} style={{ marginRight: '16px' }}>
              <Menu size={20} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <NovaLogo size={28} stroke="url(#nova-grad)" />
            <span style={{ fontWeight: 600 }}>Nova AI <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.9em' }}>by Gama</span></span>
          </div>
        </header>

        {messages.length === 0 ? (
          <div className="welcome-screen">
            <h1 className="welcome-title">
              <NovaLogo className="sparkle" size={40} stroke="url(#nova-grad)" strokeWidth={1.5} /> Halo! Aku Nova
            </h1>
            <p className="welcome-subtitle">Virtual Assistant Outfit dan Kecantikanmu.</p>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-wrapper ${msg.role}`}>
                {msg.role === 'bot' && (
                  <div className={`avatar bot`}>
                    <NovaLogo size={18} />
                  </div>
                )}
                <div className="message-bubble">
                  {msg.role === 'bot' ? (
                    <ReactMarkdown
                      components={{
                        img: ({ ...props }) => <img style={{ maxWidth: '100%', borderRadius: '12px', marginTop: '10px' }} {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-wrapper bot">
                <div className="avatar bot"><NovaLogo size={18} /></div>
                <div className="thinking-badge">
                  <NovaLogo size={14} className="thinking-icon" stroke="url(#nova-grad)" /> Nova is thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="input-area">
          <div className="input-container">
            <textarea
              className="chat-input"
              placeholder="Tanya rekomendasi pakaian, rutinitas skincare, atau tren terkini..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
