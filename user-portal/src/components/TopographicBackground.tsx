import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

type Vec2 = { x: number; y: number };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const v00 = hash2(xi, yi);
  const v10 = hash2(xi + 1, yi);
  const v01 = hash2(xi, yi + 1);
  const v11 = hash2(xi + 1, yi + 1);
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  const x1 = lerp(v00, v10, u);
  const x2 = lerp(v01, v11, u);
  return lerp(x1, x2, v);
}

export default function TopographicBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const resizeRef = useRef<number | null>(null);
  const drawRef = useRef<((time: number) => void) | null>(null);
  const burstUntilRef = useRef(0);
  const pointerRef = useRef<Vec2>({ x: 0, y: 0 });
  const targetRef = useRef<Vec2>({ x: 0, y: 0 });
  const tiltRef = useRef<Vec2>({ x: 0, y: 0 });
  const burstKickRef = useRef<{ x: number; y: number; start: number }>({ x: 0, y: 0, start: 0 });
  const pausedRef = useRef(false);
  const sizeRef = useRef<{ width: number; height: number; dpr: number }>({ width: 0, height: 0, dpr: 1 });
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const renderScaleRef = useRef(1);

  const location = useLocation();
  useEffect(() => {
    burstUntilRef.current = performance.now() + 900;
    const angle = Math.random() * Math.PI * 2;
    burstKickRef.current = { x: Math.cos(angle), y: Math.sin(angle), start: performance.now() };
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    if (drawRef.current) {
      requestAnimationFrame(drawRef.current);
    }
  }, [location.pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTime = performance.now();
    let grid: Float32Array | null = null;
    let gridCols = 0;
    let gridRows = 0;
    const isWindows = /Windows/i.test(navigator.userAgent);
    let reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let reducedMotionEnabled = reducedMotion?.matches ?? false;

    const marchingCases: Array<[number, number][]> = [
      [],
      [[3, 0]],
      [[0, 1]],
      [[3, 1]],
      [[1, 2]],
      [[3, 2], [0, 1]],
      [[0, 2]],
      [[3, 2]],
      [[2, 3]],
      [[0, 2]],
      [[0, 3], [1, 2]],
      [[1, 2]],
      [[1, 3]],
      [[0, 1]],
      [[3, 0]],
      []
    ];

    const getViewportSize = () => {
      const docEl = document.documentElement;
      const baseW = Math.max(window.innerWidth, docEl.clientWidth || 0);
      const baseH = Math.max(window.innerHeight, docEl.clientHeight || 0);
      if (window.visualViewport) {
        const vv = window.visualViewport;
        const vvH = vv.height + vv.offsetTop;
        return {
          w: Math.max(baseW, vv.width),
          h: Math.max(baseH, vvH)
        };
      }
      return { w: baseW, h: baseH };
    };

    const updateGrid = () => {
      const { w, h } = getViewportSize();
      const maxDpr = isWindows ? 1 : w >= 2560 ? 1 : w >= 1920 ? 1.1 : 1.25;
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { width: w, height: h, dpr };
      const renderScale = isWindows
        ? w >= 1920 ? 0.75 : 0.88
        : w >= 2560 ? 0.72 : w >= 1920 ? 0.82 : 1;
      renderScaleRef.current = renderScale;
      const offscreen = document.createElement("canvas");
      offscreen.width = Math.floor(w * renderScale);
      offscreen.height = Math.floor(h * renderScale);
      offscreenRef.current = offscreen;
      offCtxRef.current = offscreen.getContext("2d");
      grid = null;
    };

    const handleResize = () => {
      if (resizeRef.current) cancelAnimationFrame(resizeRef.current);
      resizeRef.current = requestAnimationFrame(() => {
        updateGrid();
        const now = performance.now();
        if (drawRef.current) {
          drawRef.current(now);
          lastTime = now;
        }
      });
    };

    const handleVisibility = () => {
      pausedRef.current = document.hidden;
      if (!document.hidden && rafRef.current === null) {
        lastTime = performance.now();
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const handlePointer = (event: MouseEvent) => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      targetRef.current = { x: nx, y: ny };
    };

    const handleTilt = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      const x = Math.max(-20, Math.min(20, event.gamma)) / 20;
      const y = Math.max(-20, Math.min(20, event.beta)) / 20;
      tiltRef.current = { x, y };
    };

    const forceDraw = () => {
      const now = performance.now();
      draw(now);
      lastTime = now;
    };

    updateGrid();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("scroll", handleResize);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("mousemove", handlePointer, { passive: true });
    window.addEventListener("deviceorientation", handleTilt, true);
    reducedMotion?.addEventListener?.("change", (event) => {
      reducedMotionEnabled = event.matches;
      const now = performance.now();
      if (drawRef.current) {
        drawRef.current(now);
        lastTime = now;
      }
    });

    const draw = (time: number) => {
      const { width: w, height: h, dpr } = sizeRef.current;
      const offscreen = offscreenRef.current;
      const offCtx = offCtxRef.current;
      if (!w || !h || !offscreen || !offCtx) return;
      const now = time;
      const burst = Math.max(0, burstUntilRef.current - now) / 1000;
      const boost = burst > 0 ? 1 + Math.min(burst * 0.6, 0.6) : 1;
      const t = (now * 0.00006 * boost) % 10000;

      const target = targetRef.current;
      const pointer = pointerRef.current;
      pointer.x = lerp(pointer.x, target.x, 0.08);
      pointer.y = lerp(pointer.y, target.y, 0.08);
      const tilt = tiltRef.current;
      const flow = {
        x: pointer.x * 0.4 + tilt.x * 0.2,
        y: pointer.y * 0.4 + tilt.y * 0.2
      };

      const renderScale = renderScaleRef.current;
      const wScaled = w * renderScale;
      const hScaled = h * renderScale;
      const cellSize = isWindows
        ? (w < 640 ? 18 : w < 1024 ? 20 : w >= 2560 ? 26 : 24)
        : (w < 640 ? 16 : w < 1024 ? 18 : w >= 2560 ? 22 : 20);
      const cols = Math.ceil(wScaled / cellSize) + 2;
      const rows = Math.ceil(hScaled / cellSize) + 2;
      if (!grid || gridCols !== cols || gridRows !== rows) {
        grid = new Float32Array(cols * rows);
        gridCols = cols;
        gridRows = rows;
      }

      offCtx.save();
      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.clearRect(0, 0, wScaled, hScaled);

      const computed = getComputedStyle(document.documentElement);
      const isLight = document.body?.dataset?.theme === "light";
      const baseColor = isLight
        ? (computed.getPropertyValue("--accent-2")?.trim() || "#6b88f7")
        : (computed.getPropertyValue("--accent-2")?.trim() || computed.getPropertyValue("--accent")?.trim() || "#7fb4ff");
      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = "high";
      offCtx.lineJoin = "round";
      offCtx.lineCap = "round";
      offCtx.strokeStyle = baseColor || "rgba(120,150,180,0.6)";

      const baseScale = 0.0022;
      const warpScale = 0.00125;
      const warpAmp = cellSize * 2.6;
      const kick = burstKickRef.current;
      const kickAge = Math.max(0, now - kick.start);
      const kickT = Math.max(0, 1 - kickAge / 700);
      const kickEase = kickT * kickT;
      const kickStrength = kickEase * 140;
      const offsetX = t * 7 + flow.x * 70 + kick.x * kickStrength;
      const offsetY = t * 5 + flow.y * 70 + kick.y * kickStrength;

      for (let row = 0; row < rows; row += 1) {
        const y = row * cellSize;
        for (let col = 0; col < cols; col += 1) {
          const x = col * cellSize;
          const wx = (valueNoise(x * warpScale + t * 0.05, y * warpScale + t * 0.05) - 0.5) * warpAmp;
          const wy = (valueNoise(x * warpScale + 30 + t * 0.05, y * warpScale + 30 + t * 0.05) - 0.5) * warpAmp;
          const nx = (x + offsetX + wx) * baseScale;
          const ny = (y + offsetY + wy) * baseScale;
          const v = valueNoise(nx, ny) * 0.75 + valueNoise(nx * 1.6 + 40, ny * 1.6 + 40) * 0.25;
          grid[row * cols + col] = v;
        }
      }

      const levelCount = isWindows ? (w < 640 ? 6 : 8) : (w < 640 ? 8 : 10);
      const levels: number[] = [];
      const minLevel = 0.28;
      const maxLevel = 0.86;
      for (let i = 0; i < levelCount; i += 1) {
        levels.push(minLevel + (i / (levelCount - 1)) * (maxLevel - minLevel));
      }

      for (let li = 0; li < levels.length; li += 1) {
        const iso = levels[li];
        const lineSegments: Array<{ ax: number; ay: number; bx: number; by: number }> = [];
        offCtx.lineWidth = li === levels.length - 1 ? 2.2 : 1.6;
        for (let row = 0; row < rows - 1; row += 1) {
          const y = row * cellSize;
          const y1 = y + cellSize;
          for (let col = 0; col < cols - 1; col += 1) {
            const x = col * cellSize;
            const x1 = x + cellSize;
            const v0 = grid[row * cols + col];
            const v1 = grid[row * cols + col + 1];
            const v2 = grid[(row + 1) * cols + col + 1];
            const v3 = grid[(row + 1) * cols + col];

            let index = 0;
            if (v0 > iso) index |= 1;
            if (v1 > iso) index |= 2;
            if (v2 > iso) index |= 4;
            if (v3 > iso) index |= 8;

            const segments = marchingCases[index];
            if (!segments.length) continue;

            const interp = (va: number, vb: number) => {
              const denom = vb - va;
              if (Math.abs(denom) < 1e-6) return 0.5;
              return (iso - va) / denom;
            };

            const px = [x, x1, x1, x];
            const py = [y, y, y1, y1];

            for (let si = 0; si < segments.length; si += 1) {
              const [a, b] = segments[si];
              let ax = 0;
              let ay = 0;
              let bx = 0;
              let by = 0;
              if (a === 0) {
                const tEdge = interp(v0, v1);
                ax = lerp(px[0], px[1], tEdge);
                ay = py[0];
              } else if (a === 1) {
                const tEdge = interp(v1, v2);
                ax = px[1];
                ay = lerp(py[1], py[2], tEdge);
              } else if (a === 2) {
                const tEdge = interp(v3, v2);
                ax = lerp(px[3], px[2], tEdge);
                ay = py[2];
              } else {
                const tEdge = interp(v0, v3);
                ax = px[0];
                ay = lerp(py[0], py[3], tEdge);
              }

              if (b === 0) {
                const tEdge = interp(v0, v1);
                bx = lerp(px[0], px[1], tEdge);
                by = py[0];
              } else if (b === 1) {
                const tEdge = interp(v1, v2);
                bx = px[1];
                by = lerp(py[1], py[2], tEdge);
              } else if (b === 2) {
                const tEdge = interp(v3, v2);
                bx = lerp(px[3], px[2], tEdge);
                by = py[2];
              } else {
                const tEdge = interp(v0, v3);
                bx = px[0];
                by = lerp(py[0], py[3], tEdge);
              }

              lineSegments.push({ ax, ay, bx, by });
            }
          }
        }
        offCtx.globalAlpha = Math.min(0.7, 0.32 + li * 0.035);
        offCtx.beginPath();
        for (let si = 0; si < lineSegments.length; si += 1) {
          const seg = lineSegments[si];
          const midX = (seg.ax + seg.bx) * 0.5;
          const midY = (seg.ay + seg.by) * 0.5;
          const ctrlX = midX + (seg.bx - seg.ax) * 0.15;
          const ctrlY = midY + (seg.by - seg.ay) * 0.15;
          offCtx.moveTo(seg.ax, seg.ay);
          offCtx.quadraticCurveTo(ctrlX, ctrlY, seg.bx, seg.by);
        }
        offCtx.stroke();
      }

      offCtx.globalCompositeOperation = "destination-in";
      const fadeStart = hScaled * 0.28;
      const fadeGrad = offCtx.createLinearGradient(0, fadeStart, 0, hScaled);
      fadeGrad.addColorStop(0, "rgba(0,0,0,0.5)");
      fadeGrad.addColorStop(0.35, "rgba(0,0,0,0.85)");
      fadeGrad.addColorStop(1, "rgba(0,0,0,1)");
      offCtx.fillStyle = fadeGrad;
      offCtx.fillRect(0, 0, wScaled, hScaled);

      const edgeGrad = offCtx.createRadialGradient(
        wScaled * 0.5,
        hScaled * 0.85,
        hScaled * 0.1,
        wScaled * 0.5,
        hScaled * 0.85,
        wScaled * 0.75
      );
      edgeGrad.addColorStop(0, "rgba(0,0,0,0.92)");
      edgeGrad.addColorStop(1, "rgba(0,0,0,1)");
      offCtx.fillStyle = edgeGrad;
      offCtx.fillRect(0, 0, wScaled, hScaled);
      offCtx.globalCompositeOperation = "source-over";

      offCtx.restore();

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(offscreen, 0, 0, wScaled, hScaled, 0, 0, w, h);
      ctx.restore();
    };
    drawRef.current = draw;
    const initialNow = performance.now();
    drawRef.current(initialNow);
    lastTime = initialNow;

    const loop = (time: number) => {
      if (pausedRef.current) {
        rafRef.current = window.setTimeout(() => {
          rafRef.current = requestAnimationFrame(loop);
        }, 500) as unknown as number;
        return;
      }
      if (reducedMotionEnabled) {
        const dt = time - lastTime;
        const targetFps = 2;
        if (dt > 1000 / targetFps) {
          draw(time);
          lastTime = time;
        }
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = time - lastTime;
      const targetFps = isWindows
        ? (sizeRef.current.width >= 2560 ? 18 : 24)
        : (sizeRef.current.width >= 2560 ? 26 : 36);
      if (dt > 1000 / targetFps) {
        draw(time);
        lastTime = time;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("mousemove", handlePointer);
      window.removeEventListener("deviceorientation", handleTilt);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeRef.current) window.clearTimeout(resizeRef.current);
    };
  }, []);

  return (
    <>
      <canvas className="topo-canvas" ref={canvasRef} aria-hidden="true" />
      <div className="topo-fade" aria-hidden="true" />
    </>
  );
}
