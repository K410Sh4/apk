"use strict";

// Applied only to HTML delivered through the appspace://portal protocol.
// Inline styles support existing editor previews; inline scripts remain blocked.
const CONTENT_SECURITY_POLICY=[
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:38473",
  "frame-src 'self' blob: data:",
  "form-action 'self'"
].join("; ");

module.exports={CONTENT_SECURITY_POLICY};
