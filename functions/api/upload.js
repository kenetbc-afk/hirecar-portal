/**
 * Cloudflare Pages Function — Document & ID Upload
 * POST /api/upload
 *
 * Accepts multipart/form-data with:
 *   - file: the uploaded file (image or PDF)
 *   - memberId: PIFR member ID or client ID
 *   - docType: "id-front" | "id-back" | "credit-report" | "dispute-doc" | "general"
 *   - metadata: optional JSON string with extra context
 *
 * Stores to R2 bucket (DOCS_BUCKET) with path: {memberId}/{docType}/{timestamp}_{filename}
 * Returns the R2 key for retrieval.
 *
 * GET /api/upload?memberId=XXX&docType=YYY
 *   Lists uploaded documents for a member/type.
 *
 * GET /api/upload?key=XXX
 *   Returns the file content (for admin review).
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Content-Type': 'application/json',
  };

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const memberId = formData.get('memberId');
    const docType = formData.get('docType') || 'general';
    const metadata = formData.get('metadata') || '{}';

    if (!file || !memberId) {
      return new Response(JSON.stringify({ error: 'Missing file or memberId' }), {
        status: 400, headers: cors
      });
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), {
        status: 413, headers: cors
      });
    }

    // Validate doc type
    const validTypes = ['id-front', 'id-back', 'credit-report', 'dispute-doc', 'general'];
    if (!validTypes.includes(docType)) {
      return new Response(JSON.stringify({ error: 'Invalid docType. Valid: ' + validTypes.join(', ') }), {
        status: 400, headers: cors
      });
    }

    // Build R2 key: memberId/docType/timestamp_filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${memberId}/${docType}/${timestamp}_${safeName}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await env.DOCS_BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: {
        memberId: memberId,
        docType: docType,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        size: String(file.size),
        ...JSON.parse(metadata),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      key: key,
      memberId: memberId,
      docType: docType,
      fileName: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }), { headers: cors });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: cors
    });
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const memberId = url.searchParams.get('memberId');
  const docType = url.searchParams.get('docType');

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  };

  // If a specific key is requested, return the file
  if (key) {
    try {
      const object = await env.DOCS_BUCKET.get(key);
      if (!object) {
        return new Response(JSON.stringify({ error: 'File not found' }), {
          status: 404, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      const headers = new Headers(cors);
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('Content-Disposition', `inline; filename="${object.customMetadata?.originalName || 'file'}"`);
      headers.set('Cache-Control', 'private, max-age=3600');

      return new Response(object.body, { headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }

  // If memberId provided, list files for that member
  if (memberId) {
    try {
      const prefix = docType ? `${memberId}/${docType}/` : `${memberId}/`;
      const listed = await env.DOCS_BUCKET.list({ prefix: prefix, limit: 100 });

      const files = listed.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        docType: obj.key.split('/')[1] || 'unknown',
      }));

      return new Response(JSON.stringify({ files: files, memberId: memberId }), {
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Provide key or memberId parameter' }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
