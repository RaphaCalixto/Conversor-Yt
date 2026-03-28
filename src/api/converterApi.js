export function isYoutubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url.trim());
}

export async function fetchFormatOptions(videoUrl) {
  const response = await fetch(`/api/convert/options?url=${encodeURIComponent(videoUrl)}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Falha ao carregar formatos");
  }

  return payload;
}

export async function startConversion({ videoUrl, formatId }) {
  const response = await fetch("/api/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoUrl, formatId })
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Falha ao iniciar conversao");
  }

  return payload;
}
