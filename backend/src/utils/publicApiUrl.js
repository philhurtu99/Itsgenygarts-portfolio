export function publicApiBaseUrl() {
  const configured = process.env.PUBLIC_API_URL
    || process.env.API_PUBLIC_URL
    || process.env.BACKEND_PUBLIC_URL
    || process.env.BACKEND_URL;

  if (configured) return configured.replace(/\/$/, '').replace(/\/api$/, '') + '/api';

  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/$/, '') + '/api';
  }

  return 'http://localhost:5000/api';
}
