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

Run the development server:

```bash
npm start
```

The app will be available at `http://localhost:5173`

### First-Time Setup

1. Open the app in your browser
2. Create a password (used for client-side encryption)
3. Enter your OpenRouter API key in Settings
4. Start journaling!

## Security

### Privacy-First Architecture

This application is designed with a **client-side privacy model**:

**What's secure:**
- ✅ API keys encrypted at rest in IndexedDB using RxDB with user password
- ✅ All data stored locally on your device
- ✅ Direct HTTPS communication between browser and OpenRouter API
- ✅ No backend server means no server-side data collection
- ✅ Journal entries never leave your device (except OpenRouter API calls)

**Important Notes:**
- Your OpenRouter API key is sent directly from your browser to OpenRouter via HTTPS
- OpenRouter may log API requests according to their privacy policy
- For maximum privacy, review [OpenRouter's data handling policies](https://openrouter.ai/privacy)

### Production Deployment

This app can be deployed as a **static site** (no server required):

```bash
npm run build
# Deploy the `dist/` folder to any static hosting (Netlify, Vercel, GitHub Pages, etc.)
```

**Security considerations for production:**
- Use HTTPS hosting (most static hosts provide this automatically)
- Consider implementing Content Security Policy headers
- Ensure your hosting provider supports client-side routing

## Architecture

```
Browser (React + RxDB)
  ↓ HTTPS
OpenRouter API → GPT-4o
```

- Client-side React app with local-first architecture
- RxDB handles encrypted local storage
- Direct API calls to OpenRouter from browser
- No backend server required

## Testing

```bash
npm test
npm run lint
```

## Development Guidelines

See [CLAUDE.md](CLAUDE.md) for development conventions and code style.

## License

[Your License Here]
