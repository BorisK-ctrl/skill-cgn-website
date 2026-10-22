/* Unterschrift auf Canvas: Striche als Pfade, Export als SVG (Base64) für Magicline. Genutzt vom Express-Abschluss. */
import { useEffect, useRef } from "react";

export function useSignaturePad(active: boolean, onStroke?: () => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<number[][][]>([]); const cur = useRef<number[][]>([]); const drawing = useRef(false);
  const cb = useRef(onStroke); cb.current = onStroke;
  useEffect(() => {
    if (!active) return; const c = canvasRef.current; if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr;
    const ctx = c.getContext("2d")!; ctx.scale(dpr, dpr); strokes.current = [];
    const pos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const down = (e: PointerEvent) => { drawing.current = true; cur.current = [pos(e)]; c.setPointerCapture(e.pointerId); e.preventDefault(); };
    const move = (e: PointerEvent) => { if (!drawing.current) return; const p = pos(e); const a = cur.current[cur.current.length - 1]; cur.current.push(p); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); e.preventDefault(); };
    const up = () => { if (drawing.current && cur.current.length > 1) { strokes.current.push(cur.current); cb.current?.(); } drawing.current = false; };
    c.addEventListener("pointerdown", down); c.addEventListener("pointermove", move); c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up); c.addEventListener("pointerleave", up);
    return () => { c.removeEventListener("pointerdown", down); c.removeEventListener("pointermove", move); c.removeEventListener("pointerup", up); c.removeEventListener("pointercancel", up); c.removeEventListener("pointerleave", up); };
  }, [active]);
  const clear = () => { strokes.current = []; const c = canvasRef.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); };
  const hasStrokes = () => strokes.current.length > 0;
  const svgBase64 = () => { const c = canvasRef.current!; const w = c.offsetWidth, h = c.offsetHeight; const paths = strokes.current.map(s => `<path d="M${s.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>`).join(""); return btoa(unescape(encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paths}</svg>`))); };
  return { canvasRef, clear, hasStrokes, svgBase64 };
}
