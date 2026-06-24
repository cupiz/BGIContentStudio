# BGI Content Studio - TODOS

This document captures features and enhancements that were deferred during development and plan reviews.

## Backlog

### [T3] Open File Location Button for Saved Google Drive Images
- **What**: Add an "Open File Location" button or folder icon next to the "Saved to Google Drive" status badge in the UI.
- **Why**: Allows content creators to quickly open their local file manager (Windows Explorer/macOS Finder) directly to the folder containing their saved images to verify their files.
- **Pros**: 
  - Frictionless workflow validation.
  - Improves user trust by immediately showing the file on disk.
- **Cons**: 
  - Requires exposing the Electron `shell.showItemInFolder` API in the preload script.
- **Context**: 
  - Surfaced during the `/plan-eng-review` for the Google Drive saving feature (Decision D3).
  - The frontend `ImageGenerator.jsx` should receive the absolute file path from the `save-image-to-drive` IPC handler result (which already returns `{ success: true, path: targetPath }`).
  - Next to the success text `✅ Slide X berhasil disimpan ke: ...`, we should render a small icon or button that invokes `window.electronAPI.openFileLocation(path)`.
- **Depends on / blocked by**: Mapped directory saving feature (implemented).
