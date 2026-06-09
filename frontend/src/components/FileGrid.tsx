import React from 'react';
import { getFileIcon, formatBytes, formatDate, localApi, driveApi } from '../api';
import type { FileItem, ViewMode } from '../types';

interface FileGridProps {
  files: FileItem[];
  viewMode: ViewMode;
  selected: Set<string>;
  onSelect: (id: string, multi: boolean) => void;
  onOpen: (file: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
}

function FileCardThumb({ file }: { file: FileItem }) {
  const [errorCount, setErrorCount] = React.useState(0);
  
  if (errorCount >= 2 || (errorCount >= 1 && file.provider !== 'gdrive')) {
    return <span className="file-card-icon">{getFileIcon(file)}</span>;
  }

  const isImg = !file.isDirectory && (file.mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((file.extension || file.name.split('.').pop() || '').toLowerCase()));
  
  let src = '';
  
  if (isImg) {
    if (file.provider === 'local' && file.path) {
      src = localApi.streamUrl(file.path);
    } else if (file.provider === 'gdrive') {
      if (errorCount === 0 && file.thumbnailLink) {
        src = file.thumbnailLink;
      } else {
        // Fallback to fresh backend thumbnail
        src = driveApi.thumbnailUrl(file.id);
      }
    }
  }

  if (src) {
    return (
      <img
        src={src}
        alt={file.name}
        className="file-card-thumb"
        onError={() => setErrorCount(prev => prev + 1)}
      />
    );
  }

  return <span className="file-card-icon">{getFileIcon(file)}</span>;
}

export default function FileGrid({ files, viewMode, selected, onSelect, onOpen, onContextMenu }: FileGridProps) {
  if (viewMode === 'grid') {
    return (
      <div className="file-grid">
        {files.map(file => (
          <div
            key={file.id}
            className={`file-card animate-in ${selected.has(file.id) ? 'selected' : ''}`}
            onClick={e => onSelect(file.id, e.ctrlKey || e.metaKey)}
            onDoubleClick={() => onOpen(file)}
            onContextMenu={e => onContextMenu(e, file)}
          >
            <FileCardThumb file={file} />
            <span className="file-card-name" title={file.name}>{file.name}</span>
            {!file.isDirectory && (
              <span className="file-card-meta">{formatBytes(file.size)}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="file-list">
      <div className="file-row-header">
        <span></span>
        <span>Name</span>
        <span style={{ textAlign: 'right' }}>Modified</span>
        <span style={{ textAlign: 'right' }}>Size</span>
        <span></span>
      </div>
      {files.map(file => (
        <div
          key={file.id}
          className={`file-row animate-in ${selected.has(file.id) ? 'selected' : ''}`}
          onClick={e => onSelect(file.id, e.ctrlKey || e.metaKey)}
          onDoubleClick={() => onOpen(file)}
          onContextMenu={e => onContextMenu(e, file)}
        >
          <span className="file-row-icon">{getFileIcon(file)}</span>
          <span className="file-row-name" title={file.name}>{file.name}</span>
          <span className="file-row-meta">{formatDate(file.modifiedTime)}</span>
          <span className="file-row-meta">{file.isDirectory ? '—' : formatBytes(file.size)}</span>
          <span></span>
        </div>
      ))}
    </div>
  );
}
