import React from 'react';
import type { FileItem } from '../types';
import { driveApi, localApi } from '../api';

interface MediaPlayerProps {
  file: FileItem;
  onClose: () => void;
}

export default function MediaPlayer({ file, onClose }: MediaPlayerProps) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const mime = file.mimeType?.toLowerCase() || '';
  const ext = (file.extension || file.name.split('.').pop() || '').toLowerCase();

  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'ogg'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav'].includes(ext);
  const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

  const src = file.provider === 'gdrive'
    ? driveApi.downloadUrl(file.id)
    : file.path
    ? localApi.streamUrl(file.path)
    : '';

  return (
    <div className="media-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="media-modal">
        <div className="media-modal-header">
          <span className="media-modal-title">
            {isVideo ? '🎬' : isAudio ? '🎵' : '🖼️'} {file.name}
          </span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="media-modal-body">
          {isVideo && (
            <video
              controls
              autoPlay
              src={src}
              style={{ maxWidth: '100%', maxHeight: '70vh' }}
            />
          )}
          {isAudio && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 80, marginBottom: 20 }}>🎵</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'var(--text-primary)' }}>
                {file.name}
              </div>
              <audio controls autoPlay src={src} style={{ width: '100%' }} />
            </div>
          )}
          {isImage && (
            <div style={{ position: 'relative', width: '100%', height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {loading && <div className="loading-spinner" style={{ position: 'absolute', zIndex: 10 }}>Loading High-Res...</div>}
              
              {/* Fast Thumbnail Preview */}
              {file.provider === 'gdrive' && (
                <img
                  src={driveApi.thumbnailUrl(file.id)}
                  alt="preview"
                  style={{
                    position: 'absolute',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    opacity: loading ? 0.5 : 0,
                    transition: 'opacity 0.3s ease',
                    filter: 'blur(4px)',
                  }}
                />
              )}

              {/* Full Resolution Image */}
              <img
                src={error && file.provider === 'gdrive' ? driveApi.thumbnailUrl(file.id) : src}
                alt={file.name}
                style={{
                  position: 'relative',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  opacity: loading ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                  zIndex: 5
                }}
                onLoad={() => setLoading(false)}
                onError={() => {
                  if (!error) {
                    setError(true);
                  } else {
                    setLoading(false);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
