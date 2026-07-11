# PDF Tools API Reference

A token-authenticated REST API for headless PDF processing. All operations are stateless — send a file, receive a processed file back.

## Base URL

**Local development:** `http://localhost:3000`
**Production:** your Netlify deployment URL

## Authentication

Every request must include an `Authorization` header:

```
Authorization: Bearer <token>
```

Missing or incorrect tokens return `401 Unauthorized`.

**Two token types are accepted, and not every endpoint accepts both:**

| Endpoint | API key | Firebase ID token |
| --- | --- | --- |
| `/api/pdf/compress` | ✅ | ✅ |
| `/api/pdf/scan` | ✅ | ✅ |
| `/api/pdf/scan/detect` | ✅ | ✅ |
| `/api/pdf/split` | ✅ | ❌ |
| `/api/pdf/merge` | ✅ | ❌ |
| `/api/pdf/convert` | ✅ | ❌ |

The **API key** is the `PDF_API_KEY` environment variable on the server. It works on
every endpoint and is the right choice for headless integrations.

A **Firebase ID token** is what a signed-in web user carries. It is accepted only on the
endpoints the browser app actually calls. Sending one to `split`, `merge`, or `convert`
returns 401 — those check the API key by string equality and have no Firebase path.

### Adding an API client

Give the client the `PDF_API_KEY` value and have it send `Authorization: Bearer <key>`.
There is a single shared key — it is not per-client, so it cannot be revoked for one
consumer without revoking it for all of them. Rotating it means updating `PDF_API_KEY`
in the host's environment and redeploying; every client breaks until it gets the new
value.

The key bypasses Firebase auth entirely, so treat it as a full-access credential: keep it
out of browsers, client-side bundles, and git.

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

### POST `/api/pdf/scan`

Convert one or more images to a scanned PDF. Images are auto-detected and perspective-corrected. Optionally supply explicit corners (web UI path).

**Request** — `multipart/form-data`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `images` | File[] (image) | Yes | — | One or more image files (repeat field for each) |
| `enhance` | string | No | `"true"` | Apply adaptive contrast enhancement: `"true"` or `"false"` |
| `corners_N` | string | No | — | Explicit corners for image N (0-indexed): `"x1,y1,x2,y2,x3,y3,x4,y4"` in TL→TR→BR→BL order |

**Response**

- `200 OK` — `application/pdf` binary
- `400` — missing images
- `401` — unauthorized
- `502` — scan service error
- `500` — processing error

**Example**

```bash
# Automatic detection (bot/CLI)
curl -X POST https://your-app.netlify.app/api/pdf/scan \
  -H "Authorization: Bearer <API_KEY>" \
  -F "images=@photo1.jpg" \
  -F "images=@photo2.jpg" \
  --output scanned.pdf

# With explicit corners (web UI path, corners in original image pixels)
curl -X POST https://your-app.netlify.app/api/pdf/scan \
  -H "Authorization: Bearer <API_KEY>" \
  -F "images=@photo.jpg" \
  -F "corners_0=50,60,540,55,545,720,48,715" \
  --output scanned.pdf
```

---

### POST `/api/pdf/scan/detect`

Detect document corners in a single image. Used by the web UI to show draggable handles before scanning.

**Request** — `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File (image) | Yes | The source image |

**Response**

- `200 OK` — JSON `{ corners: [[x,y],[x,y],[x,y],[x,y]] | null, width: number, height: number }`
  - `corners` is `null` if no document was detected (UI should fall back to full-image corners)
  - Corners are in original image pixel coordinates, ordered TL→TR→BR→BL
- `400` — missing file
- `401` — unauthorized
- `502` — detection service error
- `500` — processing error

**Example**

```bash
curl -X POST https://your-app.netlify.app/api/pdf/scan/detect \
  -H "Authorization: Bearer <API_KEY>" \
  -F "file=@photo.jpg"
# Response: {"corners": [[44,0],[1152,0],[1152,1540],[71,1502]], "width": 1152, "height": 2048}
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

`compress`, `convert`, `scan`, and `scan/detect` proxy to the Python service on Cloud Run
(Ghostscript for compress/convert, OpenCV for scan). `split` and `merge` run entirely
in-process with `pdf-lib` and have no external dependency.

Server-side environment variables — all required, and a missing one surfaces as a 500:

| Variable | Used by |
| --- | --- |
| `PDF_API_KEY` | Every endpoint |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase ID token verification (`compress`, `scan`, `scan/detect`) |
| `COMPRESSOR_BASE_URL`, `GCP_INVOKER_CLIENT_EMAIL`, `GCP_INVOKER_PRIVATE_KEY` | Calling the Cloud Run service |

On Netlify these go in Site configuration → Environment variables. Changes do not take
effect until the next deploy.

The Cloud Run service is invoker-only: it rejects any caller other than the configured
service account, at Google's edge. To redeploy it, add a caller, or roll it back, see
`python-compressor/DEPLOY_INSTRUCTIONS.md` and `docs/ROLLBACK_PLAN.md`.
