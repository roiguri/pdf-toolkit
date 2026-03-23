# PDF Tools API Reference

A token-authenticated REST API for headless PDF processing. All operations are stateless — send a file, receive a processed file back.

## Base URL

**Local development:** `http://localhost:3000`
**Production:** your Netlify deployment URL

## Authentication

Every request must include an `Authorization` header:

```
Authorization: Bearer <PDF_API_KEY>
```

The key is set via the `PDF_API_KEY` environment variable on the server. Missing or incorrect tokens return `401 Unauthorized`.

---

## Endpoints

### POST `/api/pdf/split`

Extract a subset of pages from a PDF into a new PDF.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File (PDF) | Yes | The source PDF |
| `pages` | string | Yes | Page range, e.g. `1-3`, `2,4,6`, `1-3,5` |

**Response**

- `200 OK` — `application/pdf` binary
- `400` — missing or invalid fields
- `401` — unauthorized
- `422` — no pages matched the given range
- `500` — processing error

**Example**

```bash
curl -X POST https://your-app.netlify.app/api/pdf/split \
  -H "Authorization: Bearer <API_KEY>" \
  -F "file=@document.pdf" \
  -F "pages=1-3" \
  --output split.pdf
```

---

### POST `/api/pdf/merge`

Combine multiple PDFs into a single PDF, in the order provided.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `files` | File[] (PDF) | Yes | At least 2 PDFs (repeat field for each file) |

**Response**

- `200 OK` — `application/pdf` binary
- `400` — fewer than 2 files provided
- `401` — unauthorized
- `500` — processing error

**Example**

```bash
curl -X POST https://your-app.netlify.app/api/pdf/merge \
  -H "Authorization: Bearer <API_KEY>" \
  -F "files=@first.pdf" \
  -F "files=@second.pdf" \
  -F "files=@third.pdf" \
  --output merged.pdf
```

---

### POST `/api/pdf/compress`

Reduce PDF file size using Ghostscript. Higher compression = lower quality.

**Request** — `multipart/form-data`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | File (PDF) | Yes | — | The source PDF |
| `level` | string | No | `ebook` | Compression level: `screen`, `ebook`, or `prepress` |

**Compression levels**

| Level | DPI | Best for |
|---|---|---|
| `screen` | 72 | Smallest size, screen viewing only |
| `ebook` | 150 | Good balance of size and quality |
| `prepress` | 300 | High quality, minimal compression |

**Response**

- `200 OK` — `application/pdf` binary
- `400` — missing file or invalid level
- `401` — unauthorized
- `502` — compression service error
- `500` — processing error

**Example**

```bash
curl -X POST https://your-app.netlify.app/api/pdf/compress \
  -H "Authorization: Bearer <API_KEY>" \
  -F "file=@document.pdf" \
  -F "level=ebook" \
  --output compressed.pdf
```

---

### POST `/api/pdf/convert`

Render a single PDF page as a PNG image (150 dpi).

**Request** — `multipart/form-data`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | File (PDF) | Yes | — | The source PDF |
| `page` | number | No | `1` | Page number to render (1-indexed) |

**Response**

- `200 OK` — `image/png` binary
- `400` — missing file or invalid page number
- `401` — unauthorized
- `502` — render service error
- `500` — processing error

**Example**

```bash
curl -X POST https://your-app.netlify.app/api/pdf/convert \
  -H "Authorization: Bearer <API_KEY>" \
  -F "file=@document.pdf" \
  -F "page=2" \
  --output page2.png
```

---

## Error Response Format

All errors return JSON:

```json
{ "error": "Description of what went wrong" }
```

---

## Integration Examples

### Node.js (Telegram bot, CLI, etc.)

```js
const FormData = require('form-data');
const fs = require('fs');

async function splitPdf(filePath, pages) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('pages', pages);

  const res = await fetch('https://your-app.netlify.app/api/pdf/split', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.PDF_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error);
  }
  return Buffer.from(await res.arrayBuffer()); // PDF bytes
}
```

### Python

```python
import requests

def compress_pdf(file_path, level='ebook'):
    with open(file_path, 'rb') as f:
        res = requests.post(
            'https://your-app.netlify.app/api/pdf/compress',
            headers={'Authorization': f'Bearer {API_KEY}'},
            files={'file': f},
            data={'level': level},
        )
    res.raise_for_status()
    return res.content  # PDF bytes
```

---

## Deployment Notes

- Set `PDF_API_KEY` in your hosting platform's environment variables (Netlify: Site configuration → Environment variables)
- The compress and convert operations depend on the Python Ghostscript service at `https://pdf-compressor-621306512794.us-central1.run.app` (Google Cloud Run, project `pdf-tools-e8e51`)
- To redeploy the Python service, see `python-compressor/DEPLOY_INSTRUCTIONS.md`
