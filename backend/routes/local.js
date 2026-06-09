const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf', '.txt': 'text/plain',
    '.js': 'text/javascript', '.ts': 'text/typescript',
    '.json': 'application/json', '.html': 'text/html',
    '.css': 'text/css', '.zip': 'application/zip',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return types[ext] || 'application/octet-stream';
}

function formatFileInfo(filePath, stat) {
  const name = path.basename(filePath);
  const ext = path.extname(name).toLowerCase();
  return {
    id: Buffer.from(filePath).toString('base64'),
    name,
    path: filePath,
    isDirectory: stat.isDirectory(),
    size: stat.isDirectory() ? 0 : stat.size,
    modifiedTime: stat.mtime.toISOString(),
    mimeType: stat.isDirectory() ? 'folder' : getMimeType(filePath),
    extension: ext,
  };
}

function safePath(inputPath) {
  // Normalize and verify path exists
  const normalized = path.normalize(inputPath);
  return normalized;
}

// ─── GET /local/roots — Get drives/root folders ───────────────────────────────
router.get('/roots', (req, res) => {
  try {
    const roots = [];
    // Home directory
    roots.push({ id: 'home', name: 'Home', path: os.homedir(), icon: 'home' });
    // Desktop
    const desktop = path.join(os.homedir(), 'Desktop');
    if (fs.existsSync(desktop)) roots.push({ id: 'desktop', name: 'Desktop', path: desktop, icon: 'desktop' });
    // Documents
    const docs = path.join(os.homedir(), 'Documents');
    if (fs.existsSync(docs)) roots.push({ id: 'documents', name: 'Documents', path: docs, icon: 'docs' });
    // Downloads
    const downloads = path.join(os.homedir(), 'Downloads');
    if (fs.existsSync(downloads)) roots.push({ id: 'downloads', name: 'Downloads', path: downloads, icon: 'downloads' });
    // Pictures
    const pictures = path.join(os.homedir(), 'Pictures');
    if (fs.existsSync(pictures)) roots.push({ id: 'pictures', name: 'Pictures', path: pictures, icon: 'pictures' });
    // Videos
    const videos = path.join(os.homedir(), 'Videos');
    if (fs.existsSync(videos)) roots.push({ id: 'videos', name: 'Videos', path: videos, icon: 'videos' });
    // Music
    const music = path.join(os.homedir(), 'Music');
    if (fs.existsSync(music)) roots.push({ id: 'music', name: 'Music', path: music, icon: 'music' });

    // Windows drives
    if (process.platform === 'win32') {
      const drives = ['C:', 'D:', 'E:', 'F:', 'G:'];
      drives.forEach(drive => {
        const drivePath = drive + '\\';
        try {
          fs.accessSync(drivePath);
          roots.push({ id: drive, name: drive + '\\', path: drivePath, icon: 'drive' });
        } catch {}
      });
    }
    res.json(roots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /local/list — List directory contents ────────────────────────────────
router.get('/list', (req, res) => {
  try {
    const dirPath = req.query.path ? decodeURIComponent(req.query.path) : os.homedir();
    const safe = safePath(dirPath);

    if (!fs.existsSync(safe)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const entries = fs.readdirSync(safe, { withFileTypes: true });
    const files = entries
      .filter(e => !e.name.startsWith('.') || req.query.hidden === 'true')
      .map(entry => {
        const fullPath = path.join(safe, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          return formatFileInfo(fullPath, stat);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

    res.json({ path: safe, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /local/stream — Stream a local file (media) ─────────────────────────
router.get('/stream', (req, res) => {
  try {
    const filePath = decodeURIComponent(req.query.path);
    const safe = safePath(filePath);

    if (!fs.existsSync(safe)) return res.status(404).json({ error: 'File not found' });

    const stat = fs.statSync(safe);
    const fileSize = stat.size;
    const mimeType = getMimeType(safe);
    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : Math.min(start + 10 * 1024 * 1024, fileSize - 1);
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
      });
      fs.createReadStream(safe, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(safe).pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /local/delete — Delete a file or folder ──────────────────────────
router.delete('/delete', (req, res) => {
  try {
    const filePath = decodeURIComponent(req.query.path);
    const safe = safePath(filePath);
    if (!fs.existsSync(safe)) return res.status(404).json({ error: 'Not found' });

    const stat = fs.statSync(safe);
    if (stat.isDirectory()) fs.rmSync(safe, { recursive: true });
    else fs.unlinkSync(safe);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /local/mkdir — Create a new folder ─────────────────────────────────
router.post('/mkdir', (req, res) => {
  try {
    const { parent, name } = req.body;
    const newPath = path.join(safePath(parent), name);
    fs.mkdirSync(newPath, { recursive: true });
    const stat = fs.statSync(newPath);
    res.json(formatFileInfo(newPath, stat));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /local/rename — Rename a file or folder ────────────────────────────
router.post('/rename', (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    const safe = safePath(oldPath);
    const newPath = path.join(path.dirname(safe), newName);
    fs.renameSync(safe, newPath);
    const stat = fs.statSync(newPath);
    res.json(formatFileInfo(newPath, stat));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /local/copy — Copy file or folder ──────────────────────────────────
router.post('/copy', (req, res) => {
  try {
    const { src, dest } = req.body;
    const safeSrc = safePath(src);
    const safeDest = safePath(dest);
    const destPath = path.join(safeDest, path.basename(safeSrc));

    const stat = fs.statSync(safeSrc);
    if (stat.isDirectory()) {
      fs.cpSync(safeSrc, destPath, { recursive: true });
    } else {
      fs.copyFileSync(safeSrc, destPath);
    }
    res.json({ success: true, path: destPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
