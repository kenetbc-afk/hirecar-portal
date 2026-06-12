/**
 * Cloudflare Pages Function — Email Open Tracking Pixel
 * GET /api/track?mid=PIFR-XXX&email=day0
 *
 * Serves a 1x1 transparent PNG and logs the open event.
 * Updates pifr_enrollments email tracking fields in D1.
 */

// 1x1 transparent PNG (68 bytes)
const PIXEL = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
  0x60, 0x82,
]);

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const mid = url.searchParams.get('mid');
  const emailType = url.searchParams.get('email'); // day0 or day1

  // Always serve the pixel immediately (non-blocking tracking)
  const pixelResponse = new Response(PIXEL, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });

  // Log the open event in background
  if (mid && emailType && context.env?.DB) {
    context.waitUntil((async () => {
      try {
        const field = emailType === 'day1' ? 'email_day1_opened' : 'email_day0_opened';
        await context.env.DB.prepare(
          'UPDATE pifr_enrollments SET ' + field + ' = 1, updated_at = ? WHERE member_id = ?'
        ).bind(new Date().toISOString(), mid).run();

        // Also log to activity
        const enrollment = await context.env.DB.prepare(
          'SELECT id FROM pifr_enrollments WHERE member_id = ? LIMIT 1'
        ).bind(mid).first();

        if (enrollment) {
          await context.env.DB.prepare(
            'INSERT INTO pifr_activity_log (enrollment_id, action, actor, details) VALUES (?, ?, ?, ?)'
          ).bind(enrollment.id, 'email_opened', 'system', JSON.stringify({
            email_type: emailType, opened_at: new Date().toISOString()
          })).run();
        }
      } catch (e) {
        console.error('Track pixel error:', e.message);
      }
    })());
  }

  // Also log to KV for quick dashboard lookup
  if (mid && emailType && context.env?.PIFR_ENROLLMENTS) {
    context.waitUntil(
      context.env.PIFR_ENROLLMENTS.put(
        `track:${mid}:${emailType}`,
        JSON.stringify({ opened: true, at: new Date().toISOString() })
      )
    );
  }

  return pixelResponse;
}
