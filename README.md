# AI Journaling App

A privacy-focused daily journaling application with AI-powered chat and summaries.

## Features

- Daily journal entries with AI chat assistant
- Automatic daily summaries (journal, insights, health, dreams)
- Natural language queries across your journal history
- Client-side encryption with password protection
- Offline-first with local database (RxDB/IndexedDB)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- An [OpenRouter API key](https://openrouter.ai/)

### Installation

```bash
npm install
```

### Development

Run the development server and client:

```bash
# Terminal 1: Start the API proxy server
npm run server

# Terminal 2: Start the Vite dev server
npm run dev
```

The app will be available at `http://localhost:5173`

### First-Time Setup

1. Open the app in your browser
2. Create a password (used for client-side encryption)
3. Enter your OpenRouter API key in Settings
4. Start journaling!

## Security

### ⚠️ LOCALHOST ONLY - NOT PRODUCTION-READY

This application is designed **exclusively for local development** on `localhost`. It has **critical security limitations** that make it unsuitable for production deployment or network exposure.

### Security Model

**What's secure:**
- ✅ API keys encrypted at rest in IndexedDB using RxDB with user password
- ✅ Server doesn't persist API keys (used transiently then discarded)
- ✅ Server-to-OpenRouter communication uses HTTPS
- ✅ Local-only architecture minimizes attack surface

**What's NOT secure:**
- ❌ Client-to-server communication is HTTP (not HTTPS)
- ❌ Wide-open CORS accepts requests from any origin
- ❌ No authentication or session management
- ❌ Server will crash if `NODE_ENV=production` is set (by design)

### DO NOT:
- Deploy this server to production
- Expose the server to your local network
- Run on shared or public machines
- Set `NODE_ENV=production` (server will refuse to start)

### For Production Deployment

If you need to deploy this application, you **MUST** implement:

1. **HTTPS/TLS**
   - Use valid SSL certificates (Let's Encrypt, etc.)
   - Enforce HSTS headers
   - No mixed content

2. **Authentication & Authorization**
   - Implement user accounts with secure authentication
   - Use session tokens (JWT, OAuth, etc.)
   - Store API keys server-side in encrypted storage
   - Never send API keys from client

3. **CORS Restrictions**
   - Whitelist specific trusted domains only
   - Enable credentials with `credentials: true`

4. **Rate Limiting**
   - Implement per-user and per-IP rate limits
   - Protect against abuse and DoS attacks

5. **Audit Logging**
   - Log security events (not API keys!)
   - Monitor for suspicious activity

6. **Security Headers**
   - Content-Security-Policy
   - X-Frame-Options
   - X-Content-Type-Options

See the security analysis document in `specs/` for detailed recommendations.

## Architecture

```
Browser (React + RxDB)
  ↓ HTTP (localhost only)
Express Server (proxy)
  ↓ HTTPS
OpenRouter API → GPT-4o
```

- Client handles UI, encryption, and local storage
- Server acts as a simple proxy to OpenRouter
- API keys transmitted in request payload (acceptable for localhost only)

## Testing

```bash
npm test
npm run lint
```

## Development Guidelines

See [CLAUDE.md](CLAUDE.md) for development conventions and code style.

## License

[Your License Here]
