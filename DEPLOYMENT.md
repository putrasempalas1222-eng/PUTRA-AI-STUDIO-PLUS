# Deployment

## Backend

Backend lives in `functions/` and is deployed to Firebase Functions v2 / Cloud Run.

Current deployed API base URL:

```txt
https://api-mzmdqh3n6a-uc.a.run.app
```

Deploy commands:

```bash
firebase login
firebase use play-integrity-2adpr7x4a8xhyex
cd functions
npm install
cd ..
firebase deploy --only functions
```

Backend secrets stay in `functions/.env` and must not be committed.

## Frontend

Frontend lives in `frontend/` and can be published separately to GitHub/Vercel.

For Vercel, set this environment variable:

```txt
VITE_API_BASE_URL=https://api-mzmdqh3n6a-uc.a.run.app
```

Build commands:

```bash
cd frontend
npm install
npm run build
```

Vercel settings:

```txt
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```
