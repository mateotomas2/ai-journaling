# Quickstart: Tailwind CSS + shadcn/ui

## Development Environment

### Prerequisites

- Node.js 18+
- npm

### Installation

No new system dependencies required.
New project dependencies will be added during migration:
- `tailwindcss`
- `shadcn-ui`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`

## Running the App

```bash
npm run dev
```

## Working with shadcn/ui

### Adding New Components

Use the shadcn CLI to add new components:

```bash
npx shadcn@latest add [component-name]
```

Example:
```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
```

### Theming

Theme variables are defined in:
- `src/index.css` (CSS variables for colors/radius)
- `tailwind.config.js` (Token mapping)

To update brand colors, modify the CSS variables in `src/index.css`.
