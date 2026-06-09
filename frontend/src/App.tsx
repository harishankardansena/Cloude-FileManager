import React, { useState, useCallback, useEffect } from 'react';
import {
  useAuth, useDriveFiles, useLocalFiles,
  useTransfers, useClipboard, useDriveStorage,
} from './hooks/useFileManager';
import { driveApi, localApi, isStreamable, authApi, transferApi } from './api';
import type { FileItem, ViewMode, BreadcrumbEntry, Provider, LocalRoot } from './types';

import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import FileGrid from './components/FileGrid';
import ContextMenu from './components/ContextMenu';
import TransferPanel from './components/TransferPanel';
import MediaPlayer from './components/MediaPlayer';
import toast from 'react-hot-toast';

// ─── Rename Modal ─────────────────────────────────────────────────────────────
function RenameModal({ file, onConfirm, onCancel }: { file: FileItem; onConfirm: (n: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(file.name);
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <h3>Rename</h3>
        <input className="modal-input" value={name} autoFocus
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(name); if (e.key === 'Escape') onCancel(); }} />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onConfirm(name)}>Rename</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Folder Modal ─────────────────────────────────────────────────────────
function NewFolderModal({ onConfirm, onCancel }: { onConfirm: (n: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('New Folder');
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal">
        <h3>New Folder</h3>
        <input className="modal-input" value={name} autoFocus
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(name); if (e.key === 'Escape') onCancel(); }} />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onConfirm(name)}>Create</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, logout } = useAuth();
  const [localOnly, setLocalOnly] = useState(false);
  const [provider, setProvider] = useState<Provider>('local');

  // Check for OAuth redirect result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get('auth');
    if (auth === 'success') { toast.success('Signed in with Google!'); window.history.replaceState({}, '', '/'); }
    if (auth === 'error') { toast.error('Sign-in failed. Please try again.'); window.history.replaceState({}, '', '/'); }
  }, []);

  // ─── Navigation state ───────────────────────────────────────────────────────
  const [driveBreadcrumb, setDriveBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: 'root', name: 'My Drive' }]);
  const [localBreadcrumb, setLocalBreadcrumb] = useState<BreadcrumbEntry[]>([]);
  const [localPath, setLocalPath] = useState('');

  const currentDriveFolder = driveBreadcrumb[driveBreadcrumb.length - 1];

  // ─── Data hooks ─────────────────────────────────────────────────────────────
  const driveEnabled = !!user && provider === 'gdrive';
  const localEnabled = provider === 'local' && !!localPath;
  const isSharedWithMe = currentDriveFolder?.id === 'shared-with-me';

  const { files: driveFiles, loading: driveLoading, refresh: refreshDrive } = useDriveFiles(isSharedWithMe ? '' : currentDriveFolder.id, driveEnabled, isSharedWithMe);
  const { files: localFiles, loading: localLoading, refresh: refreshLocal, roots } = useLocalFiles(localPath, localEnabled);
  const quota = useDriveStorage(driveEnabled);
  const { transfers, addTransfer, pauseTransfer, resumeTransfer, removeTransfer } = useTransfers();
  const { clipboard, copy: copyFiles, cut: cutFiles, clear: clearClipboard } = useClipboard();

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [newFolderVisible, setNewFolderVisible] = useState(false);
  const [mediaFile, setMediaFile] = useState<FileItem | null>(null);
  const [showTransfers, setShowTransfers] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ─── Current files ──────────────────────────────────────────────────────────
  const rawFiles = provider === 'gdrive' ? driveFiles : localFiles;
  const isLoading = provider === 'gdrive' ? driveLoading : localLoading;
  const currentFiles = search
    ? rawFiles.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : rawFiles;

  const breadcrumbs = provider === 'gdrive' ? driveBreadcrumb : localBreadcrumb;
  const canGoBack = provider === 'gdrive' ? driveBreadcrumb.length > 1 : localBreadcrumb.length > 0;
  const activeTransferCount = transfers.filter(t => t.status !== 'completed').length;

  // ─── Selection ───────────────────────────────────────────────────────────────
  const handleSelect = useCallback((id: string, multi: boolean) => {
    setSelected(prev => {
      const next = new Set(multi ? prev : new Set<string>());
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedFiles = currentFiles.filter(f => selected.has(f.id));

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const openFile = useCallback((file: FileItem) => {
    setSelected(new Set());
    if (file.isDirectory) {
      if (file.provider === 'gdrive') {
        setDriveBreadcrumb(prev => [...prev, { id: file.id, name: file.name }]);
      } else {
        setLocalPath(file.path || '');
        setLocalBreadcrumb(prev => [...prev, { id: file.path || '', name: file.name, path: file.path }]);
      }
    } else if (isStreamable(file)) {
      setMediaFile(file);
    } else {
      handleDownload(file);
    }
  }, []);

  const navigateToBreadcrumb = useCallback((crumb: BreadcrumbEntry, index: number) => {
    setSelected(new Set());
    if (provider === 'gdrive') {
      setDriveBreadcrumb(prev => prev.slice(0, index + 1));
    } else {
      const newCrumbs = localBreadcrumb.slice(0, index + 1);
      setLocalBreadcrumb(newCrumbs);
      setLocalPath(newCrumbs[newCrumbs.length - 1].path || '');
    }
  }, [provider, localBreadcrumb]);

  const goBack = useCallback(() => {
    setSelected(new Set());
    if (provider === 'gdrive') {
      if (driveBreadcrumb.length > 1) setDriveBreadcrumb(prev => prev.slice(0, -1));
    } else {
      if (localBreadcrumb.length > 1) {
        const newCrumbs = localBreadcrumb.slice(0, -1);
        setLocalBreadcrumb(newCrumbs);
        setLocalPath(newCrumbs[newCrumbs.length - 1].path || '');
      } else {
        setLocalBreadcrumb([]);
        setLocalPath('');
      }
    }
  }, [provider, driveBreadcrumb, localBreadcrumb]);

  const handleSelectRoot = useCallback((root: LocalRoot) => {
    setLocalPath(root.path);
    setLocalBreadcrumb([{ id: root.path, name: root.name, path: root.path }]);
    setSelected(new Set());
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleDownload = useCallback((file: FileItem) => {
    const a = document.createElement('a');
    if (file.provider === 'gdrive') {
      a.href = driveApi.downloadUrl(file.id, true);
    } else if (file.path) {
      a.href = localApi.streamUrl(file.path) + '&download=1';
    }
    a.download = file.name;
    a.click();
  }, []);

  const handleDelete = useCallback(async (file: FileItem) => {
    if (!window.confirm(`Delete "${file.name}"?`)) return;
    try {
      if (file.provider === 'gdrive') await driveApi.deleteFile(file.id);
      else if (file.path) await localApi.delete(file.path);
      toast.success(`"${file.name}" deleted`);
      provider === 'gdrive' ? refreshDrive() : refreshLocal();
    } catch (err: any) { toast.error('Delete failed: ' + err.message); }
  }, [provider, refreshDrive, refreshLocal]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedFiles.length) return;
    if (!window.confirm(`Delete ${selectedFiles.length} item(s)?`)) return;
    for (const f of selectedFiles) await handleDelete(f);
    setSelected(new Set());
  }, [selectedFiles, handleDelete]);

  const handleRename = useCallback(async (file: FileItem, newName: string) => {
    setRenameFile(null);
    try {
      if (file.provider === 'gdrive') await driveApi.rename(file.id, newName);
      else if (file.path) await localApi.rename(file.path, newName);
      toast.success('Renamed');
      provider === 'gdrive' ? refreshDrive() : refreshLocal();
    } catch (err: any) { toast.error('Rename failed: ' + err.message); }
  }, [provider, refreshDrive, refreshLocal]);

  const handleNewFolder = useCallback(async (name: string) => {
    setNewFolderVisible(false);
    try {
      if (provider === 'gdrive') await driveApi.createFolder(name, currentDriveFolder.id);
      else await localApi.mkdir(localPath, name);
      toast.success(`"${name}" created`);
      provider === 'gdrive' ? refreshDrive() : refreshLocal();
    } catch (err: any) { toast.error('Failed: ' + err.message); }
  }, [provider, currentDriveFolder.id, localPath, refreshDrive, refreshLocal]);

  // ─── Upload ──────────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (fileList: FileList) => {
    const files = Array.from(fileList);
    for (const file of files) {
      const t = await addTransfer({ type: provider === 'gdrive' ? 'upload' : 'local_copy', fileName: file.name, totalBytes: file.size, status: 'active' } as any);
      setShowTransfers(true);
      const tid = (t as any).id;
      try {
        if (provider === 'gdrive') {
          await driveApi.upload(file, currentDriveFolder.id, async (p) => {
            const bytes = Math.round((p / 100) * file.size);
            await transferApi.updateProgress(tid, bytes);
          });
          await transferApi.updateProgress(tid, file.size, 'completed');
          refreshDrive();
        } else {
          toast('Local upload coming soon — use drag & drop via OS for now', { icon: 'ℹ️' });
          await transferApi.updateProgress(tid, 0, 'failed');
        }
      } catch (err: any) {
        toast.error(`Upload failed: ${err.message}`);
        await transferApi.updateProgress(tid, 0, 'failed');
      }
    }
  }, [provider, currentDriveFolder.id, addTransfer, refreshDrive]);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, file });
    if (!selected.has(file.id)) setSelected(new Set([file.id]));
  }, [selected]);

  // ─── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  };

  const refresh = useCallback(() => provider === 'gdrive' ? refreshDrive() : refreshLocal(), [provider, refreshDrive, refreshLocal]);

  // ─── Paste ───────────────────────────────────────────────────────────────────
  const handlePaste = useCallback(async () => {
    if (!clipboard || !clipboard.files.length) return;

    const sourceProvider = clipboard.files[0].provider;
    const destProvider = provider;
    const destId = destProvider === 'gdrive' ? currentDriveFolder.id : localPath;

    let successCount = 0;

    for (const file of clipboard.files) {
      const type = destProvider === 'gdrive' ? 'upload' : 'download';
      const t = await addTransfer({ type, fileName: file.name, totalBytes: file.size, status: 'active' } as any);
      setShowTransfers(true);
      const tid = (t as any).id;

      try {
        if (sourceProvider === 'local' && destProvider === 'local') {
          await localApi.copy(file.path!, `${destId}\\${file.name}`);
        } else if (sourceProvider === 'gdrive' && destProvider === 'gdrive') {
          await driveApi.copy(file.id, destId);
        } else if (sourceProvider === 'local' && destProvider === 'gdrive') {
          await driveApi.copyFromLocal(file.path!, destId);
        } else if (sourceProvider === 'gdrive' && destProvider === 'local') {
          await driveApi.copyToLocal(file.id, destId);
        }

        await transferApi.updateProgress(tid, file.size, 'completed');
        successCount++;

        if (clipboard.action === 'cut') {
          if (sourceProvider === 'gdrive') await driveApi.deleteFile(file.id);
          else if (sourceProvider === 'local') await localApi.delete(file.path!);
        }
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message;
        toast.error(`Failed to paste ${file.name}: ${msg}`);
        await transferApi.updateProgress(tid, 0, 'failed');
      }
    }

    if (successCount > 0 && clipboard.action === 'cut') {
      clearClipboard();
    }

    refresh();
  }, [clipboard, provider, currentDriveFolder.id, localPath, addTransfer, clearClipboard, refresh]);

  // ─── Auth loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading-area" style={{ height: '100vh' }}>
        <div className="spinner" />
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading Cloude…</span>
      </div>
    );
  }

  if (!user && !localOnly) {
    return <AuthPage onLocalOnly={() => { setLocalOnly(true); setProvider('local'); }} />;
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="app-layout" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

        {/* ── Topbar ─────────────────────────────────────────────────────────── */}
        <header className="topbar">
          <div className="topbar-logo">
            <div className="logo-icon">☁️</div>
            <span>Cloude</span>
          </div>
          <div className="topbar-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {activeTransferCount > 0 && (
              <button className="topbar-btn" id="btn-topbar-transfers" onClick={() => setShowTransfers(v => !v)}>
                ⚡ {activeTransferCount} transfer{activeTransferCount > 1 ? 's' : ''}
              </button>
            )}
            {user ? (
              <>
                {user.avatar
                  ? <img src={user.avatar} className="user-avatar" alt={user.name} title={user.email} />
                  : <div className="user-avatar-placeholder" title={user.email}>{user.name?.[0]?.toUpperCase()}</div>
                }
                <button className="topbar-btn" id="btn-signout-top" onClick={logout}>Sign out</button>
              </>
            ) : (
              <a href={authApi.googleLoginUrl} className="topbar-btn primary" id="btn-signin-top">
                Sign in with Google
              </a>
            )}
          </div>
        </header>

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <Sidebar
          user={user}
          provider={provider}
          localPath={localPath}
          localRoots={roots}
          quota={quota}
          onSelectProvider={p => {
            setProvider(p);
            setSelected(new Set());
            if (p === 'gdrive') setDriveBreadcrumb([{ id: 'root', name: 'My Drive' }]);
          }}
          isSharedWithMe={isSharedWithMe}
          onSelectSharedWithMe={() => {
            setProvider('gdrive');
            setSelected(new Set());
            setDriveBreadcrumb([{ id: 'shared-with-me', name: 'Shared with me' }]);
          }}
          onSelectLocalRoot={handleSelectRoot}
          onLogout={logout}
          transferCount={activeTransferCount}
          onShowTransfers={() => setShowTransfers(v => !v)}
        />

        {/* ── Main Content ───────────────────────────────────────────────────── */}
        <main className="main-content">
          <Toolbar
            provider={provider}
            breadcrumbs={breadcrumbs}
            viewMode={viewMode}
            onViewMode={setViewMode}
            onNavigate={navigateToBreadcrumb}
            onGoBack={goBack}
            canGoBack={canGoBack}
            onNewFolder={() => setNewFolderVisible(true)}
            onUpload={handleUpload}
            onRefresh={refresh}
            search={search}
            onSearch={setSearch}
            selectedCount={selected.size}
            onDeleteSelected={handleDeleteSelected}
            onCopySelected={() => copyFiles(selectedFiles)}
            onCutSelected={() => cutFiles(selectedFiles)}
            canPaste={!!clipboard}
            onPaste={handlePaste}
          />

          <div className="file-area" id="file-area">
            {isLoading ? (
              <div className="loading-area"><div className="spinner" /><span>Loading…</span></div>
            ) : provider === 'local' && !localPath ? (
              /* Local root picker */
              <div className="file-grid">
                {roots.map(root => (
                  <div key={root.id} className="file-card animate-in" onClick={() => handleSelectRoot(root)}>
                    <span className="file-card-icon">
                      {{ home: '🏠', desktop: '🖥️', documents: '📄', downloads: '⬇️', pictures: '🖼️', videos: '🎬', music: '🎵', drive: '💾' }[root.icon] || '📁'}
                    </span>
                    <span className="file-card-name">{root.name}</span>
                    <span className="file-card-meta" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{root.path}</span>
                  </div>
                ))}
              </div>
            ) : currentFiles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h3>{search ? 'No results' : 'Empty folder'}</h3>
                <p>{search ? `Nothing matching "${search}"` : 'Drop files here or click Upload'}</p>
              </div>
            ) : (
              <FileGrid
                files={currentFiles}
                viewMode={viewMode}
                selected={selected}
                onSelect={handleSelect}
                onOpen={openFile}
                onContextMenu={handleContextMenu}
              />
            )}
          </div>
        </main>
      </div>

      {/* ── Context Menu ─────────────────────────────────────────────────────── */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y} file={ctxMenu.file}
          onClose={() => setCtxMenu(null)}
          onOpen={() => openFile(ctxMenu.file)}
          onDownload={() => handleDownload(ctxMenu.file)}
          onRename={() => setRenameFile(ctxMenu.file)}
          onDelete={() => handleDelete(ctxMenu.file)}
          onCopy={() => copyFiles([ctxMenu.file])}
          onCut={() => cutFiles([ctxMenu.file])}
          canPaste={!!clipboard}
          onPaste={handlePaste}
          onPreview={() => setMediaFile(ctxMenu.file)}
          canPreview={isStreamable(ctxMenu.file)}
        />
      )}

      {/* ── Rename Modal ─────────────────────────────────────────────────────── */}
      {renameFile && (
        <RenameModal file={renameFile} onConfirm={n => handleRename(renameFile, n)} onCancel={() => setRenameFile(null)} />
      )}

      {/* ── New Folder Modal ──────────────────────────────────────────────────── */}
      {newFolderVisible && (
        <NewFolderModal onConfirm={handleNewFolder} onCancel={() => setNewFolderVisible(false)} />
      )}

      {/* ── Media Player ─────────────────────────────────────────────────────── */}
      {mediaFile && <MediaPlayer file={mediaFile} onClose={() => setMediaFile(null)} />}

      {/* ── Transfer Panel ───────────────────────────────────────────────────── */}
      {showTransfers && (
        <TransferPanel
          transfers={transfers}
          onPause={pauseTransfer}
          onResume={resumeTransfer}
          onRemove={removeTransfer}
          onClose={() => setShowTransfers(false)}
        />
      )}

      {/* ── Drag Overlay ─────────────────────────────────────────────────────── */}
      {dragOver && (
        <div className="drag-overlay">
          <div className="drag-overlay-content">
            <div className="drag-icon">⬆️</div>
            <h3>Drop to upload</h3>
          </div>
        </div>
      )}
    </>
  );
}
