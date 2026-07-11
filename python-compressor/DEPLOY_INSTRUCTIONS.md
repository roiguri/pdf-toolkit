# Deploying the PDF Compression Service to Cloud Run

The Python service (Flask + Ghostscript + OpenCV) backs the `compress`, `convert`,
`scan`, and `scan/detect` API routes. It is **server-to-server only** — the Next.js
app is its sole caller, authenticating with a Google-signed ID token.

Throughout, substitute your own values:

| Placeholder | How to find it |
| --- | --- |
| `<PROJECT_ID>` | `gcloud config get-value project` |
| `<REGION>` | The region the service runs in (e.g. `us-central1`) |
| `<SERVICE_URL>` | `gcloud run services describe pdf-compressor --region <REGION> --format='value(status.url)'` |
| `<INVOKER_SA>` | `gcloud iam service-accounts list` — the `nextjs-invoker@…` account |

## Prerequisites

```bash
gcloud services enable run.googleapis.com
gcloud auth configure-docker gcr.io
```

## 1. Build and push the image

The live service is deployed from **Container Registry** (`gcr.io`), not Artifact
Registry. Use an explicit tag — Cloud Run pins the image digest at deploy time, so
overwriting `:latest` in place does not update a running service.

```bash
cd python-compressor
docker build -t gcr.io/<PROJECT_ID>/pdf-compressor:<TAG> .
docker push gcr.io/<PROJECT_ID>/pdf-compressor:<TAG>
```

## 2. Deploy

**Do not pass `--allow-unauthenticated`.** That flag grants `roles/run.invoker` to
`allUsers`, which lets anyone on the internet reach the Flask process — the service
URL is derivable from public information (it embeds the project number, which ships
to browsers as `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`), so it is not protected by
obscurity. The service is deliberately locked to invoker-only; that flag would
silently undo it.

```bash
gcloud run deploy pdf-compressor \
  --image gcr.io/<PROJECT_ID>/pdf-compressor:<TAG> \
  --region <REGION> \
  --no-allow-unauthenticated \
  --set-env-vars CLOUD_RUN_AUDIENCE=<SERVICE_URL>,INVOKER_SA_EMAIL=<INVOKER_SA>
```

Both env vars are **required at container boot**. `app.py` reads them with
`os.environ[...]`, so a missing one raises `KeyError` at import and the container
never starts — every request then returns 503 with no application log to explain it.

`CLOUD_RUN_AUDIENCE` must exactly equal the Next.js `COMPRESSOR_BASE_URL`, with **no
trailing slash**. They are the two halves of the same ID-token audience check; if they
disagree, every request fails with 401 and the cause is not obvious from either side.

## 3. Grant the invoker

```bash
gcloud run services add-iam-policy-binding pdf-compressor \
  --region <REGION> \
  --member=serviceAccount:<INVOKER_SA> \
  --role=roles/run.invoker
```

## 4. Verify

An unauthenticated request must be rejected by Google's front end, before it reaches
Flask. Request a path that does not exist in the app — if you get `404`, the request
reached your container and the service is **not** locked down. If you get `403`,
Google rejected it at the edge, which is correct.

```bash
curl -s -o /dev/null -w '%{http_code}\n' <SERVICE_URL>/does-not-exist
# 403 = correct. 404 = still publicly invocable.
```

IAM changes take a minute or two to propagate; re-check before concluding anything.

Then confirm the real path works by compressing a file through the deployed web app.

## Environment variables on the Next.js side

Set these on the host (Netlify: Site configuration → Environment variables). All are
read in `src/lib/`; a missing one throws at request time and surfaces as a 500.

| Variable | Purpose |
| --- | --- |
| `COMPRESSOR_BASE_URL` | Cloud Run service URL. Doubles as the ID-token audience. No trailing slash. |
| `GCP_INVOKER_CLIENT_EMAIL` | `client_email` from the invoker service account's JSON key |
| `GCP_INVOKER_PRIVATE_KEY` | `private_key` from that key file, with `\n` escapes preserved |

Env var changes do not reach a running site until the next deploy.

## Rolling back

### Revert traffic to the previous revision

Almost always the right move. Cloud Run keeps every revision, and shifting traffic back
is instant — no rebuild, no image work, no pushing something new while production is
broken. Reach for the image steps below only if a bad image must actually be destroyed.

```bash
gcloud run revisions list --service pdf-compressor --region <REGION>

gcloud run services update-traffic pdf-compressor \
  --region <REGION> \
  --to-revisions=<PREVIOUS_REVISION_NAME>=100
```

Re-run the verification check above afterwards — a traffic change should not affect IAM,
but confirm the service still returns `403` to unauthenticated callers.

### Restore invoker-only access

If a deploy re-granted public access — most commonly by passing `--allow-unauthenticated`,
which re-adds the `allUsers` binding — remove it:

```bash
gcloud run services get-iam-policy pdf-compressor --region <REGION>

gcloud run services remove-iam-policy-binding pdf-compressor \
  --region <REGION> \
  --member=allUsers --role=roles/run.invoker
```

Confirm the invoker service account still holds `roles/run.invoker` **before** removing
`allUsers`, or the app loses access the moment the change propagates.

### Remove a bad image

```bash
docker rmi gcr.io/<PROJECT_ID>/pdf-compressor:<TAG>
gcloud container images delete gcr.io/<PROJECT_ID>/pdf-compressor:<TAG> --quiet
```

Deleting an image does **not** roll back a running service — Cloud Run pins the image
digest at deploy time and keeps serving it. Shift traffic to a good revision first, then
clean up the image.

### Delete the service (extreme case)

```bash
gcloud run services delete pdf-compressor --region <REGION>
```

This takes `compress`, `convert`, `scan`, and `scan/detect` offline. The rest of the app
keeps working — split, merge, edit, and the viewer all run in the browser via `pdf-lib`
and never touch this service.

## Adding another caller

Today the service accepts exactly **one** caller. Adding a second takes two steps,
and skipping either produces a confusing failure.

**1. Grant IAM** (Google's front end — Layer 1):

```bash
gcloud run services add-iam-policy-binding pdf-compressor \
  --region <REGION> \
  --member=serviceAccount:<NEW_CALLER_SA> \
  --role=roles/run.invoker
```

**2. Allow the identity in the app** (Layer 2). `require_auth` in `app.py` compares the
caller's verified token email against the single `INVOKER_SA_EMAIL` value:

```python
if claims.get('email') != INVOKER_SA_EMAIL or not claims.get('email_verified'):
    return 'Forbidden', 403
```

A new caller that has been granted `run.invoker` but is not in `INVOKER_SA_EMAIL`
passes Google's check and is then rejected **by your own code** with a 403 — from the
outside this looks identical to an IAM problem, and it is easy to spend a long time
debugging the wrong layer.

To support multiple callers, make `INVOKER_SA_EMAIL` a comma-separated list and check
membership rather than equality, then redeploy with the new value.

The caller must send an ID token **audience-scoped to the service URL** — not an access
token. See `src/lib/cloudRunAuth.ts` for a reference implementation.

## Adding a new endpoint

New Flask routes need the `@require_auth` decorator — it is per-route, not global, so an
undecorated route is reachable by any authorized caller without an identity check. Add a
matching Next.js API route that proxies to it via `compressorAuthHeader()`, and document
it in `docs/api.md`.
