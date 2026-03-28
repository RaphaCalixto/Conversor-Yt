import { useMemo, useState } from "react";
import { fetchFormatOptions, isYoutubeUrl, startConversion } from "./api/converterApi";

const FORMAT_OPTIONS = [
  { id: "mp4", label: "MP4" },
  { id: "mp3", label: "MP3" }
];

export default function App() {
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const [activeFormat, setActiveFormat] = useState("mp4");
  const [selectedQualityId, setSelectedQualityId] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);

  const qualityList = useMemo(() => {
    if (!videoInfo?.formats) return [];
    return videoInfo.formats[activeFormat] || [];
  }, [activeFormat, videoInfo]);

  async function handleLoadOptions() {
    setResultMessage("");
    setDownloadUrl("");
    setVideoInfo(null);
    setSelectedQualityId("");

    if (!isYoutubeUrl(videoUrl)) {
      setError("Cole um link valido do YouTube para continuar.");
      return;
    }

    setError("");
    setIsLoadingOptions(true);
    try {
      const payload = await fetchFormatOptions(videoUrl);
      setVideoInfo(payload);
      setSelectedQualityId(payload.formats?.[activeFormat]?.[0]?.id || "");
    } catch (requestError) {
      setError(requestError.message || "Nao foi possivel carregar os formatos agora.");
    } finally {
      setIsLoadingOptions(false);
    }
  }

  async function handleConvert() {
    if (!selectedQualityId) {
      setError("Selecione uma qualidade antes de converter.");
      return;
    }

    setError("");
    setIsConverting(true);
    try {
      const response = await startConversion({
        videoUrl,
        formatId: selectedQualityId
      });

      setResultMessage(response.message || "Conversao iniciada.");
      setDownloadUrl(response.downloadUrl || "");
    } catch (requestError) {
      setError(requestError.message || "Falha ao iniciar a conversao.");
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="hero__badge">Conversor Inteligente</div>
        <h1>Converta video para MP3 ou MP4</h1>
        <p>
          Cole o link, escolha o formato e selecione a qualidade. Interface pronta para integrar
          com seu backend de conversao.
        </p>
      </section>

      <section className="converter-card">
        <label htmlFor="video-url" className="field-label">
          Link do YouTube
        </label>
        <div className="input-row">
          <input
            id="video-url"
            type="url"
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <button type="button" onClick={handleLoadOptions} disabled={isLoadingOptions}>
            {isLoadingOptions ? "Buscando..." : "Buscar formatos"}
          </button>
        </div>

        {error && <p className="feedback feedback--error">{error}</p>}

        {videoInfo && (
          <article className="video-preview">
            <img src={videoInfo.thumbnail} alt="Miniatura do video" />
            <div>
              <h2>{videoInfo.title}</h2>
              <p>Dados reais da URL</p>
            </div>
          </article>
        )}

        {videoInfo && (
          <>
            <div className="format-toggle">
              {FORMAT_OPTIONS.map((format) => (
                <button
                  type="button"
                  key={format.id}
                  className={activeFormat === format.id ? "chip chip--active" : "chip"}
                  onClick={() => {
                    setActiveFormat(format.id);
                    setSelectedQualityId(videoInfo.formats?.[format.id]?.[0]?.id || "");
                  }}
                >
                  {format.label}
                </button>
              ))}
            </div>

            <div className="quality-grid">
              {qualityList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    selectedQualityId === item.id ? "quality quality--selected" : "quality"
                  }
                  onClick={() => setSelectedQualityId(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.sizeEstimate}</span>
                  {"fps" in item && <span>{item.fps} FPS</span>}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="cta"
              onClick={handleConvert}
              disabled={isConverting || !selectedQualityId}
            >
              {isConverting ? "Convertendo..." : "Iniciar conversao"}
            </button>
          </>
        )}

        {resultMessage && <p className="feedback feedback--success">{resultMessage}</p>}
        {downloadUrl && (
          <a className="download-link" href={downloadUrl} target="_blank" rel="noreferrer">
            Baixar arquivo convertido
          </a>
        )}
      </section>
    </main>
  );
}
