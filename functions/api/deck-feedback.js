/**
 * Cloudflare Pages Function — Investor deck feedback endpoint
 * POST /api/deck-feedback
 * Body: { name, email, role, feedback }
 *
 * Attempts to send an email notification via Brevo (SendinBlue).
 * Falls back to KV storage if available.
 * Always returns success so the client-side localStorage copy is the reliable record.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': new URL(request.url).origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { name, email, role, feedback } = body;

    // Basic validation
    if (!name || !email || !feedback) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Name, email, and feedback are required.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const timestamp = new Date().toISOString();
    const feedbackRecord = { name, email, role, feedback, timestamp };

    // Try to persist in KV if the binding exists
    if (env.DECK_FEEDBACK) {
      try {
        const key = `feedback_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
        await env.DECK_FEEDBACK.put(key, JSON.stringify(feedbackRecord), {
          expirationTtl: 60 * 60 * 24 * 90, // keep for 90 days
        });
      } catch (kvErr) {
        console.error('KV write failed:', kvErr);
      }
    }

    // Try to send email via Brevo
    if (env.BREVO_API_KEY) {
      try {
        const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': env.BREVO_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: 'PIFR Deck',
              email: 'noreply@hirecar-portal.pages.dev',
            },
            to: [{ email: 'Kene.tbc@gmail.com', name: 'Ken' }],
            subject: `PIFR Deck Feedback \u2014 ${name}`,
            htmlContent: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#22d3ee;">PIFR Deck Feedback</h2>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:8px 0;color:#666;width:100px;">Name</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(name)}</td></tr>
                  <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
                  <tr><td style="padding:8px 0;color:#666;">Role</td><td style="padding:8px 0;">${escapeHtml(role || 'Not specified')}</td></tr>
                </table>
                <div style="margin-top:16px;padding:16px;background:#f6f8fa;border-radius:8px;border-left:4px solid #22d3ee;">
                  <p style="margin:0;white-space:pre-wrap;">${escapeHtml(feedback)}</p>
                </div>
                <hr style="margin-top:24px;border:none;border-top:1px solid #e1e4e8;">
                <p style="color:#8b949e;font-size:12px;">Submitted: ${timestamp}</p>
              </div>`,
          }),
        });

        if (!emailRes.ok) {
          console.error('Brevo API error:', emailRes.status, await emailRes.text());
        }
      } catch (emailErr) {
        console.error('Email send failed:', emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Feedback received. Thank you.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (err) {
    console.error('Feedback endpoint error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Bad request' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

/** Handle CORS preflight */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/** Minimal HTML escaping to prevent injection in email body */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
