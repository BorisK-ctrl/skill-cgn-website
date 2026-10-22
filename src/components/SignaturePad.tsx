import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";

export interface SignaturePadHandle { isEmpty(): boolean; clear(): void; toSvgBase64(): string }
const W = 760, H = 240;

/** Unterschriftsfeld mit Maus oder Finger. Liefert die Striche als SVG in Base64 für Magicline. */
const SignaturePad = forwardRef<SignaturePadHandle>(function SignaturePad(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<number[][][]>([]);
  const cur = useRef<number[][]>([]);
  const drawing = useRef(false);

  useEffect(() => {
    const c = canvas.current!; const ctx = c.getContext("2d")!;
    const pos = (e: MouseEvent | TouchEvent) => { const r = c.getBoundingClientRect(); const p = "touches" in e ? e.touches[0] : e; return [(p.clientX - r.left) * W / r.width, (p.clientY - r.top) * H / r.height]; };
    const start = (e: MouseEvent | TouchEvent) => { drawing.current = true; cur.current = [pos(e)]; e.preventDefault(); };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return; const p = pos(e); const a = cur.current[cur.current.length - 1]; cur.current.push(p);
      ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#000"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); e.preventDefault();
    };
    const end = () => { if (drawing.current && cur.current.length > 1) strokes.current.push(cur.current); drawing.current = false; };
    c.addEventListener("mousedown", start); c.addEventListener("touchstart", start, { passive: false });
    c.addEventListener("mousemove", move); c.addEventListener("touchmove", move, { passive: false });
    c.addEventListener("mouseup", end); c.addEventListener("mouseleave", end); c.addEventListener("touchend", end);
    return () => { c.removeEventListener("mousedown", start); c.removeEventListener("touchstart", start); c.removeEventListener("mousemove", move); c.removeEventListener("touchmove", move); c.removeEventListener("mouseup", end); c.removeEventListener("mouseleave", end); c.removeEventListener("touchend", end); };
  }, []);

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokes.current.length === 0,
    clear: () => { strokes.current = []; canvas.current!.getContext("2d")!.clearRect(0, 0, W, H); },
    toSvgBase64: () => {
      const paths = strokes.current.map(s => `<path d="M${s.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")}" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"/>`).join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${paths}</svg>`;
      return btoa(unescape(encodeURIComponent(svg)));
    },
  }));

  return <canvas ref={canvas} width={W} height={H} className="sig" aria-label="Unterschriftsfeld" />;
});
export default SignaturePad;
