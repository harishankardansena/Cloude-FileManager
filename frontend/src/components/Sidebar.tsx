import React from 'react';
import type { User, LocalRoot, StorageQuota, Provider } from '../types';

interface SidebarProps {
  user: User | null;
  provider: Provider;
  localPath: string;
  localRoots: LocalRoot[];
  quota: StorageQuota | null;
  onSelectProvider: (p: Provider) => void;
  onSelectLocalRoot: (root: LocalRoot) => void;
  onLogout: () => void;
  transferCount: number;
  onShowTransfers: () => void;
  isSharedWithMe?: boolean;
  onSelectSharedWithMe?: () => void;
}

function formatStorageBytes(bytes: string | number): string {
  const n = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (!n) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const localRootIcons: Record<string, string> = {
  home: '🏠',
  desktop: '🖥️',
  documents: '📄',
  downloads: '⬇️',
  pictures: '🖼️',
  videos: '🎬',
  music: '🎵',
  drive: '💾',
};

export default function Sidebar({
  user, provider, localPath, localRoots, quota,
  onSelectProvider, onSelectLocalRoot, onLogout,
  transferCount, onShowTransfers,
  isSharedWithMe, onSelectSharedWithMe,
}: SidebarProps) {
  const usedPercent = quota
    ? Math.min(100, (parseInt(quota.usage, 10) / parseInt(quota.limit, 10)) * 100)
    : 0;

  return (
    <aside className="sidebar">
      {/* ── Sections ── */}

      {/* Local Storage */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Local</span>
        </div>
        {localRoots.map(root => (
          <div
            key={root.id}
            id={`sidebar-local-${root.id}`}
            className={`sidebar-item ${provider === 'local' && localPath === root.path ? 'active' : ''}`}
            onClick={() => { onSelectProvider('local'); onSelectLocalRoot(root); }}
          >
            <span className="item-icon">{localRootIcons[root.icon] || '📁'}</span>
            <span className="item-name">{root.name}</span>
          </div>
        ))}
      </div>

      {/* Cloud */}
      {user && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Cloud</span>
          </div>
          <div
            id="sidebar-gdrive"
            className={`sidebar-item ${provider === 'gdrive' && !isSharedWithMe ? 'active' : ''}`}
            onClick={() => onSelectProvider('gdrive')}
          >
            <span className="item-icon">☁️</span>
            <span className="item-name">Google Drive</span>
          </div>
          {onSelectSharedWithMe && (
            <div
              id="sidebar-gdrive-shared"
              className={`sidebar-item ${provider === 'gdrive' && isSharedWithMe ? 'active' : ''}`}
              onClick={onSelectSharedWithMe}
            >
              <span className="item-icon">👥</span>
              <span className="item-name">Shared with me</span>
            </div>
          )}
        </div>
      )}

      {/* Transfers */}
      <div className="sidebar-section">
        <div className="sidebar-section-header"><span>Activity</span></div>
        <div
          id="sidebar-transfers"
          className="sidebar-item"
          onClick={onShowTransfers}
        >
          <span className="item-icon">⚡</span>
          <span className="item-name">Transfers</span>
          {transferCount > 0 && (
            <span style={{
              marginLeft: 'auto',
              background: 'var(--accent-blue)',
              color: 'white',
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 99,
              lineHeight: 1.8,
            }}>{transferCount}</span>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Drive Storage */}
      {user && quota && (
        <div className="sidebar-storage">
          <div className="storage-label">
            Google Drive storage
          </div>
          <div className="storage-bar-track">
            <div className="storage-bar-fill" style={{ width: `${usedPercent}%` }} />
          </div>
          <div className="storage-text">
            {formatStorageBytes(quota.usage)} of {formatStorageBytes(quota.limit)} used
          </div>
        </div>
      )}

      {/* User info */}
      {user ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderTop: '1px solid var(--border)',
        }}>
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="user-avatar" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          ) : (
            <div className="user-avatar-placeholder" style={{ width: 32, height: 32, fontSize: 13 }}>
              {user.name?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
          <button
            id="btn-logout"
            title="Sign out"
            onClick={onLogout}
            style={{ color: 'var(--text-muted)', fontSize: 16, padding: 4, borderRadius: 6, transition: 'color 120ms ease' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ↩
          </button>
        </div>
      ) : (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <a href="/auth/google">
            <button className="topbar-btn primary" style={{ width: '100%', justifyContent: 'center' }} id="btn-sign-in-sidebar">
              Sign in with Google
            </button>
          </a>
        </div>
      )}
    </aside>
  );
}
