import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const QUICK_ACTIONS = [
  'Check my progress',
  'Upload a document',
  'Next steps?',
  'Contact support',
];

export default function Chatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: `Hi ${user?.nickname || 'there'}! I'm your HIRECAR assistant. How can I help you today?`,
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef();

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  function handleSend(text) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    setMessages((prev) => [...prev, { from: 'user', text: msg, time: new Date() }]);

    // Simulate bot response
    setTimeout(() => {
      let reply = "Thanks for your message! Our team will follow up shortly. For urgent matters, please use the Messages tab to contact your advisor directly.";
      if (msg.toLowerCase().includes('progress')) {
        reply = "You can view your full progress on the Dashboard. Your milestones and completion percentage are tracked there in real-time.";
      } else if (msg.toLowerCase().includes('upload') || msg.toLowerCase().includes('document')) {
        reply = "Head to the Documents tab to upload files. You'll see which documents are still needed and can drag & drop files directly.";
      } else if (msg.toLowerCase().includes('next') || msg.toLowerCase().includes('step')) {
        reply = "Check your Milestones page for your current action plan. Your next steps are outlined there with target dates.";
      } else if (msg.toLowerCase().includes('contact') || msg.toLowerCase().includes('support')) {
        reply = "You can reach your dedicated advisor through the Messages tab. They typically respond within 24 hours on business days.";
      }
      setMessages((prev) => [...prev, { from: 'bot', text: reply, time: new Date() }]);
    }, 800);
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center text-xl transition-all duration-300
          ${open ? 'bg-hc-red text-white rotate-0' : 'bg-gold text-ink hover:bg-gold-light hover:scale-110'}
        `}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[500px] bg-white rounded-xl shadow-2xl border border-rule overflow-hidden flex flex-col animate-slideUp">
          {/* Header */}
          <div className="bg-ink px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center text-[10px] text-ink font-bold">
              HC
            </div>
            <div>
              <p className="text-cream text-sm font-semibold">HIRECAR Assistant</p>
              <p className="text-cream/40 text-[10px] font-mono">Always here to help</p>
            </div>
            <span className="ml-auto w-2 h-2 bg-hc-success rounded-full" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-cream/30 min-h-[200px] max-h-[300px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    msg.from === 'user'
                      ? 'bg-gold text-white rounded-br-sm'
                      : 'bg-white border border-rule text-ink rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-3 py-2 flex gap-1.5 flex-wrap border-t border-rule/30 bg-white">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => handleSend(action)}
                className="px-2.5 py-1 text-[11px] rounded-full border border-gold/30 text-gold hover:bg-gold/10 transition"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2 p-3 border-t border-rule bg-white"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 text-sm bg-cream/50 border border-rule rounded-lg focus:outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2 bg-gold text-white text-sm rounded-lg disabled:opacity-40 hover:bg-gold-light transition"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
