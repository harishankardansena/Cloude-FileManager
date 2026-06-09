const express = require('express');
const { google } = require('googleapis');
const mongoose = require('mongoose');
const User = require('../models/User');
const router = express.Router();

// ─── In-memory user fallback ──────────────────────────────────────────────────
const memUsers = {};

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}


// ─── OAuth2 Client Factory ────────────────────────────────────────────────────
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_SECRET,
    'http://localhost:5000/auth/callback'
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// ─── GET /auth/google — Redirect to Google ───────────────────────────────────
router.get('/google', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(url);
});

// ─── GET /auth/callback — Handle OAuth Code Exchange ─────────────────────────
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    return res.redirect(`${FRONTEND_URL}?auth=error&reason=${error}`);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Upsert user — MongoDB or memory
    let user;
    if (isMongoReady()) {
      user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = new User({ googleId: profile.id, email: profile.email, name: profile.name, avatar: profile.picture });
      }
      user.googleTokens = tokens;
      user.lastLogin = new Date();
      await user.save();
      req.session.userId = user._id.toString();
    } else {
      // In-memory user store
      const existingId = Object.keys(memUsers).find(k => memUsers[k].googleId === profile.id);
      const userId = existingId || `mem_${Date.now()}`;
      memUsers[userId] = { _id: userId, googleId: profile.id, email: profile.email, name: profile.name, avatar: profile.picture, googleTokens: tokens };
      req.session.userId = userId;
      req.session.userTokens = tokens;
    }

    req.session.save(() => {
      res.redirect(`${FRONTEND_URL}?auth=success`);
    });
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${FRONTEND_URL}?auth=error&reason=token_exchange_failed`);
  }
});

// ─── GET /auth/me — Get Current User ─────────────────────────────────────────
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ authenticated: false, user: null });
  }
  try {
    if (isMongoReady()) {
      const user = await User.findById(req.session.userId).select('-googleTokens');
      if (!user) return res.status(401).json({ authenticated: false, user: null });
      return res.json({ authenticated: true, user });
    }
    // Memory fallback
    const user = memUsers[req.session.userId];
    if (!user) return res.status(401).json({ authenticated: false, user: null });
    const { googleTokens, ...safeUser } = user;
    res.json({ authenticated: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /auth/logout — Sign Out ────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

module.exports = router;
