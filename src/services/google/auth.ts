const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

interface CodeResponse {
  code: string;
  error?: string;
  error_description?: string;
}

interface CodeClient {
  requestCode(): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient(config: {
            client_id: string;
            scope: string;
            ux_mode: string;
            callback: (response: CodeResponse) => void;
            error_callback?: (error: { type: string }) => void;
          }): CodeClient;
          revoke(token: string, callback?: () => void): void;
        };
      };
    };
  }
}

const LS_TOKEN = 'reflekt_gdrive_token';
const LS_TOKEN_EXPIRES = 'reflekt_gdrive_token_expires';
const LS_REFRESH_TOKEN = 'reflekt_gdrive_refresh_token';

let accessToken: string | null = null;
let tokenExpiresAt = 0;

// Restore token from localStorage on module load
(function restoreToken() {
  const stored = localStorage.getItem(LS_TOKEN);
  const expires = localStorage.getItem(LS_TOKEN_EXPIRES);
  if (stored && expires) {
    const expiresAt = Number(expires);
    if (Date.now() < expiresAt - 60_000) {
      accessToken = stored;
      tokenExpiresAt = expiresAt;
    } else {
      // Expired — clean up access token (keep refresh token)
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_TOKEN_EXPIRES);
    }
  }
})();

function persistToken(token: string, expiresAt: number): void {
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_TOKEN_EXPIRES, String(expiresAt));
}

function clearPersistedToken(): void {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_TOKEN_EXPIRES);
  localStorage.removeItem(LS_REFRESH_TOKEN);
}

function getClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID environment variable is not set');
  }
  return clientId;
}

function getWorkerUrl(): string {
  const url = import.meta.env.VITE_AUTH_WORKER_URL;
  if (!url) {
    throw new Error('VITE_AUTH_WORKER_URL environment variable is not set');
  }
  return url;
}

function ensureGisLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    // Check if script is already loading
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const workerUrl = getWorkerUrl();
  const response = await fetch(`${workerUrl}/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: window.location.origin }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }
  return data;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const workerUrl = getWorkerUrl();
  const response = await fetch(`${workerUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Token refresh failed');
  }
  return data;
}

export async function signIn(): Promise<string> {
  await ensureGisLoaded();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services not loaded');
  }

  const code = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initCodeClient({
      client_id: getClientId(),
      scope: SCOPES,
      ux_mode: 'popup',
      callback: (response: CodeResponse) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response.code);
      },
      error_callback: (error) => {
        reject(new Error(`Google sign-in error: ${error.type}`));
      },
    });

    client.requestCode();
  });

  const tokens = await exchangeCode(code);

  accessToken = tokens.access_token;
  tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
  persistToken(accessToken, tokenExpiresAt);

  if (tokens.refresh_token) {
    localStorage.setItem(LS_REFRESH_TOKEN, tokens.refresh_token);
  }

  return accessToken;
}

export async function getAccessToken(): Promise<string | null> {
  // Token still valid (with 60s buffer)
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken;
  }

  // Try silent refresh using refresh token
  const refreshToken = localStorage.getItem(LS_REFRESH_TOKEN);
  if (!refreshToken) {
    accessToken = null;
    tokenExpiresAt = 0;
    clearPersistedToken();
    return null;
  }

  try {
    const tokens = await refreshAccessToken(refreshToken);
    accessToken = tokens.access_token;
    tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
    persistToken(accessToken, tokenExpiresAt);
    return accessToken;
  } catch {
    accessToken = null;
    tokenExpiresAt = 0;
    clearPersistedToken();
    return null;
  }
}

export function signOut(): void {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  tokenExpiresAt = 0;
  clearPersistedToken();
}

export function isSignedIn(): boolean {
  return (accessToken !== null && Date.now() < tokenExpiresAt - 60_000) ||
    localStorage.getItem(LS_REFRESH_TOKEN) !== null;
}
