# PDF Toolkit

A modern web application for managing and manipulating PDF files. Built with Next.js, Firebase, and pdf-lib.

> **Note:** This app is invite-only — access is gated to an authenticated allowlist. There is no public live demo link.

## Features

- **User Authentication** - Secure sign-in with Google or email/password via Firebase Auth
- **Cloud Storage** - Store and manage your PDF files in the cloud with Firebase Storage
- **PDF Viewer** - Preview PDF documents directly in the browser
- **Split PDF** - Extract specific pages or page ranges from a PDF (e.g., "1, 3-5, 7")
- **Merge PDFs** - Combine multiple PDF files into a single document, with reorderable pages
- **Compress PDF** - Reduce file size with selectable quality levels
- **Edit PDF** - Add highlights, text annotations, signatures, and bookmarks
- **Scan to PDF** - Capture images and convert them to scanned PDFs with corner adjustment
- **Convert to Image** - Export PDF pages as images
- **File Explorer** - Organize and browse your uploaded PDFs
- **PWA Support** - Installable as a Progressive Web App with offline capabilities

## Tech Stack

- **Framework**: Next.js 16 with React 19
- **Authentication & Storage**: Firebase (Auth, Firestore, Storage)
- **PDF Processing**: pdf-lib, react-pdf
- **UI Components**: Radix UI, Tailwind CSS
- **State Management**: Zustand

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- Firebase project with Authentication, Firestore, and Storage enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/roiguri/pdf-toolkit.git
   cd pdf-toolkit
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up Firebase Project**

   a. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project

   b. Enable the following services:
      - **Authentication**: Enable Google and Email/Password sign-in methods
      - **Firestore Database**: Create a database (start in production mode)
      - **Storage**: Set up Cloud Storage

   c. Install Firebase CLI and deploy security rules **and functions**:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   # Select Firestore, Storage, and Functions when prompted
   # Use existing firebase.json configuration
   firebase deploy --only firestore:rules,storage,functions
   ```

   > **The invite gate lives in `functions/`.** `checkInvite` is a `beforeUserSignedIn`
   > blocking trigger that rejects any sign-in whose email has no document in the
   > `invites` collection. Deploy rules without functions and the app is **not**
   > invite-only — anyone with a Google account can sign in.

   d. Authorize yourself. `firestore.rules` locks the `invites` collection to the Admin
   SDK (`allow read, write: if false`), so it cannot be edited from the client — add the
   first invite from the Firebase Console, as a document whose **ID is the email address**:

   ```
   invites/you@example.com
   ```

   e. Create a `.env.local` file in the root directory. The `NEXT_PUBLIC_*` values are the
   client Firebase config (Firebase Console → Project Settings → Your Apps). The rest are
   server-side and are required for the API routes to work at all:

   ```env
   # Client (Firebase web config — shipped to the browser)
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # Server — Firebase Admin SDK, verifies signed-in users' ID tokens.
   # From a service account JSON key (Project Settings → Service accounts).
   # Without these, every API route returns 401.
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

   # Server — shared bearer token for headless API clients (see docs/api.md)
   PDF_API_KEY=any_long_random_string

   # Server — calling the Python service on Cloud Run (see python-compressor/DEPLOY_INSTRUCTIONS.md).
   # Only needed for compress / convert / scan.
   COMPRESSOR_BASE_URL=https://your-cloud-run-service-url   # no trailing slash
   GCP_INVOKER_CLIENT_EMAIL=your-invoker-sa@your_project.iam.gserviceaccount.com
   GCP_INVOKER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

   Keep the `\n` escapes in the private keys literal — the code calls
   `.replace(/\\n/g, '\n')` and expects escapes, not real newlines.

   When deploying, set every non-`NEXT_PUBLIC_` variable in your host's environment
   (Netlify: Site configuration → Environment variables). They do not take effect until
   the next deploy.

4. **Set up the Python compression service** (optional for local dev)

   The PDF compression feature is powered by a separate Python service in `python-compressor/`, deployed on Cloud Run with IAM authentication. For local development you can either:
   - Deploy your own Cloud Run instance following `python-compressor/DEPLOY_INSTRUCTIONS.md`, or
   - Stub out / skip the compression call entirely.

5. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

6. **Open the application**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Security

This application implements proper multi-user security:

### Data Isolation
- **Firestore**: Each user's files are stored in `users/{userId}/files/`
- **Storage**: Each user's PDFs are stored in `uploads/{userId}/`

### Security Rules
The included security rules ensure users can only access their own data:

**Firestore** (`firestore.rules`):
```javascript
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
  match /files/{fileId} {
    allow read, write: if request.auth.uid == userId;
  }
}
```

**Storage** (`storage.rules`):
```javascript
match /uploads/{userId}/{allPaths=**} {
  allow read, write: if request.auth.uid == userId;
}
```

These rules ensure that User A cannot access User B's files - Firebase enforces this at the database level.

## Usage

1. **Sign In** - Use Google or email/password to authenticate
2. **Upload PDFs** - Drag and drop or select files to upload
3. **Select a Tool** - Choose Split, Merge, or Convert from the toolbar
4. **Process Files** - Select files and apply the desired operation
5. **Download Results** - Save processed PDFs to your device

## Project Structure

```
src/
├── app/                 # Next.js app router pages
├── components/
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Dashboard UI (FileExplorer, Workspace, Toolbar)
│   ├── layout/         # Layout components
│   ├── pdf/            # PDF viewer component
│   └── ui/             # Reusable UI components
├── lib/                # Utilities (Firebase config, PDF utils)
├── services/           # Firebase services (Firestore, Storage)
└── store/              # Zustand state management
```
