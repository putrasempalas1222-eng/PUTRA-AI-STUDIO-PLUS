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

Proxy Ollama lokal:

```txt
Endpoint publik: https://api-mzmdqh3n6a-uc.a.run.app/api/server-lokal/api/chat
Target backend: OLLAMA_BASE_URL + /api/chat
Nama service: API-SERVER-LOKAL
```

Karena Cloud Run/Firebase tidak bisa membaca `http://localhost:11434` dari komputer lokal, `OLLAMA_BASE_URL` harus memakai URL publik seperti ngrok:

```txt
OLLAMA_BASE_URL="https://rotunda-elderly-alto.ngrok-free.dev"
OLLAMA_CHAT_URL="https://rotunda-elderly-alto.ngrok-free.dev/api/chat"
```

Untuk backend lokal yang ingin lewat proxy Cloud Run/Firebase yang sudah dibuat:

```txt
OLLAMA_BASE_URL="https://api-mzmdqh3n6a-uc.a.run.app/api/server-lokal"
OLLAMA_CHAT_URL="https://api-mzmdqh3n6a-uc.a.run.app/api/server-lokal/api/chat"
```

Tes proxy:

```bash
curl -X POST "https://api-mzmdqh3n6a-uc.a.run.app/api/server-lokal/api/chat" ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"qwen2.5-coder:3b\",\"stream\":false,\"messages\":[{\"role\":\"user\",\"content\":\"halo\"}]}"
```

Jika ingin deploy backend Express sebagai Cloud Run terpisah dengan nama service `api-server-lokal`:

```bash
cd "C:\3D POSTER\PUTRA AI STUDIO\backend"
gcloud run deploy api-server-lokal ^
  --source . ^
  --region us-central1 ^
  --allow-unauthenticated ^
  --set-env-vars OLLAMA_BASE_URL=https://rotunda-elderly-alto.ngrok-free.dev,OLLAMA_CHAT_URL=https://rotunda-elderly-alto.ngrok-free.dev/api/chat,OLLAMA_FIRST=true
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
