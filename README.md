# Conversor de Video Local (PWA)

App local para converter links do YouTube em `MP3` ou `MP4`.
Agora o projeto esta configurado para rodar **somente localmente** (sem Render/Vercel), com backend e frontend no mesmo servidor.

## O que voce precisa no PC

- Node.js 20+ (recomendado LTS)
- npm (ja vem com Node)
- Internet para baixar dependencias e acessar o video do YouTube
- Chrome ou Edge (para instalar como PWA)

## Como rodar localmente

```bash
npm install
npm start
```

O comando `npm start`:

1. gera o build do frontend
2. sobe a API local
3. serve o app em `http://localhost:8787`

Abra no navegador:

`http://localhost:8787`

Nao precisa usar `npm run dev` para uso normal.

## Instalar como app (PWA)

1. Abra `http://localhost:8787` no Chrome/Edge
2. Clique no icone de instalar app (barra de enderecos) ou menu `Instalar`
3. O app sera instalado no PC com atalho proprio

Observacao: o backend continua local. O app instalado funciona enquanto o servidor local estiver rodando.

## Onde ficam os arquivos convertidos

Os arquivos convertidos ficam em:

`server/downloads`

Tambem podem ser baixados pelo link mostrado na interface.

## Scripts uteis

- `npm start`: build + servidor local (fluxo principal)
- `npm run serve`: sobe somente o servidor local (usa build ja existente)
- `npm run dev`: modo desenvolvimento (frontend + api separados)

## Solucao para bloqueio anti-bot do YouTube (opcional)

Se aparecer erro parecido com "Sign in to confirm you’re not a bot", voce pode passar cookies do YouTube:

1. Exporte um `cookies.txt` (formato Netscape)
2. Gere Base64 no PowerShell:

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content .\cookies.txt -Raw)))
```

3. Defina a variavel antes de iniciar:

```powershell
$env:YTDLP_COOKIES_B64="COLE_AQUI_O_BASE64"
npm start
```

## Endpoints locais

- `GET /api/health`
- `GET /api/convert/options?url=<youtube_url>`
- `POST /api/convert`
- `GET /api/downloads/<arquivo>`
