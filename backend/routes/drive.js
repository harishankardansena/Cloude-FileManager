const express = require('express');
const { google } = require('googleapis');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const router = express.Router();

// ─── In-memory users ref (same store used by auth.js) ────────────────────────
// We require auth.js indirectly — read tokens from session.userTokens as fallback
function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_WEB_CLIENT_SECRET,
      'http://localhost:5000/auth/callback'
    );

    let tokens;

    if (isMongoReady()) {
      const user = await User.findById(req.session.userId);
      if (!user) return res.status(401).json({ error: 'User not found' });
      tokens = user.googleTokens;
      oauth2Client.setCredentials(tokens);
      // Auto-refresh if expired
      if (user.isTokenExpired()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        user.googleTokens = credentials;
        await user.save();
        oauth2Client.setCredentials(credentials);
      }
      req.user = user;
    } else {
      // Fallback: use tokens stored in session
      tokens = req.session.userTokens;
      if (!tokens) return res.status(401).json({ error: 'No tokens in session' });
      oauth2Client.setCredentials(tokens);
    }

    req.oauth2Client = oauth2Client;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Auth failed: ' + err.message });
  }
}


// ─── GET /drive/list — List files in a folder ────────────────────────────────
router.get('/list', requireAuth, async (req, res) => {
  try {
    const { folderId = 'root', pageToken, search, sharedWithMe } = req.query;
    const drive = google.drive({
      version: 'v3',
      auth: req.oauth2Client,
      key: process.env.GOOGLE_API_KEY,
    });

    let q = `'${folderId}' in parents and trashed = false`;
    if (sharedWithMe === 'true') {
      q = `sharedWithMe = true and trashed = false`;
    }
    if (search) q = `name contains '${search}' and trashed = false`;

    const response = await drive.files.list({
      q,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, thumbnailLink, webViewLink, webContentLink, parents, starred)',
      orderBy: 'folder,name',
      pageSize: 100,
      pageToken: pageToken || undefined,
    });

    res.json({
      files: response.data.files,
      nextPageToken: response.data.nextPageToken || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /drive/file/:id — Get file metadata ─────────────────────────────────
router.get('/file/:id', requireAuth, async (req, res) => {
  try {
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    const response = await drive.files.get({
      fileId: req.params.id,
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, parents',
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /drive/download/:id — Download/Stream a file ────────────────────────
router.get('/download/:id', requireAuth, async (req, res) => {
  try {
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });

    // Get file metadata first
    const meta = await drive.files.get({
      fileId: req.params.id,
      fields: 'name, mimeType, size',
    });
    const { name, mimeType, size } = meta.data;

    // Handle Google Docs export
    const isGoogleDoc = mimeType.startsWith('application/vnd.google-apps');
    if (isGoogleDoc) {
      const exportMime = mimeType.includes('spreadsheet')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : mimeType.includes('presentation')
        ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'application/pdf';

      const response = await drive.files.export(
        { fileId: req.params.id, mimeType: exportMime },
        { responseType: 'stream' }
      );
      const disposition = req.query.download ? 'attachment' : 'inline';
      res.setHeader('Content-Disposition', `${disposition}; filename="${name}"`);
      res.setHeader('Content-Type', exportMime);
      return response.data.pipe(res);
    }

    // Handle Range requests for streaming media
    const rangeHeader = req.headers.range;
    if (rangeHeader && size) {
      const fileSize = parseInt(size);
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : Math.min(start + 10 * 1024 * 1024, fileSize - 1);

      const response = await drive.files.get(
        { fileId: req.params.id, alt: 'media' },
        {
          responseType: 'stream',
          headers: { Range: `bytes=${start}-${end}` },
        }
      );
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': mimeType,
      });
      return response.data.pipe(res);
    }

    // Regular download
    const response = await drive.files.get(
      { fileId: req.params.id, alt: 'media' },
      { responseType: 'stream' }
    );
    const disposition = req.query.download ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${name}"`);
    res.setHeader('Content-Type', mimeType);
    if (size) res.setHeader('Content-Length', size);
    response.data.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /drive/thumbnail/:id — Get fresh thumbnail ──────────────────────────
router.get('/thumbnail/:id', requireAuth, async (req, res) => {
  try {
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    const response = await drive.files.get({
      fileId: req.params.id,
      fields: 'thumbnailLink',
    });
    if (response.data.thumbnailLink) {
      const axios = require('axios');
      const imageRes = await axios.get(response.data.thumbnailLink, { responseType: 'stream' });
      res.setHeader('Content-Type', imageRes.headers['content-type'] || 'image/jpeg');
      imageRes.data.pipe(res);
    } else {
      res.status(404).json({ error: 'Thumbnail not available' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /drive/upload — Upload a file ──────────────────────────────────────
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    const { folderId = 'root' } = req.body;

    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(req.file.buffer);
    stream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: req.file.originalname,
        parents: [folderId],
      },
      media: {
        mimeType: req.file.mimetype,
        body: stream,
      },
      fields: 'id, name, mimeType, size, modifiedTime',
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /drive/folder — Create folder ──────────────────────────────────────
router.post('/folder', requireAuth, async (req, res) => {
  try {
    const { name, parentId = 'root' } = req.body;
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id, name, mimeType, modifiedTime',
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /drive/file/:id — Trash a file ───────────────────────────────────
router.delete('/file/:id', requireAuth, async (req, res) => {
  try {
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    await drive.files.update({
      fileId: req.params.id,
      requestBody: { trashed: true },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /drive/rename/:id — Rename file ───────────────────────────────────
router.patch('/rename/:id', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    const response = await drive.files.update({
      fileId: req.params.id,
      requestBody: { name },
      fields: 'id, name',
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /drive/move/:id — Move file to folder ───────────────────────────────
router.post('/move/:id', requireAuth, async (req, res) => {
  try {
    const { newParentId, oldParentId } = req.body;
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    const response = await drive.files.update({
      fileId: req.params.id,
      addParents: newParentId,
      removeParents: oldParentId,
      fields: 'id, parents',
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /drive/storage — Storage quota ──────────────────────────────────────
router.get('/storage', requireAuth, async (req, res) => {
  try {
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    const response = await drive.about.get({ fields: 'storageQuota' });
    res.json(response.data.storageQuota);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /drive/copy-from-local ──────────────────────────────────────────────
router.post('/copy-from-local', requireAuth, async (req, res) => {
  try {
    const { localPath, folderId = 'root' } = req.body;
    if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'Local file not found' });
    const stat = fs.statSync(localPath);
    if (stat.isDirectory()) return res.status(400).json({ error: 'Cannot copy directories yet' });

    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    const stream = fs.createReadStream(localPath);

    const response = await drive.files.create({
      requestBody: {
        name: path.basename(localPath),
        parents: [folderId],
      },
      media: { body: stream },
      fields: 'id, name, mimeType, size, modifiedTime',
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /drive/copy-to-local ────────────────────────────────────────────────
router.post('/copy-to-local', requireAuth, async (req, res) => {
  try {
    const { fileId, destDir } = req.body;
    if (!fs.existsSync(destDir)) return res.status(404).json({ error: 'Destination directory not found' });

    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    const meta = await drive.files.get({ fileId, fields: 'name, mimeType' });
    const isGoogleDoc = meta.data.mimeType.startsWith('application/vnd.google-apps');
    let exportMime = null;
    let fileName = meta.data.name;

    if (isGoogleDoc) {
      if (meta.data.mimeType.includes('spreadsheet')) { exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; fileName += '.xlsx'; }
      else if (meta.data.mimeType.includes('presentation')) { exportMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'; fileName += '.pptx'; }
      else { exportMime = 'application/pdf'; fileName += '.pdf'; }
    }

    const destPath = path.join(destDir, fileName);
    const destStream = fs.createWriteStream(destPath);

    if (isGoogleDoc) {
      const response = await drive.files.export({ fileId, mimeType: exportMime }, { responseType: 'stream' });
      response.data.pipe(destStream);
    } else {
      const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
      response.data.pipe(destStream);
    }

    await new Promise((resolve, reject) => {
      destStream.on('finish', resolve);
      destStream.on('error', reject);
    });

    const stat = fs.statSync(destPath);
    res.json({ success: true, path: destPath, size: stat.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /drive/copy ─────────────────────────────────────────────────────────
router.post('/copy', requireAuth, async (req, res) => {
  try {
    const { fileId, folderId = 'root' } = req.body;
    const drive = google.drive({ version: 'v3', auth: req.oauth2Client });
    
    const meta = await drive.files.get({ fileId, fields: 'name' });
    const response = await drive.files.copy({
      fileId,
      requestBody: {
        name: meta.data.name,
        parents: [folderId],
      },
      fields: 'id, name, mimeType, size, modifiedTime',
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
