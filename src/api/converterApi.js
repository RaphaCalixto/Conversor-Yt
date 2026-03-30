export function isYoutubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url.trim());
}

const apiPrefix = "/api";

function toApiUrl(path, params) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return `${apiPrefix}${path}${query}`;
}

function getRequestErrorMessage(response, payload, fallbackText) {
  if (payload?.error && payload?.details) {
    const details = String(payload.details).replace(/\s+/g, " ").slice(0, 240);
    return `${payload.error} Detalhe: ${details}`;
  }
  if (payload?.error) return payload.error;
  if (payload?.message) return payload.message;

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const text = String(fallbackText || "").trim();
  const looksLikeHtml =
    contentType.includes("text/html") ||
    /^<!doctype|^<html|^the page /i.test(text);

  if (looksLikeHtml) {
    return "A API local nao respondeu em JSON. Verifique se o backend esta ativo no mesmo PC.";
  }

  if (text) return text.slice(0, 180);
  return `Falha na requisicao (${response.status}).`;
}

async function parseApiResponse(response) {
  const rawText = await response.text();
  let payload = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(getRequestErrorMessage(response, payload, rawText));
  }

  if (!payload || typeof payload !== "object") {
    throw new Error(
      "Resposta inesperada do servidor local. Verifique se a rota /api esta correta e retornando JSON."
    );
  }

  return payload;
}

export async function fetchFormatOptions(videoUrl) {
  const response = await fetch(
    toApiUrl("/convert/options", {
      url: videoUrl
    })
  );
  return parseApiResponse(response);
}

export async function startConversion({ videoUrl, formatId }) {
  const response = await fetch(toApiUrl("/convert"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoUrl, formatId })
  });
  return parseApiResponse(response);
}
