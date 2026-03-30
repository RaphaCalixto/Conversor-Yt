import cors from "cors";
import express from "express";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ytdlp from "yt-dlp-exec";

const app = express();
const port = Number(process.env.PORT || 8787);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadsDir = path.join(__dirname, "downloads");
const ffprobePath = ffprobeStatic?.path || "";
const binaryDirs = [ffmpegPath, ffprobePath]
  .filter(Boolean)
  .map((binaryPath) => path.dirname(binaryPath));
const extraPath = binaryDirs.join(path.delimiter);
const ytdlpExecOptions = {
  env: {
    ...process.env,
    PATH: extraPath ? `${extraPath}${path.delimiter}${process.env.PATH || ""}` : process.env.PATH
  }
};
const ytdlpBaseOptions = {
  noWarnings: true,
  geoBypass: true,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
};
const ytdlpFileName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const bundledYtdlpPath = path.join(__dirname, "..", "node_modules", "yt-dlp-exec", "bin", ytdlpFileName);
const runtimeYtdlpPath = path.join(os.tmpdir(), ytdlpFileName);
const ytdlpDownloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytdlpFileName}`;
let ytdlpClient = ytdlp;

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadYtdlp(targetPath) {
  const response = await fetch(ytdlpDownloadUrl);
  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar yt-dlp (${response.status}).`);
  }

  const binary = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, binary);
  if (process.platform !== "win32") {
    await fs.chmod(targetPath, 0o755);
  }

  return targetPath;
}

async function ensureYtdlp() {
  const manualPath = String(process.env.YTDLP_PATH || "").trim();

  if (manualPath) {
    if (!(await fileExists(manualPath))) {
      throw new Error(`YTDLP_PATH informado mas nao encontrado: ${manualPath}`);
    }
    ytdlpClient = ytdlp.create(manualPath);
    return manualPath;
  }

  if (await fileExists(bundledYtdlpPath)) {
    ytdlpClient = ytdlp.create(bundledYtdlpPath);
    return bundledYtdlpPath;
  }

  if (await fileExists(runtimeYtdlpPath)) {
    ytdlpClient = ytdlp.create(runtimeYtdlpPath);
    return runtimeYtdlpPath;
  }

  const downloadedPath = await downloadYtdlp(runtimeYtdlpPath);
  ytdlpClient = ytdlp.create(downloadedPath);
  return downloadedPath;
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api/downloads", express.static(downloadsDir, { index: false }));

function isYoutubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(String(url || "").trim());
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(Number(bytes))) return "Tamanho variavel";
  const n = Number(bytes);
  const units = ["B", "KB", "MB", "GB"];
  let size = n;
  let idx = 0;

  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }

  return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const existing = map.get(key);
    if (!existing || Number(item.tbr || 0) > Number(existing.tbr || 0)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

function estimateAudioSize(durationSeconds, bitrateKbps) {
  if (!durationSeconds || !bitrateKbps) return "Tamanho variavel";
  const bytes = (Number(durationSeconds) * Number(bitrateKbps) * 1000) / 8;
  return formatBytes(bytes);
}

function parseVideoFormats(info) {
  const formats = toArray(info.formats)
    .filter((f) => f.ext === "mp4" && f.vcodec !== "none" && Number(f.height || 0) > 0)
    .map((f) => ({
      format_id: String(f.format_id),
      height: Number(f.height || 0),
      fps: Number(f.fps || 0),
      tbr: Number(f.tbr || 0),
      filesize: Number(f.filesize || f.filesize_approx || 0)
    }));

  const deduped = uniqueBy(formats, (f) => `${f.height}-${f.fps}`);
  deduped.sort((a, b) => b.height - a.height || b.fps - a.fps);

  return deduped.map((f) => ({
    id: `mp4:${f.format_id}`,
    label: `${f.height}p${f.fps > 30 ? ` ${f.fps}fps` : ""}`,
    ext: "mp4",
    fps: f.fps || 30,
    sizeEstimate: formatBytes(f.filesize)
  }));
}

function parseAudioFormats(info) {
  const duration = Number(info.duration || 0);
  const audioFormats = toArray(info.formats).filter(
    (f) => f.acodec !== "none" && f.vcodec === "none" && Number(f.abr || 0) > 0
  );

  const maxAbr = audioFormats.reduce((highest, current) => {
    const abr = Number(current.abr || 0);
    return abr > highest ? abr : highest;
  }, 0);
  const candidates = [320, 256, 192, 160, 128, 96, 64];
  const finalRates = candidates.filter((rate) => rate <= maxAbr + 1).slice(0, 4);
  if (finalRates.length === 0) {
    finalRates.push(128, 96);
  }

  return finalRates.map((abr) => ({
    id: `mp3:${abr}`,
    label: `${abr} kbps`,
    ext: "mp3",
    sizeEstimate: estimateAudioSize(duration, abr)
  }));
}

function pickThumbnail(info) {
  if (info.thumbnail) return info.thumbnail;
  const thumbs = toArray(info.thumbnails);
  if (thumbs.length === 0) return "";
  const sorted = thumbs.sort((a, b) => Number(b.height || 0) - Number(a.height || 0));
  return sorted[0]?.url || "";
}

async function getVideoInfo(url) {
  const attempts = [
    "youtube:player_client=android,web",
    "youtube:player_client=tv,web"
  ];
  let lastError = null;

  for (const extractorArgs of attempts) {
    try {
      const raw = await ytdlpClient(
        url,
        {
          ...ytdlpBaseOptions,
          dumpSingleJson: true,
          skipDownload: true,
          preferFreeFormats: false,
          extractorArgs
        },
        ytdlpExecOptions
      );

      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function findDownloadedFile(baseName) {
  const files = await fs.readdir(downloadsDir);
  return files.find((file) => file.startsWith(baseName)) || null;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/convert/options", async (req, res) => {
  const url = String(req.query.url || "").trim();
  if (!isYoutubeUrl(url)) {
    return res.status(400).json({ error: "URL invalida do YouTube." });
  }

  try {
    const info = await getVideoInfo(url);
    const mp4 = parseVideoFormats(info);
    const mp3 = parseAudioFormats(info);

    if (mp4.length === 0 && mp3.length === 0) {
      return res.status(422).json({ error: "Nao foi possivel extrair formatos desse video." });
    }

    return res.json({
      source: "server",
      title: info.title || "Video sem titulo",
      thumbnail: pickThumbnail(info),
      formats: { mp4, mp3 }
    });
  } catch (error) {
    return res.status(500).json({
      error: "Falha ao ler informacoes do video.",
      details: String(error?.stderr || error?.message || error)
    });
  }
});

app.post("/api/convert", async (req, res) => {
  const videoUrl = String(req.body?.videoUrl || "").trim();
  const formatId = String(req.body?.formatId || "").trim();

  if (!isYoutubeUrl(videoUrl)) {
    return res.status(400).json({ error: "URL invalida do YouTube." });
  }

  if (!formatId.includes(":")) {
    return res.status(400).json({ error: "Formato invalido." });
  }

  try {
    const [kind, value] = formatId.split(":");
    const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const outputTemplate = path.join(downloadsDir, `${baseName}.%(ext)s`);

    if (kind === "mp4") {
      await ytdlpClient(
        videoUrl,
        {
          ...ytdlpBaseOptions,
          format: `${value}+bestaudio/best`,
          mergeOutputFormat: "mp4",
          output: outputTemplate,
          extractorArgs: "youtube:player_client=android,web"
        },
        ytdlpExecOptions
      );
    } else if (kind === "mp3") {
      await ytdlpClient(
        videoUrl,
        {
          ...ytdlpBaseOptions,
          format: "bestaudio/best",
          extractAudio: true,
          audioFormat: "mp3",
          audioQuality: `${value}K`,
          output: outputTemplate,
          extractorArgs: "youtube:player_client=android,web"
        },
        ytdlpExecOptions
      );
    } else {
      return res.status(400).json({ error: "Formato nao suportado." });
    }

    const downloadedFile = await findDownloadedFile(baseName);
    if (!downloadedFile) {
      return res.status(500).json({ error: "Arquivo convertido nao encontrado." });
    }

    return res.json({
      status: "ok",
      message: "Conversao concluida.",
      downloadUrl: `/api/downloads/${encodeURIComponent(downloadedFile)}`
    });
  } catch (error) {
    return res.status(500).json({
      error: "Falha na conversao.",
      details: String(error?.stderr || error?.message || error)
    });
  }
});

async function start() {
  await fs.mkdir(downloadsDir, { recursive: true });
  const ytdlpPathInUse = await ensureYtdlp();
  console.log(`yt-dlp ativo em: ${ytdlpPathInUse}`);
  app.listen(port, () => {
    console.log(`API ativa em http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Erro ao iniciar servidor:", error);
  process.exit(1);
});
