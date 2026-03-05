import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { ensureHandshake, getHandshakeId } from "../lib/cryptoPayload";

interface FormLink {
  id: number;
  title: string;
  description?: string | null;
  url: string;
  type?: string | null;
}


export default function Services() {
  const [forms, setForms] = useState<FormLink[]>([]);
  const [formQuery, setFormQuery] = useState("");
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [isp, setIsp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [ipError, setIpError] = useState<string | null>(null);
  const [speedLoading, setSpeedLoading] = useState(false);
  const [downloadMbps, setDownloadMbps] = useState<number | null>(null);
  const [uploadMbps, setUploadMbps] = useState<number | null>(null);
  const [currentMbps, setCurrentMbps] = useState<number | null>(null);
  const [speedError, setSpeedError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const gaugeRef = useRef<HTMLDivElement | null>(null);
  const gaugeApiRef = useRef<ReturnType<typeof createSpeedGauge> | null>(null);
  const stopRef = useRef(false);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const uploadAbortRef = useRef<XMLHttpRequest | null>(null);
  const [speedState, setSpeedState] = useState<
    "IDLE" | "DOWNLOAD" | "UPLOAD" | "COMPLETE" | "ERROR"
  >("IDLE");
  const [ipExpanded, setIpExpanded] = useState(false);
  const [speedCardExpanded, setSpeedCardExpanded] = useState(false);

  useEffect(() => {
    api
      .get("/forms")
      .then((res) => setForms(Array.isArray(res.data?.forms) ? res.data.forms : []))
      .catch(() => setForms([]));
  }, []);

  const filteredForms = useMemo(() => {
    const query = formQuery.trim().toLowerCase();
    if (!query) return forms;
    return forms.filter((form) => {
      const text = `${form.title} ${form.description || ""}`.toLowerCase();
      return text.includes(query);
    });
  }, [forms, formQuery]);

  const createSpeedGauge = (
    container: HTMLDivElement,
    options: { maxSpeed: number; unitLabel: string; accentColor: string; trackColor: string }
  ) => {
    const uid = Math.random().toString(36).slice(2, 8);
    const gradientId = `gaugeGradient-${uid}`;
    const glowId = `gaugeGlow-${uid}`;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 240 140");
    svg.classList.add("speed-gauge");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const defs = document.createElementNS(svgNS, "defs");
    const gradient = document.createElementNS(svgNS, "linearGradient");
    gradient.setAttribute("id", gradientId);
    gradient.setAttribute("x1", "0%");
    gradient.setAttribute("y1", "0%");
    gradient.setAttribute("x2", "100%");
    gradient.setAttribute("y2", "0%");
    const stopStart = document.createElementNS(svgNS, "stop");
    stopStart.setAttribute("offset", "0%");
    stopStart.setAttribute("stop-color", "#46b1ff");
    const stopMid = document.createElementNS(svgNS, "stop");
    stopMid.setAttribute("offset", "55%");
    stopMid.setAttribute("stop-color", options.accentColor);
    const stopEnd = document.createElementNS(svgNS, "stop");
    stopEnd.setAttribute("offset", "100%");
    stopEnd.setAttribute("stop-color", "#2e7bff");
    gradient.appendChild(stopStart);
    gradient.appendChild(stopMid);
    gradient.appendChild(stopEnd);

    const glow = document.createElementNS(svgNS, "filter");
    glow.setAttribute("id", glowId);
    glow.setAttribute("x", "-30%");
    glow.setAttribute("y", "-30%");
    glow.setAttribute("width", "160%");
    glow.setAttribute("height", "160%");
    const blur = document.createElementNS(svgNS, "feGaussianBlur");
    blur.setAttribute("stdDeviation", "3.5");
    blur.setAttribute("result", "blur");
    const merge = document.createElementNS(svgNS, "feMerge");
    const mergeNode1 = document.createElementNS(svgNS, "feMergeNode");
    mergeNode1.setAttribute("in", "blur");
    const mergeNode2 = document.createElementNS(svgNS, "feMergeNode");
    mergeNode2.setAttribute("in", "SourceGraphic");
    merge.appendChild(mergeNode1);
    merge.appendChild(mergeNode2);
    glow.appendChild(blur);
    glow.appendChild(merge);
    defs.appendChild(gradient);
    defs.appendChild(glow);
    svg.appendChild(defs);

    const track = document.createElementNS(svgNS, "path");
    track.setAttribute("d", "M20 120 A100 100 0 0 1 220 120");
    track.setAttribute("class", "gauge-track");
    track.setAttribute("stroke", options.trackColor);
    svg.appendChild(track);

    const progress = document.createElementNS(svgNS, "path");
    progress.setAttribute("d", "M20 120 A100 100 0 0 1 220 120");
    progress.setAttribute("class", "gauge-progress");
    progress.setAttribute("stroke", `url(#${gradientId})`);
    progress.setAttribute("filter", `url(#${glowId})`);
    svg.appendChild(progress);

    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("r", "5");
    dot.setAttribute("class", "gauge-dot");
    dot.setAttribute("fill", options.accentColor);
    svg.appendChild(dot);

    const valueWrap = document.createElement("div");
    valueWrap.className = "gauge-value";
    const valueEl = document.createElement("div");
    valueEl.className = "gauge-number";
    valueEl.textContent = "--";
    const unitEl = document.createElement("div");
    unitEl.className = "gauge-unit";
    unitEl.textContent = options.unitLabel;
    valueWrap.appendChild(valueEl);
    valueWrap.appendChild(unitEl);

    container.innerHTML = "";
    container.appendChild(svg);
    container.appendChild(valueWrap);

    const totalLength = progress.getTotalLength();
    progress.style.strokeDasharray = `${totalLength}`;
    progress.style.strokeDashoffset = `${totalLength}`;

    let maxSpeed = options.maxSpeed;
    let currentValue = 0;
    let rafId = 0;

    const updateArc = (value: number) => {
      const clamped = Math.max(0, Math.min(value, maxSpeed));
      const ratio = clamped / maxSpeed;
      const offset = totalLength * (1 - ratio);
      progress.style.strokeDashoffset = `${offset}`;
      const angle = Math.PI * ratio;
      const cx = 120 + 100 * Math.cos(Math.PI - angle);
      const cy = 120 - 100 * Math.sin(Math.PI - angle);
      dot.setAttribute("cx", cx.toFixed(2));
      dot.setAttribute("cy", cy.toFixed(2));
      valueEl.textContent = Number.isFinite(clamped) ? clamped.toFixed(2) : "--";
    };

    const animateTo = (target: number) => {
      cancelAnimationFrame(rafId);
      const start = currentValue;
      const startTime = performance.now();
      const duration = 600;
      const step = (now: number) => {
        const elapsed = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - elapsed, 3);
        currentValue = start + (target - start) * eased;
        updateArc(currentValue);
        if (elapsed < 1) rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    };

    return {
      setValue(value: number, animate = true) {
        if (value > maxSpeed) {
          const steps = [100, 200, 500, 1000, 2000];
          maxSpeed = steps.find((step) => value <= step) || 2000;
        }
        if (animate) {
          animateTo(value);
        } else {
          currentValue = value;
          updateArc(value);
        }
      },
      setMaxSpeed(max: number) {
        maxSpeed = max;
        updateArc(currentValue);
      },
      destroy() {
        cancelAnimationFrame(rafId);
        container.innerHTML = "";
      }
    };
  };

  const measureDownload = async (onSample: (value: number) => void) => {
    const minDurationMs = 10000;
    const downloadBytesPerRequest = 25000000;
    const downloadStart = performance.now();
    let downloadedBytes = 0;
    let lastBytes = 0;
    let lastTick = performance.now();
    while (performance.now() - downloadStart < minDurationMs) {
      if (stopRef.current) throw new Error("aborted");
      const controller = new AbortController();
      downloadAbortRef.current = controller;
      const abortTimer = window.setTimeout(() => controller.abort(), minDurationMs);
      const response = await fetch(
        `https://speed.cloudflare.com/__down?bytes=${downloadBytesPerRequest}`,
        { signal: controller.signal }
      );
      if (!response.ok || !response.body) throw new Error("No download stream.");
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (stopRef.current) {
            controller.abort();
            throw new Error("aborted");
          }
          downloadedBytes += value?.byteLength || 0;
          const now = performance.now();
          if (now - lastTick >= 150) {
            const deltaBytes = downloadedBytes - lastBytes;
            const seconds = (now - lastTick) / 1000;
            const rate = (deltaBytes * 8) / (seconds * 1024 * 1024);
            onSample(rate);
            lastBytes = downloadedBytes;
            lastTick = now;
          }
          if (now - downloadStart >= minDurationMs) {
            controller.abort();
            break;
          }
        }
      } finally {
        window.clearTimeout(abortTimer);
      }
    }
    const downloadSeconds = (performance.now() - downloadStart) / 1000;
    return (downloadedBytes * 8) / (downloadSeconds * 1024 * 1024);
  };

  const measureUpload = async (onSample: (value: number) => void) => {
    const uploadTargetMs = 10000;
    const uploadChunkMb = 10;
    const uploadStart = performance.now();
    let uploadedBytes = 0;
    let lastUploaded = 0;
    let lastUploadTick = performance.now();
    let usedProxyUpload = true;

    const uploadOnce = async (useProxy: boolean) => {
      if (stopRef.current) throw new Error("aborted");
      const payload = new Uint8Array(uploadChunkMb * 1024 * 1024);
      const handshakeBefore = getHandshakeId();
      if (!handshakeBefore) {
        await ensureHandshake(true);
      }
      const handshake = getHandshakeId();
      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadAbortRef.current = xhr;
        const url = useProxy ? "/api/utils/speed/external-upload" : "https://speed.cloudflare.com/__up";
        xhr.open("POST", url, true);
        xhr.withCredentials = true;
        xhr.timeout = 15000;
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        if (handshake) {
          xhr.setRequestHeader("x-itd-handshake", handshake);
        }
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          if (stopRef.current) {
            xhr.abort();
            return;
          }
          const currentTotal = uploadedBytes + event.loaded;
          const now = performance.now();
          if (now - lastUploadTick >= 150) {
            const deltaBytes = currentTotal - lastUploaded;
            const seconds = (now - lastUploadTick) / 1000;
            const rate = (deltaBytes * 8) / (seconds * 1024 * 1024);
            onSample(rate);
            lastUploaded = currentTotal;
            lastUploadTick = now;
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            uploadedBytes += payload.byteLength;
            lastUploaded = uploadedBytes;
            resolve();
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed (network)"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));
        xhr.send(payload);
      });
    };

    while (performance.now() - uploadStart < uploadTargetMs) {
      if (stopRef.current) throw new Error("aborted");
      try {
        await uploadOnce(usedProxyUpload);
      } catch (err) {
        if (!usedProxyUpload) {
          usedProxyUpload = true;
          continue;
        }
        throw err;
      }
    }

    const uploadSeconds = (performance.now() - uploadStart) / 1000;
    const rate = (uploadedBytes * 8) / (uploadSeconds * 1024 * 1024);
    return { rate, usedProxy: usedProxyUpload };
  };

  const runSpeedTest = async () => {
    setSpeedLoading(true);
    setSpeedError(null);
    setUploadNote(null);
    setDownloadMbps(null);
    setUploadMbps(null);
    setCurrentMbps(null);
    setSpeedState("DOWNLOAD");
    stopRef.current = false;

    try {
      const downloadRate = await measureDownload((sample) => {
        gaugeApiRef.current?.setValue(sample, true);
        setCurrentMbps(sample);
      });
      const downloadFinal = Number(downloadRate.toFixed(2));
      setDownloadMbps(downloadFinal);
      gaugeApiRef.current?.setValue(downloadFinal, true);

      setSpeedState("UPLOAD");
      setCurrentMbps(null);
      const uploadResult = await measureUpload((sample) => {
        gaugeApiRef.current?.setValue(sample, true);
        setCurrentMbps(sample);
      });
      const uploadFinal = Number(uploadResult.rate.toFixed(2));
      setUploadMbps(uploadFinal);
      gaugeApiRef.current?.setValue(uploadFinal, true);
      if (uploadResult.usedProxy) {
        setUploadNote("Upload measured via portal proxy (direct upload blocked by browser).");
      }
      setSpeedState("COMPLETE");
    } catch (error) {
      if ((error as Error)?.message === "aborted") {
        setSpeedState("IDLE");
        return;
      }
      setSpeedError((error as Error)?.message || "Unable to run speed test.");
      setSpeedState("ERROR");
    } finally {
      setCurrentMbps(null);
      setSpeedLoading(false);
    }
  };

  const stopSpeedTest = () => {
    stopRef.current = true;
    downloadAbortRef.current?.abort();
    uploadAbortRef.current?.abort();
    setSpeedLoading(false);
    setSpeedState("IDLE");
    setCurrentMbps(null);
  };

  const fetchIpInfo = async () => {
    const response = await api.get("/utils/ip");
    const data = response.data || {};
    setLocalIp(data.localIp || data.ip || "Unavailable");
    setIsp(data.isp || "Unavailable");
  };


  useEffect(() => {
    setIpLoading(true);
    setIpError(null);
    fetchIpInfo()
      .catch(() => setIpError("Unable to fetch IP address."))
      .finally(() => setIpLoading(false));
  }, []);

  useEffect(() => {
    if (!gaugeRef.current) return;
    const gauge = createSpeedGauge(gaugeRef.current, {
      maxSpeed: 100,
      unitLabel: "Mbps",
      accentColor: "#4da3ff",
      trackColor: "rgba(120,160,220,0.25)"
    });
    gaugeApiRef.current = gauge;
    return () => {
      gauge.destroy();
      gaugeApiRef.current = null;
    };
  }, []);

  return (
    <section className="card">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Services</h1>
        <p className="note">Self-service tools and ITD services in one place.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Self Services</h2>
        <p className="note">Quick tools you can run directly.</p>
      </div>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          marginBottom: "1.25rem"
        }}
      >
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Check my IP</h3>
              <p className="note">View your current network IP address.</p>
            </div>
            <button
              className="btn ghost"
              type="button"
              onClick={() => setIpExpanded((prev) => !prev)}
            >
              {ipExpanded ? "Hide details" : "Show details"}
            </button>
          </div>
          <div className="note" style={{ marginBottom: "0.5rem" }}>
            {ipLoading && "Fetching IP…"}
            {!ipLoading && ipError && "IP unavailable"}
            {!ipLoading && !ipError && localIp && (
              <>
                Local IP: <strong>{localIp}</strong>
              </>
            )}
          </div>
          {ipExpanded && (
            <>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setIpLoading(true);
                    setIpError(null);
                    fetchIpInfo()
                      .catch(() => setIpError("Unable to fetch IP address."))
                      .finally(() => setIpLoading(false));
                  }}
                  disabled={ipLoading}
                >
                  {ipLoading ? "Checking..." : "Check my IP"}
                </button>
              </div>
              {ipError && <p className="error">{ipError}</p>}
              {!ipError && (
                <p className="note">
                  ISP: <strong>{isp || "Unavailable"}</strong>
                </p>
              )}
            </>
          )}
        </div>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Speed Test</h3>
              <p className="note">Check your download and upload speed.</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setSpeedCardExpanded((prev) => !prev)}
              >
                {speedCardExpanded ? "Hide details" : "Show details"}
              </button>
            </div>
          </div>
          <div style={{ display: speedCardExpanded ? "block" : "none" }}>
            <>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                <button className="btn" type="button" onClick={runSpeedTest} disabled={speedLoading}>
                  {speedLoading ? "Testing..." : "Run speed test"}
                </button>
                {speedLoading && (
                  <button className="btn ghost" type="button" onClick={stopSpeedTest}>
                    Stop test
                  </button>
                )}
              </div>
              {speedState === "IDLE" && <p className="note">Ready to test. Click Run speed test.</p>}
              {speedState === "DOWNLOAD" && (
                <p className="note">
                  Testing download…{" "}
                  <strong>{currentMbps !== null ? currentMbps.toFixed(2) : "--"} Mbps</strong>
                </p>
              )}
              {speedState === "UPLOAD" && (
                <p className="note">
                  Testing upload…{" "}
                  <strong>{currentMbps !== null ? currentMbps.toFixed(2) : "--"} Mbps</strong>
                </p>
              )}
              {speedState === "COMPLETE" && !speedError && (
                <p className="note">
                  Test complete. Download{" "}
                  <strong>{downloadMbps !== null ? downloadMbps.toFixed(2) : "--"} Mbps</strong>, Upload{" "}
                  <strong>{uploadMbps !== null ? uploadMbps.toFixed(2) : "--"} Mbps</strong>.
                </p>
              )}
              {speedError && <p className="error">{speedError}</p>}
              <div className="speed-grid speed-grid-single">
                <div className="speed-card speed-meter">
                  <div className="speed-header">
                    <strong>
                      {speedState === "UPLOAD"
                        ? "Upload"
                        : speedState === "COMPLETE"
                          ? "Results"
                          : "Download"}
                    </strong>
                    <span>
                      Phase{" "}
                      <strong style={{ color: "var(--text)" }}>
                        {speedState === "UPLOAD"
                          ? "Upload"
                          : speedState === "DOWNLOAD"
                            ? "Download"
                            : "Idle"}
                      </strong>
                    </span>
                  </div>
                  <div ref={gaugeRef} className="speed-gauge-wrap" />
                  <div className="meter-summary">
                    <span>
                      Download: <strong>{downloadMbps !== null ? downloadMbps.toFixed(2) : "--"}</strong> Mbps
                    </span>
                    <span>
                      Upload: <strong>{uploadMbps !== null ? uploadMbps.toFixed(2) : "--"}</strong> Mbps
                    </span>
                  </div>
                </div>
              </div>
              {!speedError && uploadNote && <p className="note">{uploadNote}</p>}
              {!speedError && (downloadMbps !== null || uploadMbps !== null) && (
                <div className="note" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  {downloadMbps !== null && (
                    <span>
                      Download: <strong>{downloadMbps.toFixed(2)} Mbps</strong>
                    </span>
                  )}
                  {uploadMbps !== null && (
                    <span>
                      Upload: <strong>{uploadMbps.toFixed(2)} Mbps</strong>
                    </span>
                  )}
                </div>
              )}
            </>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>ITD Services</h2>
      </div>
      <input
        type="text"
        placeholder="Search forms"
        value={formQuery}
        onChange={(event) => setFormQuery(event.target.value)}
      />
      <div className="list forms-list">
        {forms.length === 0 && <p>No services available.</p>}
        {forms.length > 0 && filteredForms.length === 0 && <p>No services match your search.</p>}
        {filteredForms.map((form) => (
          <a key={form.id} href={form.url} target="_blank" rel="noreferrer" className="link-card form-card">
            <h4>{form.title}</h4>
            {form.description && <p>{form.description}</p>}
          </a>
        ))}
      </div>
    </section>
  );
}
