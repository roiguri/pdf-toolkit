# Rollback Plan for PDF Compressor Deployment

This document outlines the rollback procedures for each stage of the deployment process to Google Cloud Run.

## Phase 1: Configuration & Prerequisites

**Actions:**
- Enable Cloud Run and Container Registry APIs.
- Configure Docker authentication.

**Rollback:**
1.  **Disable APIs (Optional):** If enabling APIs caused unexpected issues or costs, you can disable them:
    ```bash
    gcloud services disable run.googleapis.com containerregistry.googleapis.com
    ```
2.  **Reset Docker Config:** If `gcloud auth configure-docker` corrupted your Docker config:
    -   Restore the backup of `~/.docker/config.json` (Docker usually creates a backup).
    -   Or manually remove the `gcr.io` helpers from the config file.

## Phase 2: Build & Push Docker Image

**Actions:**
- Build Docker image locally.
- Push image to Google Container Registry (GCR).

**Rollback:**
1.  **Remove Local Image:**
    ```bash
    docker rmi us-central1-docker.pkg.dev/gen-lang-client-0812613801/pdf-tools-repo/pdf-compressor
    ```
2.  **Delete Remote Image:** If a bad image was pushed and you want to ensure it's not used:
    ```bash
    gcloud artifacts docker images delete us-central1-docker.pkg.dev/gen-lang-client-0812613801/pdf-tools-repo/pdf-compressor:latest --delete-tags --quiet
    ```
    *Note: If you used a specific tag instead of latest, delete that tag.*

## Phase 3: Deploy to Cloud Run

**Actions:**
- Deploy the container to Cloud Run as the `pdf-compressor` service.

**Rollback:**
1.  **Revert to Previous Revision:**
    Cloud Run automatically manages revisions. If the new deployment fails or is buggy, route 100% of traffic back to the previous healthy revision.
    
    *List revisions to find the previous one:*
    ```bash
    gcloud run revisions list --service pdf-compressor --region us-central1
    ```
    
    *Rollback traffic:*
    ```bash
    gcloud run services update-traffic pdf-compressor --to-revisions=[PREVIOUS_REVISION_NAME]=100 --region us-central1
    ```

2.  **Delete the Service (Extreme Case):**
    If the service was created in error and needs to be removed entirely:
    ```bash
    gcloud run services delete pdf-compressor --region us-central1
    ```

## Verification
After any rollback, verify the system state:
1.  Check the Cloud Run console to ensure the correct revision is serving traffic.
2.  Verify the application endpoint returns the expected response (or error if deleted).
