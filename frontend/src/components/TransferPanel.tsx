import React, { useRef } from 'react';
import type { Transfer } from '../types';
import { formatBytes } from '../api';

interface TransferPanelProps {
  transfers: Transfer[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const statusColor: Record<string, string> = {
  active: 'uploading',
  queued: 'uploading',
  paused: 'paused',
  completed: 'downloading',
  failed: 'paused',
};

const statusLabel: Record<string, string> = {
  queued: 'Queued',
  active: 'Transferring...',
  paused: 'Paused',
  completed: 'Done',
  failed: 'Failed',
};

export default function TransferPanel({ transfers, onPause, onResume, onRemove, onClose }: TransferPanelProps) {
  const active = transfers.filter(t => t.status !== 'completed');
  const hasActive = active.length > 0;

  return (
    <div className="transfer-panel">
      <div className="transfer-panel-header">
        <h4>
          {hasActive ? `Transfers (${active.length})` : 'Transfers'}
        </h4>
        <div style={{ display: 'flex', gap: 6 }}>
          {!hasActive && (
            <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={onClose}>
              ✕
            </button>
          )}
        </div>
      </div>

      {transfers.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No transfers
        </div>
      ) : (
        <div className="transfer-list">
          {transfers.map(t => (
            <div key={t.id} className="transfer-item">
              <div className="transfer-item-top">
                <span className="transfer-item-icon">
                  {t.type === 'upload' || t.type === 'local_to_cloud' ? '⬆️' : '⬇️'}
                </span>
                <span className="transfer-item-name" title={t.fileName}>{t.fileName}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {statusLabel[t.status] || t.status}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {t.status === 'active' && (
                    <button style={{ fontSize: 13, color: 'var(--text-muted)' }} onClick={() => onPause(t.id)}>⏸</button>
                  )}
                  {t.status === 'paused' && (
                    <button style={{ fontSize: 13, color: 'var(--accent-blue)' }} onClick={() => onResume(t.id)}>▶</button>
                  )}
                  <button style={{ fontSize: 13, color: 'var(--text-muted)' }} onClick={() => onRemove(t.id)}>✕</button>
                </div>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill ${statusColor[t.status]}`}
                  style={{ width: `${t.progress || 0}%` }}
                />
              </div>
              <div className="transfer-meta">
                <span>{t.progress || 0}%</span>
                <span>
                  {t.totalBytes ? `${formatBytes(t.transferredBytes)} / ${formatBytes(t.totalBytes)}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
