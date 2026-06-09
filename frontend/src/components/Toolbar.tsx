import React, { useRef } from 'react';
import type { BreadcrumbEntry, ViewMode, Provider } from '../types';

interface ToolbarProps {
  provider: Provider;
  breadcrumbs: BreadcrumbEntry[];
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  onNavigate: (crumb: BreadcrumbEntry, index: number) => void;
  onGoBack: () => void;
  canGoBack: boolean;
  onNewFolder: () => void;
  onUpload: (files: FileList) => void;
  onRefresh: () => void;
  search: string;
  onSearch: (v: string) => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  onCopySelected: () => void;
  onCutSelected: () => void;
  canPaste: boolean;
  onPaste: () => void;
}

export default function Toolbar({
  provider, breadcrumbs, viewMode, onViewMode,
  onNavigate, onGoBack, canGoBack,
  onNewFolder, onUpload, onRefresh,
  search, onSearch,
  selectedCount, onDeleteSelected, onCopySelected, onCutSelected,
  canPaste, onPaste,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="file-toolbar">
      {/* Back button */}
      <button
        id="btn-go-back"
        className="toolbar-btn"
        onClick={onGoBack}
        disabled={!canGoBack}
        title="Go back"
      >
        ←
      </button>

      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="File path">
        <span style={{ fontSize: 13, marginRight: 4 }}>
          {provider === 'gdrive' ? '☁️' : '💻'}
        </span>
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.id}>
            <span
              id={`breadcrumb-${i}`}
              className={`breadcrumb-item ${i === breadcrumbs.length - 1 ? 'current' : ''}`}
              onClick={() => { if (i < breadcrumbs.length - 1) onNavigate(crumb, i); }}
              title={crumb.name}
            >
              {crumb.name}
            </span>
            {i < breadcrumbs.length - 1 && <span className="breadcrumb-sep">›</span>}
          </React.Fragment>
        ))}
      </nav>

      {/* Search */}
      <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
        <span className="search-icon">🔍</span>
        <input
          id="search-input"
          type="search"
          placeholder="Search files..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          aria-label="Search files"
        />
      </div>

      <div className="toolbar-right">
        {/* Selection actions */}
        {selectedCount > 0 && (
          <>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>
              {selectedCount} selected
            </span>
            <button className="toolbar-btn" onClick={onCopySelected} title="Copy" id="btn-copy-selected">📋</button>
            <button className="toolbar-btn" onClick={onCutSelected} title="Cut" id="btn-cut-selected">✂️</button>
            <button className="toolbar-btn" onClick={onDeleteSelected} title="Delete selected" id="btn-delete-selected"
              style={{ color: 'var(--accent-red)' }}>🗑️</button>
            <div className="toolbar-divider" />
          </>
        )}

        {/* Paste */}
        {canPaste && (
          <>
            <button className="toolbar-btn" onClick={onPaste} title="Paste" id="btn-paste">📥</button>
            <div className="toolbar-divider" />
          </>
        )}

        {/* Refresh */}
        <button className="toolbar-btn" onClick={onRefresh} title="Refresh" id="btn-refresh">↻</button>

        {/* New folder */}
        <button className="toolbar-btn" onClick={onNewFolder} title="New folder" id="btn-new-folder">📁+</button>

        {/* Upload */}
        <button
          className="topbar-btn primary"
          id="btn-upload"
          onClick={() => fileInputRef.current?.click()}
        >
          ↑ Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          id="file-upload-input"
          onChange={e => { if (e.target.files?.length) onUpload(e.target.files); }}
        />

        <div className="toolbar-divider" />

        {/* View mode */}
        <button
          id="btn-view-grid"
          className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => onViewMode('grid')}
          title="Grid view"
        >
          ⊞
        </button>
        <button
          id="btn-view-list"
          className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => onViewMode('list')}
          title="List view"
        >
          ☰
        </button>
      </div>
    </div>
  );
}
