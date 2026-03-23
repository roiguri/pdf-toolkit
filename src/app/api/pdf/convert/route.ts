import { NextRequest } from 'next/server';

const RENDER_API_URL = 'https://pdf-compressor-621306512794.us-central1.run.app/render';

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

  const file = form.get('file');
  const pageRaw = form.get('page') ?? '1';
  const page = parseInt(String(pageRaw), 10);

  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing field: file (PDF)' }, { status: 400 });
  }
  if (isNaN(page) || page < 1) {
    return Response.json({ error: 'Invalid field: page must be a positive integer' }, { status: 400 });
  }

  try {
    const upstream = new FormData();
    upstream.append('file', file);
    upstream.append('page', String(page));

    const response = await fetch(RENDER_API_URL, { method: 'POST', body: upstream });

    if (!response.ok) {
      const text = await response.text();
      return Response.json({ error: `Render service error: ${text}` }, { status: 502 });
    }

    const imageBuffer = await response.arrayBuffer();
    const outName = file.name.replace(/\.pdf$/i, `_page${page}.png`);

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${outName}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
