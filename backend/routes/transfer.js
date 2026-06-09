const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// ─── In-memory fallback store ─────────────────────────────────────────────────
const memTransfers = [];
let memIdCounter = 1;

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

// ─── Transfer Schema ──────────────────────────────────────────────────────────
const TransferSchema = new mongoose.Schema({
  userId: String,
  type: { type: String, enum: ['upload', 'download', 'local_copy', 'local_to_cloud', 'cloud_to_local'] },
  status: { type: String, enum: ['queued', 'active', 'paused', 'completed', 'failed'], default: 'queued' },
  source: { type: Object },
  destination: { type: Object },
  fileName: String,
  totalBytes: { type: Number, default: 0 },
  transferredBytes: { type: Number, default: 0 },
  error: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Transfer = mongoose.model('Transfer', TransferSchema);

function formatTransfer(t) {
  return {
    id: t._id || t.id,
    type: t.type,
    status: t.status,
    fileName: t.fileName,
    totalBytes: t.totalBytes || 0,
    transferredBytes: t.transferredBytes || 0,
    progress: t.totalBytes ? Math.round((t.transferredBytes / t.totalBytes) * 100) : 0,
    error: t.error,
    createdAt: t.createdAt,
  };
}

// ─── GET /transfer/list ───────────────────────────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    if (isMongoReady()) {
      const userId = req.session.userId || 'anonymous';
      const transfers = await Transfer.find({ userId }).sort({ createdAt: -1 }).limit(50);
      return res.json(transfers.map(formatTransfer));
    }
    // Memory fallback
    const userId = req.session.userId || 'anonymous';
    const transfers = memTransfers.filter(t => t.userId === userId).slice(-50).reverse();
    res.json(transfers.map(formatTransfer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /transfer/create ────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  try {
    const userId = req.session.userId || 'anonymous';
    const { type, source, destination, fileName, totalBytes } = req.body;

    if (isMongoReady()) {
      const transfer = new Transfer({ userId, type, source, destination, fileName, totalBytes });
      await transfer.save();
      return res.json({ id: transfer._id, status: transfer.status });
    }
    // Memory fallback
    const t = { id: String(memIdCounter++), userId, type, source, destination, fileName, totalBytes: totalBytes || 0, transferredBytes: 0, status: 'queued', createdAt: new Date() };
    memTransfers.push(t);
    res.json({ id: t.id, status: t.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /transfer/:id/pause ────────────────────────────────────────────────
router.patch('/:id/pause', async (req, res) => {
  try {
    if (isMongoReady()) {
      const t = await Transfer.findByIdAndUpdate(req.params.id, { status: 'paused', updatedAt: new Date() }, { new: true });
      return res.json({ id: t._id, status: t.status });
    }
    const t = memTransfers.find(x => x.id === req.params.id);
    if (t) t.status = 'paused';
    res.json({ id: req.params.id, status: 'paused' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /transfer/:id/resume ───────────────────────────────────────────────
router.patch('/:id/resume', async (req, res) => {
  try {
    if (isMongoReady()) {
      const t = await Transfer.findByIdAndUpdate(req.params.id, { status: 'queued', updatedAt: new Date() }, { new: true });
      return res.json({ id: t._id, status: t.status });
    }
    const t = memTransfers.find(x => x.id === req.params.id);
    if (t) t.status = 'queued';
    res.json({ id: req.params.id, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /transfer/:id/progress ────────────────────────────────────────────
router.patch('/:id/progress', async (req, res) => {
  try {
    const { transferredBytes, status } = req.body;
    if (isMongoReady()) {
      const update = { transferredBytes, updatedAt: new Date() };
      if (status) update.status = status;
      const t = await Transfer.findByIdAndUpdate(req.params.id, update, { new: true });
      return res.json({ id: t._id, transferredBytes: t.transferredBytes, status: t.status });
    }
    const t = memTransfers.find(x => x.id === req.params.id);
    if (t) { t.transferredBytes = transferredBytes; if (status) t.status = status; }
    res.json({ id: req.params.id, transferredBytes, status: status || t?.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /transfer/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    if (isMongoReady()) {
      await Transfer.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    }
    const idx = memTransfers.findIndex(x => x.id === req.params.id);
    if (idx !== -1) memTransfers.splice(idx, 1);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
