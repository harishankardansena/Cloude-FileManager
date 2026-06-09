import axios from 'axios';
import type { FileItem, LocalRoot, StorageQuota, Transfer } from './types';

const api = axios.create({ baseURL: '/', withCredentials: true });

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  me: () => api.get('/auth/me').then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
  googleLoginUrl: '/auth/google',
};

// ─── Google Drive ─────────────────────────────────────────────────────────────
export const driveApi = {
  list: (folderId = 'root', sharedWithMe = false, pageToken?: string, search?: string) => {
    let url = `/drive/list?folderId=${folderId}`;
    if (sharedWithMe) url += `&sharedWithMe=true`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return api.get<{ files: any[]; nextPageToken: string | null }>(url).then(r => ({
      files: r.data.files.map(f => normalizeGdriveFile(f)),
      nextPageToken: r.data.nextPageToken,
    }));
  },

  getFile: (id: string) => api.get(`/drive/file/${id}`).then(r => r.data),

  downloadUrl: (id: string, download = false) => `/drive/download/${id}${download ? '?download=1' : ''}`,
  
  thumbnailUrl: (id: string) => `/drive/thumbnail/${id}`,

  upload: (file: File, folderId = 'root', onProgress?: (p: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    form.append('folderId', folderId);
    return api.post('/drive/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }).then(r => normalizeGdriveFile(r.data));
  },

  createFolder: (name: string, parentId = 'root') =>
    api.post('/drive/folder', { name, parentId }).then(r => normalizeGdriveFile(r.data)),

  deleteFile: (id: string) => api.delete(`/drive/file/${id}`).then(r => r.data),

  rename: (id: string, name: string) =>
    api.patch(`/drive/rename/${id}`, { name }).then(r => r.data),

  move: (id: string, newParentId: string, oldParentId: string) =>
    api.post(`/drive/move/${id}`, { newParentId, oldParentId }).then(r => r.data),

  storage: () => api.get<StorageQuota>('/drive/storage').then(r => r.data),

  copyFromLocal: (localPath: string, folderId: string) =>
    api.post('/drive/copy-from-local', { localPath, folderId }).then(r => normalizeGdriveFile(r.data)),

  copyToLocal: (fileId: string, destDir: string) =>
    api.post('/drive/copy-to-local', { fileId, destDir }).then(r => r.data),

  copy: (fileId: string, folderId: string) =>
    api.post('/drive/copy', { fileId, folderId }).then(r => normalizeGdriveFile(r.data)),
};

// ─── Local Files ──────────────────────────────────────────────────────────────
export const localApi = {
  roots: () => api.get<LocalRoot[]>('/local/roots').then(r => r.data),

  list: (path: string) =>
    api.get<{ path: string; files: any[] }>('/local/list', {
      params: { path: encodeURIComponent(path) },
    }).then(r => ({
      path: r.data.path,
      files: r.data.files.map(f => normalizeLocalFile(f)),
    })),

  streamUrl: (path: string) => `/local/stream?path=${encodeURIComponent(path)}`,

  delete: (path: string) =>
    api.delete('/local/delete', { params: { path: encodeURIComponent(path) } }).then(r => r.data),

  mkdir: (parent: string, name: string) =>
    api.post('/local/mkdir', { parent, name }).then(r => normalizeLocalFile(r.data)),

  rename: (oldPath: string, newName: string) =>
    api.post('/local/rename', { oldPath, newName }).then(r => normalizeLocalFile(r.data)),

  copy: (src: string, dest: string) =>
    api.post('/local/copy', { src, dest }).then(r => r.data),
};

// ─── Transfers ────────────────────────────────────────────────────────────────
export const transferApi = {
  list: () => api.get<Transfer[]>('/transfer/list').then(r => r.data),
  create: (data: Partial<Transfer>) => api.post('/transfer/create', data).then(r => r.data),
  pause: (id: string) => api.patch(`/transfer/${id}/pause`).then(r => r.data),
  resume: (id: string) => api.patch(`/transfer/${id}/resume`).then(r => r.data),
  remove: (id: string) => api.delete(`/transfer/${id}`).then(r => r.data),
  updateProgress: (id: string, transferredBytes: number, status?: string) => 
    api.patch(`/transfer/${id}/progress`, { transferredBytes, status }).then(r => r.data),
};

// ─── Normalizers ─────────────────────────────────────────────────────────────
function normalizeGdriveFile(f: any): FileItem {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    isDirectory: f.mimeType === 'application/vnd.google-apps.folder',
    size: parseInt(f.size || '0', 10),
    modifiedTime: f.modifiedTime,
    thumbnailLink: f.thumbnailLink,
    webViewLink: f.webViewLink,
    parents: f.parents,
    provider: 'gdrive',
  };
}

function normalizeLocalFile(f: any): FileItem {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    isDirectory: f.isDirectory,
    size: f.size || 0,
    modifiedTime: f.modifiedTime,
    path: f.path,
    extension: f.extension,
    provider: 'local',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getFileIcon(file: FileItem): string {
  if (file.isDirectory) return '📁';
  const mime = file.mimeType?.toLowerCase() || '';
  const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase();

  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime === 'application/pdf') return '📕';
  if (mime.includes('spreadsheet') || ext === 'xlsx' || ext === 'csv') return '📊';
  if (mime.includes('presentation') || ext === 'pptx') return '📊';
  if (mime.includes('document') || ext === 'docx' || ext === 'doc') return '📝';
  if (ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar') return '🗜️';
  if (ext === 'js' || ext === 'ts' || ext === 'jsx' || ext === 'tsx') return '⚡';
  if (ext === 'py') return '🐍';
  if (ext === 'html' || ext === 'css') return '🌐';
  if (ext === 'json') return '📋';
  if (ext === 'md') return '📄';
  if (mime.includes('google-apps.folder')) return '📁';
  if (mime.includes('google-apps')) return '📄';
  return '📄';
}

export function isStreamable(file: FileItem): boolean {
  const mime = file.mimeType?.toLowerCase() || '';
  return mime.startsWith('video/') || mime.startsWith('audio/') || mime.startsWith('image/');
}
