# Quickstart: Daily Journal Chat

**Date**: 2026-01-16 | **Branch**: `001-daily-journal-chat`

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- OpenRouter API key (get one at https://openrouter.ai/keys)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Servers

```bash
# Start both frontend (Vite) and backend (Express) concurrently
npm start
```

This runs:
- Frontend: http://localhost:5173 (Vite dev server)
- Backend: http://localhost:3001 (Express API proxy)

### 3. First-Time App Setup

1. Open http://localhost:5173 in your browser
2. Create a password (this encrypts your local journal data)
3. Enter your OpenRouter API key
4. Start journaling!

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run both frontend and backend in development |
| `npm run dev` | Run frontend only (Vite) |
| `npm run server` | Run backend only (Express) |
| `npm test` | Run tests with Vitest |
| `npm run test:ui` | Run tests with Vitest UI |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run build` | Build for production |

## Project Structure

```
src/
├── components/     # React UI components
├── pages/          # Route-level pages
├── services/       # Business logic
│   ├── ai/         # OpenRouter integration
│   ├── crypto/     # Encryption (PBKDF2, AES-GCM)
│   └── db/         # RxDB schemas and operations
├── hooks/          # React custom hooks
├── types/          # TypeScript definitions
└── utils/          # Utility functions

server/
├── index.ts        # Express entry point
└── routes/
    └── ai.ts       # OpenRouter proxy endpoints

tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── e2e/            # End-to-end tests
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/services/db/schemas.ts` | RxDB collection schemas |
| `src/services/crypto/keyDerivation.ts` | Password-to-key derivation |
| `src/services/ai/chat.ts` | OpenRouter chat integration |
| `server/routes/ai.ts` | API proxy endpoints |
| `vite.config.ts` | Vite + Vitest configuration |

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

### Run Specific Test File

```bash
npm test -- src/services/crypto/keyDerivation.test.ts
```

### TDD Workflow

Per the project constitution, follow TDD:

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to pass
3. **Refactor**: Clean up while tests pass

Example:
```bash
# 1. Write test in tests/unit/crypto.test.ts
# 2. Run and verify it fails
npm test -- tests/unit/crypto.test.ts

# 3. Implement in src/services/crypto/
# 4. Run and verify it passes
npm test -- tests/unit/crypto.test.ts

# 5. Refactor if needed, ensure tests still pass
```

## Common Tasks

### Add a New RxDB Collection

1. Define schema in `src/services/db/schemas.ts`
2. Add collection to database initialization
3. Create typed wrapper functions for CRUD operations
4. Write tests first (TDD)

### Add a New API Endpoint

1. Add route in `server/routes/ai.ts`
2. Define request/response types in `src/types/`
3. Add client-side service function in `src/services/ai/`
4. Write tests first (TDD)

### Debug Encryption Issues

```typescript
// In browser console:
const salt = localStorage.getItem('reflekt_salt');
console.log('Salt exists:', !!salt);

// Check if database is accessible
const db = await getRxDatabase();
console.log('Collections:', Object.keys(db.collections));
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | Express server port |
| `VITE_APP_NAME` | No | Reflekt | App name shown in UI |

## Troubleshooting

### "Cannot decrypt database"
- You entered the wrong password
- Clear browser data and start fresh (data will be lost)

### "AI service error"
- Check your OpenRouter API key is valid
- Check your OpenRouter account has credits
- Check network connectivity

### Tests failing with "RxDB" errors
- Ensure test setup includes RxDB memory adapter
- Check `tests/setup.ts` for proper configuration

## Architecture Notes

- **Local-first**: All journal data in browser IndexedDB
- **Encrypted**: AES-GCM with PBKDF2 key derivation
- **No cloud sync**: Data stays on your device
- **Proxy server**: Keeps OpenRouter API key out of browser network tab

## Links

- [Feature Spec](./spec.md)
- [Implementation Plan](./plan.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/api.md)
- [Research Notes](./research.md)
