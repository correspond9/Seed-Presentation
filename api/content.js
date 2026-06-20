import { put, list } from '@vercel/blob';

const BLOB_NAME = 'pitch-content.json';

export async function GET() {
  try {
    const { blobs } = await list({ prefix: BLOB_NAME, limit: 1 });
    if (!blobs.length) {
      return Response.json({ html: null, updatedAt: null });
    }
    const res = await fetch(blobs[0].url);
    if (!res.ok) {
      return Response.json({ html: null, updatedAt: null });
    }
    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    console.error('Load error:', err);
    return Response.json({ html: null, updatedAt: null, error: 'Could not load saved content' });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { html, zoom } = body;
    if (!html || typeof html !== 'string') {
      return Response.json({ ok: false, error: 'Missing slide content' }, { status: 400 });
    }

    const payload = {
      html,
      zoom: typeof zoom === 'number' ? zoom : null,
      mediaLibrary: Array.isArray(body.mediaLibrary) ? body.mediaLibrary : [],
      globalLogo: body.globalLogo || null,
      updatedAt: new Date().toISOString(),
    };

    await put(BLOB_NAME, JSON.stringify(payload), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });

    return Response.json({ ok: true, updatedAt: payload.updatedAt });
  } catch (err) {
    console.error('Save error:', err);
    return Response.json(
      { ok: false, error: 'Could not save. Make sure Blob storage is enabled in Vercel.' },
      { status: 500 }
    );
  }
}
