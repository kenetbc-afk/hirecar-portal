import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMessages, sendMessage } from '../api/client';

const CONTACTS = [
  { id: 'ken', name: 'Ken Eckman', subtitle: 'SeedXchange / CreditWithKen', desc: 'Direct line — email + text' },
  { id: 'legal', name: 'SeedXchange Legal', subtitle: '', desc: 'Legal team channel' },
  { id: 'court', name: 'Court Notifications', subtitle: '', desc: 'Automated court notices' },
  { id: 'support', name: 'HIRECAR Support', subtitle: '', desc: 'How can we help?' },
];

const AVATAR_STYLES = {
  admin: { bg: 'bg-gold', text: 'text-ink', label: 'HIRECAR Team', icon: 'HC' },
  legal: { bg: 'bg-gold', text: 'text-ink', label: 'Legal Team', icon: 'LT' },
  system: { bg: 'bg-cream', text: 'text-ink', label: 'System', icon: 'SY' },
  court: { bg: 'bg-hc-blue', text: 'text-white', label: 'Court Notice', icon: 'CT' },
  opp: { bg: 'bg-hc-red', text: 'text-white', label: 'Opposing Party', icon: 'OP' },
  client: { bg: 'bg-gold', text: 'text-white', label: 'You', icon: '' },
};

function getAvatar(from, userId) {
  if (from === 'client' || from === userId) return AVATAR_STYLES.client;
  return AVATAR_STYLES[from] || AVATAR_STYLES.admin;
}

export default function Messages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [activeContact, setActiveContact] = useState('ken');
  const bottomRef = useRef();

  useEffect(() => {
    loadMessages();
  }, [user?.clientId]);

  async function loadMessages() {
    try {
      const data = await getMessages(user.clientId);
      setMessages(data.messages || data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(user.clientId, text.trim());
      setText('');
      await loadMessages();
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (user?.fullName || 'ME')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const activeContactData = CONTACTS.find((c) => c.id === activeContact) || CONTACTS[0];

  return (
    <div>
      <div className="sec-header">
        <div className="accent-bar" />
        <h2 className="text-2xl">Message Center</h2>
      </div>
      <p className="text-sm text-muted mb-4">
        Send messages to your case team via Twilio. Messages are delivered to email and text. You can also attach documents.
      </p>

      <div className="msg-container">
        {/* Contacts Sidebar */}
        <div className="msg-contacts">
          {CONTACTS.map((c) => (
            <div
              key={c.id}
              className={`msg-contact ${activeContact === c.id ? 'active' : ''}`}
              onClick={() => setActiveContact(c.id)}
            >
              <h4>{c.name}</h4>
              {c.subtitle && <p className="text-[11px] text-gold">{c.subtitle}</p>}
              <p>{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Thread Area */}
        <div className="msg-thread">
          <div className="msg-thread-header">
            {activeContactData.name}
            <span className="text-xs text-muted font-normal ml-2">
              via Twilio &bull; email + text
            </span>
          </div>

          <div className="msg-bubbles">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-muted text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.from === 'client' || msg.from === user.clientId;
                const avatar = getAvatar(msg.from, user.clientId);

                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full ${avatar.bg} ${avatar.text} flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1`}>
                      {isMe ? initials : avatar.icon}
                    </div>
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            msg.from === 'legal' || msg.from === 'admin' ? 'text-gold'
                              : msg.from === 'court' ? 'text-hc-blue'
                              : msg.from === 'opp' ? 'text-hc-red'
                              : 'text-muted'
                          }`}>
                            {avatar.label}
                          </span>
                          {msg.unread && (
                            <span className="w-2 h-2 rounded-full bg-hc-red animate-pulse" />
                          )}
                        </div>
                      )}
                      <div className={`msg-bubble ${isMe ? 'mine' : 'theirs'}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        {msg.attachment && (
                          <div className="mt-2 flex items-center gap-2 text-xs opacity-80 bg-black/5 rounded px-2 py-1">
                            <span>📎</span>
                            <span className="truncate">{msg.attachment.name || 'Attachment'}</span>
                          </div>
                        )}
                      </div>
                      <p className={`text-[10px] mt-1 ${isMe ? 'text-right' : 'text-left'} text-muted/50`}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="msg-input-bar">
            <button className="msg-attach-btn" title="Attach file">📎</button>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(e)}
              placeholder={`Type a message to ${activeContactData.name}...`}
              disabled={sending}
            />
            <button
              className="msg-send-btn"
              onClick={handleSend}
              disabled={!text.trim() || sending}
            >
              {sending ? '...' : '▶'}
            </button>
          </div>

          <div className="msg-twilio-note">
            Powered by Twilio &mdash; Messages are monitored for security purposes
          </div>
        </div>
      </div>
    </div>
  );
}
