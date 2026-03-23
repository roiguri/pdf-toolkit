import { NextRequest } from 'next/server';
import { mergePdfs } from '@/lib/pdf-utils';

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

  const files = form.getAll('files');
  const pdfFiles = files.filter((f): f is File => f instanceof File);

  if (pdfFiles.length < 2) {
    return Response.json({ error: 'At least two files are required (field name: files)' }, { status: 400 });
  }

  try {
    const arrayBuffers = await Promise.all(pdfFiles.map((f) => f.arrayBuffer()));
    const { bytes, filename } = await mergePdfs(arrayBuffers, 'merged.pdf');

    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
