interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function corsResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function handleExchange(request: Request, env: Env): Promise<Response> {
  const { code, redirect_uri } = (await request.json()) as {
    code: string;
    redirect_uri: string;
  };

  if (!code || !redirect_uri) {
    return corsResponse({ error: 'Missing code or redirect_uri' }, 400);
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: 'authorization_code',
    }),
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    return corsResponse({ error: data.error, error_description: data.error_description }, 400);
  }

  return corsResponse({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}

async function handleRefresh(request: Request, env: Env): Promise<Response> {
  const { refresh_token } = (await request.json()) as { refresh_token: string };

  if (!refresh_token) {
    return corsResponse({ error: 'Missing refresh_token' }, 400);
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    return corsResponse({ error: data.error, error_description: data.error_description }, 400);
  }

  return corsResponse({
    access_token: data.access_token,
    expires_in: data.expires_in,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    switch (url.pathname) {
      case '/auth/exchange':
        return handleExchange(request, env);
      case '/auth/refresh':
        return handleRefresh(request, env);
      default:
        return corsResponse({ error: 'Not found' }, 404);
    }
  },
} satisfies ExportedHandler<Env>;
