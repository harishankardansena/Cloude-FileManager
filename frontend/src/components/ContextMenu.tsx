import React, { useEffect, useRef } from 'react';
import type { FileItem } from '../types';

interface ContextMenuProps {
  x: number;
  y: number;
  file: FileItem;
  onClose: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPreview?: () => void;
  canPreview: boolean;
  canPaste: boolean;
  onPaste: () => void;
}

export default function ContextMenu({
  x, y, file, onClose, onOpen, onDownload, onRename, onDelete, onCopy, onCut, onPreview, canPreview, canPaste, onPaste,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  // Adjust position if off-screen
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 280),
  };

  const act = (fn: () => void) => { fn(); onClose(); };

  return (
    <div className="context-menu" style={style} ref={ref}>
      <div className="ctx-item" onClick={() => act(onOpen)}>
        <span className="ctx-icon">{file.isDirectory ? '📂' : '👁️'}</span>
        {file.isDirectory ? 'Open' : 'Open'}
      </div>

      {canPreview && (
        <div className="ctx-item" onClick={() => act(onPreview!)}>
          <span className="ctx-icon">▶️</span>
          Preview
        </div>
      )}

      {!file.isDirectory && (
        <div className="ctx-item" onClick={() => act(onDownload)}>
          <span className="ctx-icon">⬇️</span>
          Download
        </div>
      )}

      <div className="ctx-separator" />

      <div className="ctx-item" onClick={() => act(onCopy)}>
        <span className="ctx-icon">📋</span>
        Copy
      </div>
      <div className="ctx-item" onClick={() => act(onCut)}>
        <span className="ctx-icon">✂️</span>
        Cut
      </div>
      {canPaste && (
        <div className="ctx-item" onClick={() => act(onPaste)}>
          <span className="ctx-icon">📥</span>
          Paste
        </div>
      )}

      <div className="ctx-separator" />

      <div className="ctx-item" onClick={() => act(onRename)}>
        <span className="ctx-icon">✏️</span>
        Rename
      </div>
      <div className="ctx-item danger" onClick={() => act(onDelete)}>
        <span className="ctx-icon">🗑️</span>
        Delete
      </div>
    </div>
  );
}
