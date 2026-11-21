/* /skilltool2: Passwortseite des internen KPI-Dashboards. Ein Feld, ein Knopf. Kein Pixel, kein Google-Tag (main.tsx, Layout). */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { usePageMeta } from "@/lib/meta";

export default function Skilltool2() {
  usePageMeta("SKILLTOOL2", "Internes Dashboard.", "noindex,nofollow");
  const nav = useNavigate();
  const [pw, setPw] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pw || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/skilltool2/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }), credentials: "same-origin" });
      if (r.ok) { nav("/skilltool2/dashboard", { replace: true }); return; }
      const j = await r.json().catch(() => ({}));
      /* Meldung des Servers zeigen (503 heißt "noch nicht eingerichtet" oder "Speicher kurz gestört"), sonst nach Status */
      setErr(typeof j.error === "string" && j.error ? j.error : r.status === 429 ? "Zu viele Versuche, in einer Stunde wieder." : r.status === 401 ? "Passwort stimmt nicht." : "Gerade nicht erreichbar. Bitte gleich noch einmal.");
    } catch { setErr("Keine Verbindung. Bitte noch einmal."); }
    setBusy(false); setPw("");
  };
  return (
    <main className="min-h-screen bg-[#2A3133] px-4 py-6 text-white">
      <div className="mx-auto flex max-w-md justify-end"><img src="/img/logo-white.svg" alt="SKILL CGN" className="h-6 w-auto" width={120} height={24} /></div>
      <form onSubmit={submit} className="mx-auto mt-20 max-w-md bg-[#343C3F] p-6">
        <h1 className="font-display text-5xl uppercase leading-none">SKILLTOOL2</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-[#B8C0C3]">Internes Dashboard</p>
        <label htmlFor="st2-pw" className="mt-8 block font-mono text-[11px] uppercase tracking-[0.16em] text-[#B8C0C3]">Passwort</label>
        <input id="st2-pw" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} autoFocus
          className="mt-2 block min-h-12 w-full border border-white/20 bg-[#2A3133] px-4 text-base text-white outline-none focus:border-[#FBFF00]" />
        {err && <p role="alert" className="mt-3 border-l-4 border-[#FF4D4D] pl-3 text-sm font-bold text-white">{err}</p>}
        <button type="submit" disabled={busy || !pw} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#FBFF00] px-6 font-sans text-sm font-bold uppercase tracking-[0.14em] text-black disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Öffnen
        </button>
      </form>
    </main>
  );
}
