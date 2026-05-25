# Deployment

## Firebase Functions

Semua function memakai Firebase project:

```txt
play-integrity-2adpr7x4a8xhyex
```

Jangan deploy dari folder yang salah. Jalankan command sesuai project supaya function tidak saling tumburan.

### PUTRA AI STUDIO

Source:

```txt
C:\3D POSTER\PUTRA AI STUDIO\functions\index.js
```

Codebase:

```txt
putra-ai-studio
```

Function:

```txt
api
```

API URL:

```txt
https://api-mzmdqh3n6a-uc.a.run.app
```

Deploy commands:

```bash
cd "C:\3D POSTER\PUTRA AI STUDIO"
firebase login
firebase use play-integrity-2adpr7x4a8xhyex
cd functions
npm install
cd ..
firebase deploy --only functions:putra-ai-studio
```

Secrets ada di:

```txt
C:\3D POSTER\PUTRA AI STUDIO\functions\.env
```

### proxy-api

Source:

```txt
C:\3D POSTER\proxy-api\functions\index.js
C:\3D POSTER\proxy-api\functions\admin.js
```

Codebase:

```txt
default
```

Function:

```txt
api-key
```

API URL:

```txt
https://api-key-mzmdqh3n6a-uc.a.run.app
```

Deploy commands:

```bash
cd "C:\3D POSTER\proxy-api"
firebase login
firebase use play-integrity-2adpr7x4a8xhyex
cd functions
npm install
cd ..
firebase deploy --only functions
```

Secrets ada di:

```txt
C:\3D POSTER\proxy-api\functions\.env
```

### Cek Function Aktif

```bash
firebase functions:list --project play-integrity-2adpr7x4a8xhyex
```

Hasil yang normal:

```txt
api      -> PUTRA AI STUDIO
api-key  -> proxy-api
```

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
