# Google Cloud Run Deployment Instructions

Follow these steps to deploy the PDF compression service to Google Cloud Run.

## Prerequisites

1.  **Google Cloud SDK:** Make sure you have the `gcloud` command-line tool installed and configured. If not, follow the [official installation guide](https://cloud.google.com/sdk/docs/install).
2.  **Docker:** Docker must be installed on your local machine. Download it from the [official Docker website](https://www.docker.com/get-started).
3.  **Enable APIs:** Enable the Cloud Run and Container Registry APIs for your project:
    ```bash
    gcloud services enable run.googleapis.com
    gcloud services enable containerregistry.googleapis.com
    ```

## Deployment Steps

1.  **Authenticate Docker:** Configure Docker to use `gcloud` as a credential helper.
    ```bash
    gcloud auth configure-docker
    ```

2.  **Build the Docker Image:** Navigate to the `python-compressor` directory and build the Docker image. Replace `[PROJECT_ID]` with your Google Cloud project ID.
    ```bash
    cd python-compressor
    docker build -t gcr.io/[PROJECT_ID]/pdf-compressor .
    ```

3.  **Push the Image to GCR:** Push the image to the Google Container Registry.
    ```bash
    docker push gcr.io/[PROJECT_ID]/pdf-compressor
    ```

4.  **Deploy to Cloud Run:** Deploy the container image to Cloud Run. Replace `[PROJECT_ID]` with your project ID and `[REGION]` with your desired region (e.g., `us-central1`).
    ```bash
    gcloud run deploy pdf-compressor \
      --image gcr.io/[PROJECT_ID]/pdf-compressor \
      --platform managed \
      --region [REGION] \
      --allow-unauthenticated
    ```
    When prompted, confirm the service name and region. The `--allow-unauthenticated` flag makes the service publicly accessible.

5.  **Get the Service URL:** After deployment, the command will output the URL of your service. It will look something like this:
    `https://pdf-compressor-xxxxxxxxxx-uc.a.run.app`

    You will need this URL for the frontend integration.
