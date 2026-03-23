import { NextRequest } from 'next/server';

const COMPRESS_API_URL = 'https://pdf-compressor-837865788232.us-central1.run.app/compress';
const VALID_LEVELS = ['screen', 'ebook', 'prepress'] as const;
type CompressionLevel = typeof VALID_LEVELS[number];

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
  const level = (form.get('level') as string) ?? 'ebook';

  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing field: file (PDF)' }, { status: 400 });
  }
  if (!VALID_LEVELS.includes(level as CompressionLevel)) {
    return Response.json(
      { error: `Invalid level. Must be one of: ${VALID_LEVELS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const upstream = new FormData();
    upstream.append('file', file);
    upstream.append('quality', level);

    const response = await fetch(COMPRESS_API_URL, { method: 'POST', body: upstream });

    if (!response.ok) {
      const text = await response.text();
      return Response.json({ error: `Compression service error: ${text}` }, { status: 502 });
    }

    const compressed = await response.arrayBuffer();
    const outName = file.name.replace(/\.pdf$/i, `_compressed_${level}.pdf`);

    return new Response(compressed, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${outName}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
