import { put, list, head } from '@vercel/blob';

const BLOB_NAME = 'pitch-content.json';

function getBlobOptions() {
  const opts = {};
  if (process.env.BLOB_STORE_ID) {
    opts.storeId = process.env.BLOB_STORE_ID;
  }
  if (process.env.VERCEL_OIDC_TOKEN) {
    opts.oidcToken = process.env.VERCEL_OIDC_TOKEN;
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    opts.token = process.env.BLOB_READ_WRITE_TOKEN;
  }
  return opts;
}

function storageErrorMessage(err) {
  const msg = (err && err.message) ? err.message : String(err);
  if (/token|auth|credential|BLOB_|store/i.test(msg)) {
    return 'Could not connect to Vercel Blob storage. In Vercel → Storage → your Blob store → Projects, connect it to seed-presentation, then redeploy.';
  }
  return msg || 'Could not save content';
}

export async function GET() {
  try {
    const blobOpts = getBlobOptions();

    try {
      const meta = await head(BLOB_NAME, blobOpts);
      if (meta && meta.url) {
        const res = await fetch(meta.url);
        if (res.ok) {
          const data = await res.json();
          return Response.json(data);
        }
      }
    } catch (headErr) {
      if (!/not found|404/i.test(headErr.message || '')) {
        throw headErr;
      }
    }

    const { blobs } = await list({ prefix: BLOB_NAME, limit: 1, ...blobOpts });
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
    return Response.json({
      html: null,
      updatedAt: null,
      error: storageErrorMessage(err),
    });
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

    const json = JSON.stringify(payload);
    const blobOpts = getBlobOptions();

    await put(BLOB_NAME, json, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      ...blobOpts,
    });

    return Response.json({ ok: true, updatedAt: payload.updatedAt });
  } catch (err) {
    console.error('Save error:', err);
    return Response.json(
      { ok: false, error: storageErrorMessage(err) },
      { status: 500 }
    );
  }
}
