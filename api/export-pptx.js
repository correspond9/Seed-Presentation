import { htmlToPptxBuffer } from '../lib/pptx-export.js';

export async function POST(request) {
  try {
    const { html } = await request.json();
    if (!html || typeof html !== 'string') {
      return Response.json({ ok: false, error: 'Missing slide content' }, { status: 400 });
    }

    const buffer = await htmlToPptxBuffer(html);
    const filename = 'XchangeByte-Investor-Pitch.pptx';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('PPTX export error:', err);
    const message = err && err.message ? err.message : 'Could not create PowerPoint file';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
