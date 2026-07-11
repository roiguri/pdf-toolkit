import { NextRequest } from 'next/server';
import { splitPdf } from '@/lib/pdf-utils';
import { contentDisposition } from '@/lib/content-disposition';

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
  const pages = form.get('pages');

  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing field: file (PDF)' }, { status: 400 });
  }
  if (typeof pages !== 'string' || !pages.trim()) {
    return Response.json({ error: 'Missing field: pages (e.g. "1-3,5")' }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const results = await splitPdf(arrayBuffer, pages, file.name.replace(/\.pdf$/i, ''));

    if (results.length === 0) {
      return Response.json({ error: 'No pages matched the given range' }, { status: 422 });
    }

    const { bytes, filename } = results[0];
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(filename),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/pdf/split]', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
