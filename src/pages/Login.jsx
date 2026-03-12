import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import MatrixRain from '../components/MatrixRain';

const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*アイウエオカキクケコ';

export default function Login() {
  const { login, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Animation states
  const [phase, setPhase] = useState('intro');
  const [glitchText, setGlitchText] = useState('');
  const [typewriterText, setTypewriterText] = useState('');

  const pinRefs = [useRef(), useRef(), useRef(), useRef()];
  const emailRef = useRef();
  const glitchInterval = useRef(null);

  // Intro animation sequence
  useEffect(() => {
    const timers = [];
    timers.push(setTimeout(() => setPhase('logo'), 1500));
    timers.push(setTimeout(() => setPhase('login'), 3500));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === 'login') {
      setTimeout(() => emailRef.current?.focus(), 300);
    }
  }, [phase]);

  const startGlitchEffect = useCallback((finalText, duration = 1200) => {
    const chars = finalText.split('');
    const resolved = Array(chars.length).fill(false);
    let frame = 0;
    const totalFrames = duration / 50;

    glitchInterval.current = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;

      const result = chars.map((char, i) => {
        if (resolved[i]) return char;
        if (progress > (i / chars.length) * 0.8 + 0.2) {
          resolved[i] = true;
          return char;
        }
        return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
      });

      setGlitchText(result.join(''));

      if (resolved.every(Boolean)) {
        clearInterval(glitchInterval.current);
      }
    }, 50);
  }, []);

  function typeWriter(text, callback) {
    let i = 0;
    const interval = setInterval(() => {
      setTypewriterText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        callback?.();
      }
    }, 60);
    return interval;
  }

  function handlePinChange(index, value) {
    if (!/^\d*$/.test(value)) return;
    const next = [...pin];
    next[index] = value.slice(-1);
    setPin(next);
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  }

  function handlePinKeyDown(index, e) {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setShowPin(true);
    setTimeout(() => pinRefs[0].current?.focus(), 100);
  }

  async function handleSubmit() {
    const fullPin = pin.join('');
    if (fullPin.length !== 4) return;

    setSubmitting(true);
    setError('');
    try {
      setPhase('granted');
      startGlitchEffect('ACCESS GRANTED', 1200);

      await login(email.trim(), fullPin);

      setTimeout(() => {
        typeWriter('Welcome to HIRECAR Member Services...', () => {
          setTimeout(() => setPhase('done'), 800);
        });
      }, 1400);
    } catch (err) {
      setPhase('login');
      setError(err.message || 'Invalid credentials');
      setPin(['', '', '', '']);
      pinRefs[0].current?.focus();
      setGlitchText('');
      setTypewriterText('');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (pin.every((d) => d !== '') && showPin && phase === 'login') {
      handleSubmit();
    }
  }, [pin, showPin, phase]);

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <MatrixRain active={phase !== 'done'} opacity={phase === 'intro' ? 0.3 : 0.08} />

      {/* Intro Phase */}
      {(phase === 'intro' || phase === 'logo') && (
        <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 transition-all duration-1000 ${phase === 'logo' ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center text-4xl text-ink font-bold mb-6 shadow-[0_0_40px_rgba(184,146,42,0.4)] animate-pulse">
            HC
          </div>
          <h1 className="font-display text-gold text-3xl tracking-[0.3em] mb-2">HIRECAR</h1>
          <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-hc-red to-transparent mb-3" />
          <p className="font-mono text-hc-red/80 text-xs tracking-[0.4em] uppercase">Credit With Ken</p>
        </div>
      )}

      {/* ACCESS GRANTED Phase */}
      {phase === 'granted' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <p className="font-mono text-hc-success text-3xl tracking-[0.3em] font-bold mb-4 drop-shadow-[0_0_20px_rgba(26,107,60,0.5)]">
            {glitchText || 'ACCESS GRANTED'}
          </p>
          {typewriterText && (
            <p className="font-mono text-gold/80 text-sm tracking-wider">
              {typewriterText}<span className="animate-pulse">_</span>
            </p>
          )}
        </div>
      )}

      {/* Login Phase */}
      <div className={`relative z-10 transition-all duration-700 ${phase === 'login' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <div className="mb-10 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center text-2xl text-ink font-bold mx-auto mb-4 shadow-[0_0_30px_rgba(184,146,42,0.3)]">
            HC
          </div>
          <h1 className="font-display text-gold text-2xl tracking-[0.2em]">HIRECAR</h1>
          <div className="h-px w-20 bg-gradient-to-r from-transparent via-hc-red to-transparent mx-auto my-2" />
          <p className="font-mono text-hc-red/80 text-xs tracking-[0.3em] mt-2 uppercase">
            Member Services
          </p>
        </div>

        <div className="w-full max-w-sm">
          {!showPin ? (
            <form onSubmit={handleEmailSubmit}>
              <label className="block font-mono text-cream/50 text-xs tracking-wider mb-2 uppercase">
                Email Address
              </label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-gold/30 rounded-lg text-cream
                           placeholder:text-cream/20 focus:outline-none focus:border-gold
                           focus:shadow-[0_0_12px_rgba(184,146,42,0.2)] transition font-sans"
                placeholder="you@example.com"
                required
              />
              <button
                type="submit"
                className="w-full mt-4 py-3 bg-gold text-ink font-semibold rounded-lg
                           hover:bg-gold-light transition-colors shadow-[0_0_20px_rgba(184,146,42,0.2)]"
              >
                Continue
              </button>
            </form>
          ) : (
            <div>
              <button
                onClick={() => { setShowPin(false); setError(''); }}
                className="text-gold/60 hover:text-gold text-sm mb-4 flex items-center gap-1 transition"
              >
                &larr; {email}
              </button>

              <label className="block font-mono text-cream/50 text-xs tracking-wider mb-4 uppercase text-center">
                Enter Your 4-Digit PIN
              </label>

              <div className="flex justify-center gap-3 mb-4">
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={pinRefs[i]}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    disabled={submitting}
                    className="w-14 h-16 text-center text-2xl font-mono font-bold
                               border-2 border-hc-red/40 bg-black/50 text-hc-red
                               rounded-xl focus:outline-none focus:border-hc-red
                               focus:shadow-[0_0_20px_rgba(227,30,45,0.3)]
                               transition disabled:opacity-50"
                  />
                ))}
              </div>

              {(error || authError) && (
                <p className="text-hc-red font-mono text-xs text-center mt-2">
                  {error || authError}
                </p>
              )}

              {submitting && (
                <div className="flex justify-center mt-4">
                  <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-cream/20 text-xs mt-12 font-mono text-center">
          Authorized Access Only
        </p>
      </div>

      {/* Skip button — visible during intro/logo phases */}
      {(phase === 'intro' || phase === 'logo') && (
        <button
          onClick={() => setPhase('login')}
          className="fixed bottom-6 right-6 z-50 px-3 py-1.5 text-[11px] font-mono text-cream/50
                     bg-ink/80 border border-cream/10 rounded-md backdrop-blur-sm
                     shadow-[0_0_12px_rgba(237,233,226,0.06)] hover:text-cream/80 hover:border-cream/20
                     hover:shadow-[0_0_16px_rgba(237,233,226,0.1)] transition-all duration-300 cursor-pointer"
        >
          Skip
        </button>
      )}
    </div>
  );
}
