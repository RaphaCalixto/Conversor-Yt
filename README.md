# Conversor de Video (React + Material 3 Inspired)

Interface React + API Node para colar URL do YouTube, escolher `MP4` ou `MP3`, selecionar qualidade e iniciar conversao real.

## Rodar local

```bash
npm install
npm run dev
```

`npm run dev` sobe:
- Frontend Vite em `http://localhost:5173`
- API em `http://localhost:8787`

## Build de producao

```bash
npm run build
```

Para deploy do frontend separado da API, configure `VITE_API_BASE_URL` (sem `/api`) antes do build.
Exemplo:

```bash
VITE_API_BASE_URL=https://seu-backend.com npm run build
```

## API esperada

A API real ja esta implementada em `server/index.js`.

`GET /api/convert/options?url=<youtube_url>`

```json
{
  "source": "server",
  "title": "Titulo do video",
  "thumbnail": "https://...",
  "formats": {
    "mp4": [
      { "id": "mp4-1080", "label": "1080p", "ext": "mp4", "fps": 60, "sizeEstimate": "420 MB" }
    ],
    "mp3": [
      { "id": "mp3-320", "label": "320 kbps", "ext": "mp3", "sizeEstimate": "16 MB" }
    ]
  }
}
```

`POST /api/convert`

```json
{
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "formatId": "mp4-1080"
}
```

Resposta:

```json
{
  "status": "ok",
  "downloadUrl": "/api/downloads/arquivo.mp3",
  "message": "Conversao concluida."
}
```

## Requisitos de conversao

O projeto ja inclui `ffmpeg-static` e `ffprobe-static`, entao nao precisa instalar `ffmpeg` manualmente.
