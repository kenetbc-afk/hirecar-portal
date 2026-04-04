// Cloudflare Pages Function — /api/pifr-enroll
// Receives enrollment data from hirecar-pifr-enrollment.pages.dev
// Stores in KV (PIFR_ENROLLMENTS) and returns success

export async function onRequestPost(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const data = await context.request.json();

    if (!data.mid || !data.email) {
      return new Response(JSON.stringify({ error: 'Missing mid or email' }), { status: 400, headers: cors });
    }

    // Store in KV if available
    if (context.env && context.env.PIFR_ENROLLMENTS) {
      // Store individual enrollment
      await context.env.PIFR_ENROLLMENTS.put(`enrollment:${data.mid}`, JSON.stringify({
        ...data,
        receivedAt: new Date().toISOString()
      }));

      // Update enrollment list
      const listRaw = await context.env.PIFR_ENROLLMENTS.get('enrollment_list');
      const list = listRaw ? JSON.parse(listRaw) : [];
      if (!list.includes(data.mid)) {
        list.unshift(data.mid);
        await context.env.PIFR_ENROLLMENTS.put('enrollment_list', JSON.stringify(list));
      }
    }

    return new Response(JSON.stringify({ success: true, mid: data.mid }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}

export async function onRequestGet(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    if (context.env && context.env.PIFR_ENROLLMENTS) {
      const listRaw = await context.env.PIFR_ENROLLMENTS.get('enrollment_list');
      const list = listRaw ? JSON.parse(listRaw) : [];

      const enrollments = [];
      for (const mid of list.slice(0, 100)) {
        const raw = await context.env.PIFR_ENROLLMENTS.get(`enrollment:${mid}`);
        if (raw) enrollments.push(JSON.parse(raw));
      }

      return new Response(JSON.stringify({ success: true, enrollments }), { headers: cors });
    }

    return new Response(JSON.stringify({ success: true, enrollments: [] }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
