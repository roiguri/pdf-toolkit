import { NextRequest } from 'next/server';

const SCAN_API_URL = 'https://pdf-compressor-621306512794.us-central1.run.app/scan';

export async function POST(req: NextRequest) {
  const apiKey = process.env.PDF_API_KEY;
  if (!apiKey || req.headers.get('Authorization') !== `Bearer ${apiKey}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const images = form.getAll('images');
  if (images.length === 0 || images.every(f => !(f instanceof File))) {
    return Response.json({ error: 'Missing field: images (one or more image files)' }, { status: 400 });
  }

  try {
    const upstream = new FormData();
    for (const img of images) {
      if (img instanceof File) upstream.append('images', img);
    }

    const enhance = form.get('enhance');
    if (enhance !== null) upstream.append('enhance', String(enhance));

    // Forward per-image corners if provided (corners_0, corners_1, ...)
    for (const [key, value] of form.entries()) {
      if (/^corners_\d+$/.test(key)) upstream.append(key, String(value));
    }

    const response = await fetch(SCAN_API_URL, { method: 'POST', body: upstream });

    if (!response.ok) {
      const text = await response.text();
      return Response.json({ error: `Scan service error: ${text}` }, { status: 502 });
    }

    const pdfBuffer = await response.arrayBuffer();
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="scanned.pdf"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
