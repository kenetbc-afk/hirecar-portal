/**
 * Cloudflare Pages Middleware — PIN gate for /investor-deck/*
 *
 * If the visitor does not have a valid `pifr_deck_auth` cookie,
 * they are shown a branded PIN entry page instead of the deck content.
 * The PIN form POSTs to /api/verify-pin which sets the cookie.
 */

const GATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HIRECAR — Investor Deck Access</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 600px 400px at 50% 40%, rgba(34,211,238,0.06) 0%, transparent 70%),
        linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px);
      background-size: 100% 100%, 48px 48px, 48px 48px;
      z-index: 0;
    }

    .gate-container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 420px;
      padding: 0 24px;
    }

    .gate-card {
      background: rgba(22, 27, 34, 0.85);
      border: 1px solid rgba(34, 211, 238, 0.12);
      border-radius: 16px;
      padding: 48px 36px 40px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow:
        0 0 0 1px rgba(34,211,238,0.05),
        0 24px 80px rgba(0,0,0,0.5);
      text-align: center;
      animation: cardIn 0.6s ease-out;
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .logo {
      width: 64px;
      height: 64px;
      border-radius: 14px;
      margin-bottom: 20px;
      object-fit: cover;
    }

    .badge {
      display: inline-block;
      font-family: 'Share Tech Mono', monospace;
      font-size: 10px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #f97316;
      background: rgba(249, 115, 22, 0.1);
      border: 1px solid rgba(249, 115, 22, 0.25);
      border-radius: 4px;
      padding: 4px 12px;
      margin-bottom: 24px;
    }

    h1 {
      font-size: 20px;
      font-weight: 600;
      color: #e6edf3;
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 13px;
      color: #8b949e;
      margin-bottom: 32px;
      line-height: 1.5;
    }

    .pin-inputs {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 28px;
    }

    .pin-input {
      width: 56px;
      height: 64px;
      background: rgba(13, 17, 23, 0.8);
      border: 2px solid rgba(48, 54, 61, 0.8);
      border-radius: 12px;
      color: #e6edf3;
      font-family: 'Share Tech Mono', monospace;
      font-size: 24px;
      text-align: center;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
      caret-color: #22d3ee;
    }

    .pin-input:focus {
      border-color: #22d3ee;
      box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.15);
      transform: scale(1.05);
    }

    .pin-input.filled { border-color: rgba(34, 211, 238, 0.4); }
    .pin-input.error {
      border-color: #f85149;
      box-shadow: 0 0 0 3px rgba(248, 81, 73, 0.15);
    }
    .pin-input.success {
      border-color: #3fb950;
      box-shadow: 0 0 0 3px rgba(63, 185, 80, 0.15);
    }

    .error-message {
      font-size: 13px;
      color: #f85149;
      min-height: 20px;
      margin-bottom: 8px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .error-message.visible { opacity: 1; }

    .success-overlay {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .success-overlay.visible { display: flex; }

    .success-check {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(63, 185, 80, 0.12);
      border: 2px solid #3fb950;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .success-check svg {
      width: 28px;
      height: 28px;
      stroke: #3fb950;
      stroke-width: 3;
      fill: none;
      stroke-dasharray: 40;
      stroke-dashoffset: 40;
      animation: drawCheck 0.5s 0.2s ease forwards;
    }

    @keyframes popIn {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes drawCheck { to { stroke-dashoffset: 0; } }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 50%, 90% { transform: translateX(-6px); }
      30%, 70% { transform: translateX(6px); }
    }
    .shake { animation: shake 0.5s ease; }

    .form-section { transition: opacity 0.3s; }
    .form-section.hidden {
      opacity: 0;
      pointer-events: none;
      position: absolute;
    }

    .footer-text {
      margin-top: 24px;
      font-size: 11px;
      color: #484f58;
      font-family: 'Share Tech Mono', monospace;
      letter-spacing: 0.5px;
    }

    .spinner {
      display: none;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(34,211,238,0.2);
      border-top-color: #22d3ee;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin: 8px auto 0;
    }
    .spinner.visible { display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="gate-container">
    <div class="gate-card" id="gateCard">
      <img src="/og-image.png" alt="HIRECAR" class="logo" onerror="this.style.display='none'">
      <div class="badge">Confidential</div>

      <div class="form-section" id="formSection">
        <h1>Enter Access PIN</h1>
        <p class="subtitle">This deck is restricted to authorised investors and partners.</p>

        <div class="pin-inputs" id="pinInputs">
          <input type="tel" class="pin-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" data-index="0">
          <input type="tel" class="pin-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" data-index="1">
          <input type="tel" class="pin-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" data-index="2">
          <input type="tel" class="pin-input" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="off" data-index="3">
        </div>

        <div class="error-message" id="errorMsg">Incorrect PIN. Please try again.</div>
        <div class="spinner" id="spinner"></div>
      </div>

      <div class="success-overlay" id="successOverlay">
        <div class="success-check">
          <svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"></polyline></svg>
        </div>
        <span class="success-text" style="font-size:14px;color:#3fb950;font-weight:500;">Access Granted</span>
      </div>

      <div class="footer-text">HIRECAR &mdash; PIFR Platform</div>
    </div>
  </div>

  <script>
    (function() {
      var inputs = document.querySelectorAll('.pin-input');
      var errorMsg = document.getElementById('errorMsg');
      var spinner = document.getElementById('spinner');
      var formSection = document.getElementById('formSection');
      var successOverlay = document.getElementById('successOverlay');
      var pinInputs = document.getElementById('pinInputs');
      var isSubmitting = false;

      inputs[0].focus();

      inputs.forEach(function(input, i) {
        input.addEventListener('input', function(e) {
          var val = e.target.value.replace(/\\D/g, '');
          e.target.value = val.slice(0, 1);

          if (val && i < inputs.length - 1) {
            inputs[i + 1].focus();
          }

          e.target.classList.toggle('filled', !!e.target.value);

          var pin = Array.from(inputs).map(function(inp) { return inp.value; }).join('');
          if (pin.length === 4) submitPin(pin);
        });

        input.addEventListener('keydown', function(e) {
          if (e.key === 'Backspace' && !e.target.value && i > 0) {
            inputs[i - 1].focus();
            inputs[i - 1].value = '';
            inputs[i - 1].classList.remove('filled');
          }
          errorMsg.classList.remove('visible');
          inputs.forEach(function(inp) { inp.classList.remove('error'); });
        });

        input.addEventListener('paste', function(e) {
          e.preventDefault();
          var paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\\D/g, '').slice(0, 4);
          paste.split('').forEach(function(digit, idx) {
            if (inputs[idx]) {
              inputs[idx].value = digit;
              inputs[idx].classList.add('filled');
            }
          });
          if (paste.length === 4) {
            inputs[3].focus();
            submitPin(paste);
          } else if (paste.length > 0) {
            inputs[Math.min(paste.length, 3)].focus();
          }
        });
      });

      function submitPin(pin) {
        if (isSubmitting) return;
        isSubmitting = true;
        spinner.classList.add('visible');

        fetch('/api/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pin })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.success) {
            inputs.forEach(function(inp) { inp.classList.add('success'); });
            spinner.classList.remove('visible');
            setTimeout(function() {
              formSection.classList.add('hidden');
              successOverlay.classList.add('visible');
            }, 300);
            setTimeout(function() { window.location.reload(); }, 1200);
          } else {
            showError();
          }
        })
        .catch(function() { showError(); });
      }

      function showError() {
        isSubmitting = false;
        spinner.classList.remove('visible');
        inputs.forEach(function(inp) {
          inp.classList.add('error');
          inp.value = '';
          inp.classList.remove('filled');
        });
        errorMsg.classList.add('visible');
        pinInputs.classList.add('shake');
        setTimeout(function() { pinInputs.classList.remove('shake'); }, 500);
        inputs[0].focus();
      }
    })();
  </script>
</body>
</html>`;

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // Allow API routes through without auth check
  if (url.pathname.startsWith('/api/')) {
    return next();
  }

  // Check for the auth cookie
  const cookie = request.headers.get('Cookie') || '';
  if (cookie.includes('pifr_deck_auth=verified')) {
    return next();
  }

  // Serve the PIN gate page
  return new Response(GATE_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
