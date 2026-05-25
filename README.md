# Operator Kit Lite

Operator Kit Lite is a local-first, no-backend web app for practical AI operator workflows. It provides two focused tools: a Prompt Vault and an Agent Risk Ledger.

## Install
```bash
npm install
```

## Run (dev)
```bash
npm run dev
```

## Build
```bash
npm run build
```

## Features
- Vite + React + TypeScript single-page app.
- Dark, responsive, operator-style interface.
- Local storage persistence with no external services.
- **Prompt Vault**
  - Create, edit, delete prompts.
  - Search (title/body/tags/use case/notes).
  - Filter by category and sort by newest/oldest/title.
  - Copy prompt body.
  - Import/export prompts as JSON.
  - Includes 5 starter prompts.
- **Agent Risk Ledger**
  - Create, edit, delete risk assessments.
  - Search and filter by risk score.
  - Copy markdown risk report.
  - Import/export assessments as JSON.
- Basic JSON import validation and empty-state messaging.

## Future Improvements
- Add richer validation for imported data shape.
- Add optional CSV export.
- Add selectable views (compact/table mode).
- Add audit timeline and archived entries.
- Add keyboard shortcuts for power users.
