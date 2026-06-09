require('dotenv').config();

// ─── Force Google DNS for reliable MongoDB SRV resolution ────────────────────
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Google Public DNS

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const driveRoutes = require('./routes/drive');
const localRoutes = require('./routes/local');
const transferRoutes = require('./routes/transfer');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── MongoDB Connection (non-fatal) ────────────────────────────────────────────
let mongoConnected = false;

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    mongoConnected = true;
    console.log('✅ MongoDB connected');
    return true;
  } catch (err) {
    console.warn('⚠️  MongoDB unavailable (sessions will use memory store):', err.message);
    return false;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Session (with optional Mongo store) ─────────────────────────────────────
async function setupSession() {
  const connected = await connectMongo();

  let sessionStore;
  if (connected) {
    const MongoStore = require('connect-mongo');
    sessionStore = MongoStore.create({ mongoUrl: process.env.MONGODB_URI });
    console.log('✅ Session store: MongoDB');
  } else {
    console.log('ℹ️  Session store: In-memory (MongoDB unavailable)');
  }

  app.use(session({
    secret: process.env.SESSION_SECRET || 'cloude_fallback_secret',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  }));

  // ─── Routes ─────────────────────────────────────────────────────────────────
  app.use('/auth', authRoutes);
  app.use('/drive', driveRoutes);
  app.use('/local', localRoutes);
  app.use('/transfer', transferRoutes);

  // ─── Health Check ────────────────────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      mongodb: mongoConnected ? 'connected' : 'disconnected (memory fallback)',
      user: req.session.userId ? 'authenticated' : 'anonymous',
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Serve Frontend in Production ──────────────────────────────────────────────
  const fs = require('fs');
  const path = require('path');
  const frontendDist = path.join(__dirname, '../frontend/dist');
  
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    
    // Catch-all route to serve the React app (for client-side routing)
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.send("Backend is running, but frontend/dist was not found. Please check your build step.");
    });
  }

  // ─── Error Handler ────────────────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Cloude File Manager backend running on http://localhost:${PORT}`);
    console.log(`📡 MongoDB: ${mongoConnected ? 'Connected' : 'Memory fallback'}`);
  });
}

setupSession();
