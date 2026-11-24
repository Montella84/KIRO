# BeepBack

A 1990s alphanumeric pager reborn as a modern **auditable interruption firewall** for deep work. BeepBack enforces an explicit Interruption Contract: only events you've authorized can ring through during a focus session. Everything else is held for the end-of-session digest or logged as discarded — never silently dropped.

## Quickstart

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment (optional)

Copy `.env.example` to `.env` and fill in any values. The app works fully offline without an API key — AI summarization falls back to deterministic truncation automatically.

```bash
cp .env.example .env
```

### 3. Start the development server

Runs the Vite frontend and Express webhook server concurrently:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Webhook API: http://localhost:3001

### 4. Run tests

```bash
npm test
```

## Sending a test webhook

```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{"sender":"ops-bot","subject":"Disk usage 95%","body":"Server /dev/sda1 at 95% capacity","source":"pagerduty"}'
```

## Project structure

```
src/core/          # Pure deterministic policy engine and types
src/audio/         # Web Audio API piezo synthesizer
src/components/    # React UI components
server/            # Express webhook server and AI summarizer
tests/             # Unit and property-based tests
```

## Tech stack

- **Frontend:** React 18, TypeScript (strict), Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Audio:** Web Audio API (no external audio files)
- **Testing:** Vitest, fast-check (property-based)
