# **Architecture & Design Document: Cloud-Based PDF Toolkit**

> **⚠️ ARCHIVED — historical planning document, not a description of the current system.**
>
> Written before implementation (November 2025) and never updated. The system as built
> diverged from it in significant ways: compression runs on a Python/Ghostscript service
> on Cloud Run rather than the Firebase Cloud Function proposed in §7.2, and the Scan and
> Edit features described nowhere here are now core functionality.
>
> Retained as a record of the original intent. **Do not use it to understand how the app
> works today** — see [`README.md`](../../README.md) for setup and features,
> [`docs/api.md`](../api.md) for the API surface and auth model, and
> [`python-compressor/DEPLOY_INSTRUCTIONS.md`](../../python-compressor/DEPLOY_INSTRUCTIONS.md)
> for the infrastructure.

**Version:** 1.0

**Status:** Approved for Development *(superseded — see banner above)*

**Tech Stack:** Next.js, TypeScript, Firebase (Auth, Firestore, Storage), pdf-lib, react-pdf

## **1\. Executive Summary**

The PDF Toolkit is a web-based SaaS application designed to replace desktop PDF software. It provides a centralized dashboard where users can upload, manage, and manipulate (Split, Merge, Convert) PDF documents.

**Key differentiator:** The application utilizes a **Serverless, Client-Heavy Architecture**. 90% of PDF processing happens directly in the user's browser using WebAssembly and JavaScript libraries, minimizing server costs and providing instant feedback. Firebase is used strictly for Authentication, Metadata persistence, and Cloud Storage.

## **2\. System Architecture**

### **2.1 High-Level Architecture Diagram**

The system relies on the browser's computational power for heavy lifting. Firebase acts as the "Backend-as-a-Service" (BaaS).

graph TD  
    subgraph "Client Side (Browser)"  
        UI\[Next.js UI Components\]  
        State\[Zustand Store\]  
        Logic\[PDF Processing Engine\]  
          
        UI \--\> State  
        State \--\> Logic  
        Logic \--\>|pdf-lib| Edit\[Edit: Split/Merge\]  
        Logic \--\>|react-pdf| View\[View: Render/Canvas\]  
    end

    subgraph "Firebase Services (BaaS)"  
        Auth\[Firebase Authentication\]  
        DB\[Firestore Database\]  
        Store\[Firebase Storage\]  
        Func\[Cloud Functions (Future)\]  
    end

    UI \--\>|Auth SDK| Auth  
    UI \--\>|Direct Upload/Download| Store  
    UI \--\>|Read/Write Metadata| DB  
      
    Logic \--\>|Load ArrayBuffer| Store  
      
    %% Future Scope  
    Func \-.-\>|Trigger on Event| Store  
    Func \-.-\>|Heavy Tasks: Compression| Store

### **2.2 Core Technology Stack**

| Component | Technology | Rationale |
| :---- | :---- | :---- |
| **Frontend Framework** | **Next.js (App Router)** | React-based, optimized routing, Server Components for initial dashboard shell. |
| **Language** | **TypeScript** | Strict typing is essential for handling binary ArrayBuffers and file streams. |
| **Authentication** | **Firebase Auth** | Native support for Google Sign-In and Email/Password; integrates seamlessly with Firestore security rules. |
| **Database** | **Cloud Firestore** | NoSQL, Real-time listeners (auto-updates file list), scales automatically. |
| **File Storage** | **Firebase Storage** | Secure cloud storage for raw PDF files. Requires strict CORS config. |
| **PDF Manipulation** | **pdf-lib** | Pure JavaScript library. Allows modification of PDFs in the browser without server round-trips. |
| **PDF Rendering** | **react-pdf** | Wrapper around PDF.js. Used for viewing and rendering pages to \<canvas\> for image conversion. |
| **UI Library** | **shadcn/ui \+ Tailwind** | clean, accessible components; easy support for Dark Mode. |

## **3\. Data Design**

### **3.1 Firestore Schema**

We utilize a nested sub-collection pattern to ensure strict data isolation. A user can only query the files collection that exists under their own user ID.

**Path:** users/{userId}

* email: string  
* createdAt: timestamp  
* displayName: string  
* photoURL: string

**Path:** users/{userId}/files/{fileId}

* id: string (UUID)  
* name: string (Original filename)  
* size: number (Bytes)  
* type: string ("application/pdf")  
* storageRef: string (Full path in bucket, e.g., uploads/{uid}/{fileId}.pdf)  
* downloadURL: string (Publicly accessible link via token)  
* uploadedAt: timestamp  
* lastModified: timestamp  
* pageCount: number (Optional, calculated on upload)

### **3.2 Storage Structure**

* **Bucket Root**  
  * uploads/  
    * {userId}/  
      * {fileId\_originalName}.pdf

## **4\. Component Design (Frontend)**

The application uses a **Split-Screen Layout**.

\+------------------+------------------------------------------------+  
|  Header (Logo, User Profile, Theme Toggle)                        |  
\+------------------+------------------------------------------------+  
|  SIDEBAR (30%)   |  MAIN WORKSPACE (70%)                          |  
|                  |                                                |  
|  \[Drop Zone\]     |  \+------------------------------------------+  |  
|                  |  | Toolbar (Split | Merge | Convert)        |  |  
|  \[File List\]     |  \+------------------------------------------+  |  
|   \- File A       |                                                |  
|   \- File B       |  \[ PDF Viewer / Canvas \]                       |  
|   \- File C       |                                                |  
|                  |                                                |  
\+------------------+------------------------------------------------+

### **Key Components**

1. **DashboardLayout.tsx**: Manages the split-screen grid.  
2. **FileExplorer.tsx**:  
   * Subscribes to Firestore onSnapshot.  
   * Handles drag-and-drop uploads.  
   * Manages "Active File" state in Zustand.  
3. **Workspace.tsx**:  
   * Dynamic renderer. If mode \=== 'view', show PDFViewer. If mode \=== 'merge', show MergeBuilder.  
4. **ActionToolbar.tsx**:  
   * Contains the primary tool buttons.  
   * Disables buttons if no file is selected (or \< 2 for merge).

## **5\. Feature Specifications & User Flows**

### **5.1 Secure User Access (Authentication)**

* **Spec:** Users must authenticate to read/write data.  
* **Implementation:** Wrap the main app in a ProtectedRoute component that checks Firebase auth.currentUser.

sequenceDiagram  
    participant User  
    participant UI as Login Page  
    participant FB as Firebase Auth  
    participant App as Dashboard

    User-\>\>UI: Clicks "Sign in with Google"  
    UI-\>\>FB: signInWithPopup(provider)  
    FB--\>\>UI: Returns Auth Token & User Info  
    UI-\>\>App: Redirects to /dashboard  
    App-\>\>FB: Verifies Session  
    App--\>\>User: Displays Workspace

### **5.2 Document Management (Upload)**

* **Spec:** Drag-and-drop, immediate availability, metadata extraction.  
* **Implementation:**  
  1. react-dropzone captures file.  
  2. Upload file blob to Firebase Storage.  
  3. On success, write document metadata to Firestore.  
  4. Firestore listener automatically updates the UI sidebar.

sequenceDiagram  
    participant User  
    participant FE as File Explorer  
    participant Store as Firebase Storage  
    participant DB as Firestore

    User-\>\>FE: Drops "invoice.pdf"  
    FE-\>\>FE: Validates type (PDF only)  
    FE-\>\>Store: uploadBytes(ref, file)  
    Store--\>\>FE: Returns downloadURL  
    FE-\>\>DB: addDoc("users/{uid}/files", metadata)  
    DB--\>\>FE: Document Created (Listener triggers)  
    FE--\>\>User: File appears in list

### **5.3 Split Tool (Client-Side)**

* **Spec:** User inputs page range (e.g., "1, 3-5"), app downloads new PDF.  
* **Logic:**  
  1. Fetch ArrayBuffer of original PDF from downloadURL.  
  2. Load into pdf-lib (PDFDocument.load).  
  3. Create a **new** empty PDFDocument.  
  4. Copy pages from *Original* to *New* based on user input.  
  5. Save *New* doc to bytes \-\> Create Blob \-\> Trigger Browser Download.  
* **Note:** No new file is uploaded to storage (Non-destructive).

### **5.4 Combine Tool (Client-Side)**

* **Spec:** User selects multiple files, reorders them, and downloads a merged PDF.  
* **Logic:**  
  1. User enters "Merge Mode" (checkboxes appear in Sidebar).  
  2. User selects files A, B, and C.  
  3. App fetches ArrayBuffer for all 3 files concurrently.  
  4. Load all into pdf-lib.  
  5. Create *New* doc.  
  6. Loop through A, B, C \-\> Copy all pages \-\> Add to *New*.  
  7. Save & Download.

### **5.5 Convert to Image (Client-Side)**

* **Spec:** Convert specific page to PNG/JPG.  
* **Logic:**  
  1. Use react-pdf to render the specific page to a hidden HTML \<canvas\>.  
  2. Use canvas.toDataURL('image/png') to get the image data.  
  3. Create an anchor tag \<a href="data:..." download="page1.png"\> and click it programmatically.

## **6\. Security & Configuration**

### **6.1 CORS Configuration (Critical)**

Because we are loading PDFs into \<canvas\> elements and pdf-lib from a different domain (Storage bucket), strict CORS rules are required on the bucket.

**cors.json**:

\[  
  {  
    "origin": \["http://localhost:3000", "\[https://your-production-app.com\](https://your-production-app.com)"\],  
    "method": \["GET"\],  
    "maxAgeSeconds": 3600,  
    "responseHeader": \["Content-Type", "Access-Control-Allow-Origin"\]  
  }  
\]

### **6.2 Firestore Security Rules**

Ensure strict tenant isolation.

rules\_version \= '2';  
service cloud.firestore {  
  match /databases/{database}/documents {  
    // Helper function  
    function isOwner(userId) {  
      return request.auth \!= null && request.auth.uid \== userId;  
    }

    // Lock down users collection  
    match /users/{userId} {  
      allow read, write: if isOwner(userId);  
        
      // Lock down nested files  
      match /files/{fileId} {  
        allow read, write: if isOwner(userId);  
      }  
    }  
  }  
}

### **6.3 Storage Security Rules**

rules\_version \= '2';  
service firebase.storage {  
  match /b/{bucket}/o {  
    match /uploads/{userId}/{allPaths=\*\*} {  
      allow read, write: if request.auth \!= null && request.auth.uid \== userId;  
    }  
  }  
}

## **7\. Future Scalability & Limitations**

### **7.1 Browser Memory Limits**

* **Risk:** Loading a 500MB PDF into browser memory for splitting might crash the tab.  
* **Mitigation:** Implement a check on file size before processing. If size \> 100MB, show a toast: *"File too large for browser processing. Feature coming soon."*

### **7.2 Compression (Server-Side)**

This is the only feature that breaks the "Client-Only" rule.

* **Implementation:**  
  1. User clicks "Compress".  
  2. Frontend triggers a **Firebase Cloud Function** (HTTP Callable).  
  3. Cloud Function downloads file to temp disk.  
  4. Executes Ghostscript binary (must be included in function container).  
  5. Uploads optimized file to Storage.  
  6. Updates Firestore.

### **7.3 Signatures**

* **Implementation:**  
  1. Frontend: Use react-signature-canvas to capture user drawing.  
  2. Convert drawing to PNG Base64.  
  3. Use pdf-lib to drawImage onto the PDF page at specific coordinates.  
  4. Flatten and Download.