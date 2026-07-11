# Rollback Plan for PDF Compressor Deployment

Rollback procedures for the Python compression service on Cloud Run.

Substitute `<PROJECT_ID>`, `<REGION>`, and `<TAG>` with your own values — see
`python-compressor/DEPLOY_INSTRUCTIONS.md` for how to find them.

## Fastest rollback: revert traffic to the previous revision

This is almost always the right move. Cloud Run keeps every revision, and shifting
traffic back is instant — no rebuild, no image work, no risk of pushing something new
while production is broken. Reach for the image-level steps below only if a bad image
must actually be destroyed.

```bash
gcloud run revisions list --service pdf-compressor --region <REGION>

gcloud run services update-traffic pdf-compressor \
  --region <REGION> \
  --to-revisions=<PREVIOUS_REVISION_NAME>=100
```

Verify the service still rejects unauthenticated callers after any traffic change:

```bash
curl -s -o /dev/null -w '%{http_code}\n' <SERVICE_URL>/does-not-exist
# 403 = correct (rejected at Google's edge). 404 = publicly invocable — see below.
```

## If IAM was changed

The service must be invoker-only. If a deploy re-granted public access — most commonly
by passing `--allow-unauthenticated`, which re-adds the `allUsers` binding — remove it:

```bash
gcloud run services remove-iam-policy-binding pdf-compressor \
  --region <REGION> \
  --member=allUsers --role=roles/run.invoker
```

Confirm the invoker service account still holds `roles/run.invoker` **before** removing
`allUsers`, or the app loses access the moment the change propagates:

```bash
gcloud run services get-iam-policy pdf-compressor --region <REGION>
```

## If a bad image was pushed

The live service is deployed from Container Registry (`gcr.io`), not Artifact Registry.

```bash
docker rmi gcr.io/<PROJECT_ID>/pdf-compressor:<TAG>

gcloud container images delete gcr.io/<PROJECT_ID>/pdf-compressor:<TAG> --quiet
```

Deleting an image does **not** roll back a running service — Cloud Run pins the image
digest at deploy time and keeps serving it. Shift traffic to a known-good revision
first, then clean up the image.

## Extreme case: delete the service

```bash
gcloud run services delete pdf-compressor --region <REGION>
```

This takes `compress`, `convert`, `scan`, and `scan/detect` offline. The rest of the app
(split, merge, edit, and the client-side viewer) keeps working — those run in the browser
via `pdf-lib` and do not touch this service.

## Verification after any rollback

1. The intended revision is serving traffic (`gcloud run revisions list`).
2. An unauthenticated request returns `403`, not `404` — see the check above. IAM changes
   take a minute or two to propagate.
3. Compress a file through the deployed web app end to end.
