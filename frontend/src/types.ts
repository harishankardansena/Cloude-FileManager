// ─── Shared Types ────────────────────────────────────────────────────────────

export type Provider = 'local' | 'gdrive';
export type ViewMode = 'grid' | 'list';

export interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  isDirectory: boolean;
  size: number;
  modifiedTime: string;
  path?: string;         // local only
  thumbnailLink?: string; // gdrive only
  webViewLink?: string;  // gdrive only
  parents?: string[];    // gdrive only
  extension?: string;
  provider: Provider;
}

export interface BreadcrumbEntry {
  id: string;
  name: string;
  path?: string;
}

export interface Transfer {
  id: string;
  type: 'upload' | 'download' | 'local_copy' | 'local_to_cloud' | 'cloud_to_local';
  status: 'queued' | 'active' | 'paused' | 'completed' | 'failed';
  fileName: string;
  totalBytes: number;
  transferredBytes: number;
  progress: number;
  error?: string;
  createdAt: string;
}

export interface User {
  _id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface StorageQuota {
  limit: string;
  usage: string;
  usageInDrive: string;
}

export interface LocalRoot {
  id: string;
  name: string;
  path: string;
  icon: string;
}
