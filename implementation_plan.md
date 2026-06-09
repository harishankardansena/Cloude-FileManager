# Cross-Platform Unified File Manager

The goal is to build a cross-platform file manager that unifies Local Storage, Google Drive, and future cloud providers into a single, seamless filesystem.

## User Review Required

> [!IMPORTANT]
> **Technology Stack Selection**
> To support Android, iOS, Web, Windows, Linux, and macOS natively from a single codebase, we need to choose a cross-platform framework. I recommend **Flutter** as it provides the most mature support across all these platforms natively. Alternatively, we could use **React Native** or a combination of **React/Next.js + Capacitor (Mobile) + Tauri/Electron (Desktop)**. 
> 
> Please let me know your preference for the frontend framework and backend language (if any, though much of this can be handled client-side or via a lightweight Rust/Go backend for Tauri/Flutter if necessary).

> [!CAUTION]
> **Google Drive Integration & Authentication**
> Accessing Google Drive requires setting up a Google Cloud Project with the Google Drive API enabled, and configuring OAuth 2.0 credentials for each platform. We will need to set this up together.

## Open Questions

1.  **Tech Stack:** Are you comfortable proceeding with Flutter, or do you prefer a web-based stack (React + Tauri/Capacitor)?
2.  **Local Storage Access:** Web browsers have restricted access to local file systems. Do you want the Web version to only support cloud providers, or utilize the File System Access API (which has some limitations)?
3.  **Background Processing:** "Continue after internet loss" and "Pause/Resume" require robust background sync engines. This will heavily influence the state management and local database we choose (e.g., SQLite/Isar). Is this an MVP or are we building production-ready sync immediately?
4.  **Streaming:** Media streaming from Google Drive requires chunked downloading or piping streams directly. Do you have specific media types in mind (e.g., video, audio)?

## Proposed Architecture

### 1. Unified Virtual File System (VFS) Layer
An abstraction layer over the actual storage providers:
*   `StorageProvider` interface defining standard operations: `list()`, `read()`, `write()`, `copy()`, `move()`, `delete()`, `stream()`.
*   `LocalProvider`: Implements `StorageProvider` using native file APIs.
*   `GoogleDriveProvider`: Implements `StorageProvider` using Google Drive REST API.

### 2. Transfer Manager
A robust background service handling:
*   Queuing transfers.
*   Chunked uploads/downloads (essential for pause/resume and large files).
*   State persistence (saving progress to a local DB like SQLite so it can resume after app restart or network loss).

### 3. UI / Presentation
*   A responsive file explorer UI (Grid/List views).
*   Breadcrumb navigation.
*   Transfer progress panel.
*   Built-in media player for streaming content directly from the VFS.

## Proposed Implementation Phases

### Phase 1: Foundation & Local Storage
1. Initialize the project (Flutter or React+Tauri).
2. Build the basic File Explorer UI.
3. Implement the `LocalProvider` to browse, copy, and paste local files.

### Phase 2: Cloud Integration
1. Set up Google Cloud OAuth.
2. Implement the `GoogleDriveProvider`.
3. Update the UI to show a "Cloud" drive alongside "Local".

### Phase 3: The Transfer Engine
1. Implement chunked file transfers.
2. Add a persistent queue (SQLite) for pause/resume and offline recovery.
3. Integrate cross-provider transfers (Local -> Cloud, Cloud -> Local).

### Phase 4: Streaming & Polish
1. Implement file streaming from Google Drive.
2. Integrate a media player.
3. Finalize cross-platform builds and UI responsiveness.

## Verification Plan

### Automated Tests
*   Unit tests for the Virtual File System (VFS) abstractions.
*   Mocked tests for the `TransferManager` to simulate network loss and verify pause/resume logic.

### Manual Verification
*   Compile and run on Desktop (Windows/macOS) and Mobile (Android emulator).
*   Perform cross-provider copy/paste and verify data integrity.
*   Disconnect internet midway through a transfer and reconnect to verify resumption.
