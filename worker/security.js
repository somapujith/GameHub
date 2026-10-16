// Security headers. The API gets them from a Hono middleware (index.js); static assets get
// the equivalent set from public/_headers (copied into dist/ by Vite). A unit test keeps the
// CSP in _headers aligned with GIS_CSP_REQUIREMENTS below.

// What Google Identity Services needs (https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#content_security_policy):
//   script-src  https://accounts.google.com/gsi/client   (the library)
//   frame-src   https://accounts.google.com/gsi/         (the sign-in button iframe / One Tap)
//   connect-src https://accounts.google.com/gsi/         (token/status requests)
//   style-src   https://accounts.google.com/gsi/style    (the button stylesheet)
//   img-src     https://*.googleusercontent.com          (the account avatar in the button)
export const GIS_CSP_REQUIREMENTS = {
  'script-src': ['https://accounts.google.com/gsi/client'],
  'frame-src': ['https://accounts.google.com/gsi/'],
  'connect-src': ['https://accounts.google.com'],
  'style-src': ['https://accounts.google.com/gsi/style', "'unsafe-inline'"],
  'img-src': ['https://*.googleusercontent.com'],
};

export const PERMISSIONS_POLICY =
  'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';

/** Headers for JSON API responses (no HTML is ever served from /api). */
export function apiSecurityHeaders(secure) {
  const h = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': PERMISSIONS_POLICY,
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  };
  if (secure) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return h;
}
