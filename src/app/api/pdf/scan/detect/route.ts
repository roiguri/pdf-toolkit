import { NextRequest } from 'next/server';

const DETECT_API_URL = 'https://pdf-compressor-621306512794.us-central1.run.app/detect';

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
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing field: file (image)' }, { status: 400 });
  }

  try {
    const upstream = new FormData();
    upstream.append('file', file);

    const response = await fetch(DETECT_API_URL, { method: 'POST', body: upstream });

    if (!response.ok) {
      const text = await response.text();
      return Response.json({ error: `Detection service error: ${text}` }, { status: 502 });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
