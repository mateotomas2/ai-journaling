const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

interface TokenClient {
  requestAccessToken(config?: { prompt?: string }): void;
  callback: (response: TokenResponse) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string }) => void;
          }): TokenClient;
          revoke(token: string, callback?: () => void): void;
        };
      };
    };
  }
}

const LS_TOKEN = 'reflekt_gdrive_token';
const LS_TOKEN_EXPIRES = 'reflekt_gdrive_token_expires';

let tokenClient: TokenClient | null = null;
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
      // Expired — clean up
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
}

function getClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID environment variable is not set');
  }
  return clientId;
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

function initTokenClient(): TokenClient {
  if (tokenClient) return tokenClient;

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services not loaded');
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: getClientId(),
    scope: SCOPES,
    callback: () => {
      // Overridden per-call in signIn/getAccessToken
    },
  });

  return tokenClient;
}

export async function signIn(): Promise<string> {
  await ensureGisLoaded();
  const client = initTokenClient();

  return new Promise((resolve, reject) => {
    client.callback = (response: TokenResponse) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      accessToken = response.access_token;
      tokenExpiresAt = Date.now() + response.expires_in * 1000;
      persistToken(accessToken, tokenExpiresAt);
      resolve(response.access_token);
    };

    client.requestAccessToken();
  });
}

export async function getAccessToken(): Promise<string | null> {
  // Token still valid (with 60s buffer)
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken;
  }

  // Token expired or missing — caller should trigger re-auth via signIn()
  accessToken = null;
  tokenExpiresAt = 0;
  clearPersistedToken();
  return null;
}

export function signOut(): void {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  tokenExpiresAt = 0;
  tokenClient = null;
  clearPersistedToken();
}

export function isSignedIn(): boolean {
  return accessToken !== null && Date.now() < tokenExpiresAt - 60_000;
}
