import { useState, useEffect, useCallback } from 'react';
import { authApi, driveApi, localApi, transferApi } from '../api';
import type { FileItem, User, BreadcrumbEntry, Transfer, StorageQuota, LocalRoot, Provider } from '../types';
import toast from 'react-hot-toast';

// ─── useAuth ─────────────────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(d => setUser(d.authenticated ? d.user : null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    toast.success('Signed out');
  }, []);

  return { user, loading, logout, setUser };
}

// ─── useDriveFiles ────────────────────────────────────────────────────────────
export function useDriveFiles(folderId: string, enabled: boolean, sharedWithMe = false) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const result = await driveApi.list(folderId, sharedWithMe);
      setFiles(result.files);
      setNextPageToken(result.nextPageToken);
    } catch (err: any) {
      toast.error('Failed to load Drive files: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [folderId, enabled, sharedWithMe]);

  useEffect(() => { load(); }, [load]);

  return { files, loading, refresh: load, nextPageToken };
}

// ─── useLocalFiles ────────────────────────────────────────────────────────────
export function useLocalFiles(path: string, enabled: boolean) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [roots, setRoots] = useState<LocalRoot[]>([]);

  useEffect(() => {
    localApi.roots().then(setRoots).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!enabled || !path) return;
    setLoading(true);
    try {
      const result = await localApi.list(path);
      setFiles(result.files);
    } catch (err: any) {
      toast.error('Failed to list folder: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [path, enabled]);

  useEffect(() => { load(); }, [load]);

  return { files, loading, refresh: load, roots };
}

// ─── useDriveStorage ─────────────────────────────────────────────────────────
export function useDriveStorage(enabled: boolean) {
  const [quota, setQuota] = useState<StorageQuota | null>(null);

  useEffect(() => {
    if (!enabled) return;
    driveApi.storage().then(setQuota).catch(() => {});
  }, [enabled]);

  return quota;
}

// ─── useTransfers ─────────────────────────────────────────────────────────────
export function useTransfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  const refresh = useCallback(() => {
    transferApi.list().then(setTransfers).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const addTransfer = useCallback(async (data: Partial<Transfer>) => {
    const t = await transferApi.create(data);
    refresh();
    return t;
  }, [refresh]);

  const pauseTransfer = useCallback(async (id: string) => {
    await transferApi.pause(id);
    refresh();
  }, [refresh]);

  const resumeTransfer = useCallback(async (id: string) => {
    await transferApi.resume(id);
    refresh();
  }, [refresh]);

  const removeTransfer = useCallback(async (id: string) => {
    await transferApi.remove(id);
    refresh();
  }, [refresh]);

  return { transfers, addTransfer, pauseTransfer, resumeTransfer, removeTransfer, refresh };
}

// ─── useClipboard ─────────────────────────────────────────────────────────────
export function useClipboard() {
  const [clipboard, setClipboard] = useState<{ files: FileItem[]; action: 'copy' | 'cut' } | null>(null);

  const copy = useCallback((files: FileItem[]) => {
    setClipboard({ files, action: 'copy' });
    toast.success(`${files.length} item(s) copied`);
  }, []);

  const cut = useCallback((files: FileItem[]) => {
    setClipboard({ files, action: 'cut' });
    toast.success(`${files.length} item(s) cut`);
  }, []);

  const clear = useCallback(() => setClipboard(null), []);

  return { clipboard, copy, cut, clear };
}
