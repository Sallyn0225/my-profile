// Cloudflare Worker — Card Book API
// Endpoints:
//   GET  /api/cards?cursor=xxx&limit=9  — list cards (paginated)
//   POST /api/cards                     — upload a card (FormData: image + orientation)
//   GET  /api/cards/image/:key          — serve card image from R2

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Route: list cards
      if (url.pathname === '/api/cards' && request.method === 'GET') {
        return handleList(url, env, corsHeaders);
      }

      // Route: upload card
      if (url.pathname === '/api/cards' && request.method === 'POST') {
        return handleUpload(request, env, corsHeaders);
      }

      // Route: serve image
      const imageMatch = url.pathname.match(/^\/api\/cards\/image\/(.+)$/);
      if (imageMatch && request.method === 'GET') {
        return handleImage(imageMatch[1], env, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// ── List cards (cursor-based pagination via R2 list) ─────────────
async function handleList(url, env, corsHeaders) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '9', 10), 27);
  const cursor = url.searchParams.get('cursor') || undefined;

  const listed = await env.CARDS_BUCKET.list({
    prefix: 'cards/',
    limit,
    cursor,
    include: ['customMetadata'],
  });

  const cards = listed.objects.map((obj) => ({
    id: obj.key,
    key: obj.key,
    orientation: obj.customMetadata?.orientation || 'landscape',
    uploadedAt: obj.uploaded,
  }));

  return new Response(
    JSON.stringify({
      cards,
      cursor: listed.truncated ? listed.cursor : null,
      hasMore: listed.truncated,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// ── Upload card ──────────────────────────────────────────────────
async function handleUpload(request, env, corsHeaders) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const formData = await request.formData();
  const file = formData.get('image');
  const orientation = formData.get('orientation') || 'landscape';

  if (!file || !file.size) {
    return new Response(JSON.stringify({ error: 'No image provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate size (2MB)
  if (file.size > 2 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'File too large (max 2MB)' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate content type
  if (!file.type.startsWith('image/')) {
    return new Response(JSON.stringify({ error: 'Only images allowed' }), {
      status: 415,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const ext = file.type.includes('webp') ? '.webp' : file.type.includes('png') ? '.png' : '.jpg';
  const key = 'cards/' + id + ext;

  await env.CARDS_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { orientation, uploadedAt: new Date().toISOString() },
  });

  return new Response(
    JSON.stringify({ id, key, orientation }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// ── Serve image from R2 ─────────────────────────────────────────
async function handleImage(key, env, corsHeaders) {
  const object = await env.CARDS_BUCKET.get(key);
  if (!object) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': object.httpMetadata?.contentType || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
