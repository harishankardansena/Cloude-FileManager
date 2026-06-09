const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
  access_token: String,
  refresh_token: String,
  expiry_date: Number,
  token_type: String,
  scope: String,
});

const UserSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  name: String,
  avatar: String,
  googleTokens: TokenSchema,
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
});

UserSchema.methods.isTokenExpired = function () {
  if (!this.googleTokens?.expiry_date) return true;
  return Date.now() >= this.googleTokens.expiry_date - 60000; // 1 min buffer
};

module.exports = mongoose.model('User', UserSchema);
