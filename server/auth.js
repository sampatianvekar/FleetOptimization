const crypto = require("crypto")
const jwt = require("jsonwebtoken")

// Single-admin auth. Both values must come from the environment: the old code shipped
// a hard-coded signing secret, which let anyone who read the repo forge tokens.
class AuthNotConfigured extends Error {
  constructor() {
    super("Admin auth is not configured. Set ADMIN_PASSWORD and JWT_SECRET in server/.env")
    this.code = "AUTH_NOT_CONFIGURED"
  }
}

function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) throw new AuthNotConfigured()
  return process.env.JWT_SECRET
}

// Hash both sides so the comparison is constant-time even for different lengths.
const safeEqual = (a, b) =>
  crypto.timingSafeEqual(crypto.createHash("sha256").update(String(a)).digest(), crypto.createHash("sha256").update(String(b)).digest())

exports.AuthNotConfigured = AuthNotConfigured
exports.generateToken = id => jwt.sign({ id }, secret(), { expiresIn: "8h" })
exports.verify = token => jwt.verify(token, secret())

/** Returns a token for the right password, null for a wrong one. */
exports.login = password => {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) throw new AuthNotConfigured()
  return typeof password === "string" && safeEqual(password, expected) ? exports.generateToken("admin") : null
}
