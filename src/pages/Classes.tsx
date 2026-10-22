/* SKILL CGN — Classes (manus-src/client/src/pages/Classes.tsx, optisch 1:1). Feste deutsche Texte, Assets aus /img/manus. */
import { useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, Loader2, Zap, Dumbbell, Flame, Trophy } from "lucide-react";
import { trackCta } from "@/lib/events";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/lib/meta";
import { COURSE_SHORT_DESCRIPTIONS } from "@/lib/courseDescriptions";

const WIDGET_URL = "https://widgets.mywellness.com/facility/gymzzkoeln";

function ClassesWidget() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full border-2 border-foreground/10 overflow-hidden bg-background" style={{ minHeight: "680px" }}>
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background z-10">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-foreground/40">Kursplan wird geladen...</p>
        </div>
      )}
      <iframe src={WIDGET_URL} title="SKILL CGN — Live Kursplan" className="w-full" style={{ height: "680px", border: "none", display: "block" }} onLoad={() => setLoaded(true)} allow="fullscreen" loading="lazy" />
    </div>
  );
}

const formats = [
  { id: "01", name: "SKILL I", anchor: "skill-i", tag: "Build Your Base", level: "Level 01", icon: Zap, pillars: { power: 25, agility: 25, speed: 25, endurance: 25 }, desc: COURSE_SHORT_DESCRIPTIONS.SKILL_I, equipment: ["SkillRun", "SkillRow", "SkillSki", "SkillBike", "Kurzhanteln", "Kettlebells", "Slam Balls", "Medizinbälle", "Bodyweight"], tags: ["Power", "Agility", "Speed", "Endurance"] },
  { id: "02", name: "SKILL II", anchor: "skill-ii", tag: "Level Up", level: "Level 02", icon: Zap, pillars: { power: 30, agility: 20, speed: 25, endurance: 25 }, desc: COURSE_SHORT_DESCRIPTIONS.SKILL_II, equipment: ["SkillRun", "SkillRow", "SkillSki", "SkillBike", "Kurzhanteln", "Kettlebells", "Slam Balls", "Medizinbälle"], tags: ["Fast Transitions", "Strength", "Endurance", "Conditioning"] },
  { id: "03", name: "HYROX", anchor: "hyrox", tag: "Race Day Prep", level: "Level 02", icon: Trophy, pillars: { power: 25, agility: 0, speed: 25, endurance: 50 }, desc: COURSE_SHORT_DESCRIPTIONS.HYROX, equipment: ["Ski Erg", "Sled Push", "Sled Pull", "Wall Balls", "Rower", "Sandbags", "Kettlebells", "Running"], tags: ["Ski Erg", "Sled Push", "Sled Pull", "Wall Balls", "Rowing", "Running", "Sandbag Lunges"] },
  { id: "04", name: "RAW", anchor: "raw", tag: "Langhantel Training", level: "Level 02", icon: Dumbbell, pillars: { power: 50, agility: 0, speed: 25, endurance: 25 }, desc: COURSE_SHORT_DESCRIPTIONS.RAW, equipment: ["Langhantel", "Bumper Plates", "Squat Rack", "Kurzhanteln", "Kettlebells"], tags: ["Clean", "Squat", "Deadlift", "Press", "Power Clean", "Front Squat"] },
  { id: "05", name: "ATHX", anchor: "athx", tag: "Hybrid Competition", level: "Level 03", icon: Flame, pillars: { power: 30, agility: 15, speed: 25, endurance: 30 }, desc: COURSE_SHORT_DESCRIPTIONS.ATHX, equipment: ["Langhantel", "Bumper Plates", "Kettlebells", "Wall Balls", "Sandbags", "Sled", "Plyo Box", "Rower", "Ski Erg", "Kurzhanteln"], tags: ["Strength", "Endurance", "MetCon", "Barbell", "Ski Erg", "Sandbag"] },
];

const badge = "inline-block bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest px-4 py-1.5 mb-5";
const chip = "inline-block bg-foreground/5 text-foreground/60 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 hover:bg-primary/10 hover:text-primary transition-colors no-underline";

function Connector() {
  return (
    <>
      <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-primary items-center justify-center"><ArrowRight className="w-4 h-4 text-primary-foreground" /></div>
      <div className="md:hidden flex justify-center py-4"><div className="w-8 h-8 bg-primary flex items-center justify-center rotate-90"><ArrowRight className="w-4 h-4 text-primary-foreground" /></div></div>
    </>
  );
}

export default function Classes() {
  usePageMeta("Kurse in Köln: HYROX, SKILL, RAW, ATHX — SKILL CGN", "Gecoachte Kurse im Fitnessstudio Köln Neumarkt: HYROX, SKILL I und II, RAW, ATHX. Kursplan live, Buchung online, Probetraining kostenlos.");
  return (
    <div id="top" className="min-h-screen bg-background text-foreground">

      {/* ── CINEMATIC HERO ── */}
      <section className="relative overflow-hidden min-h-[85vh] md:min-h-[90vh] flex flex-col justify-end">
        <div className="absolute inset-0 z-0">
          <video className="w-full h-full object-cover object-center" autoPlay muted loop playsInline preload="auto">
            <source src="/img/manus/0626-v4_605a539c.mp4" type="video/mp4" />
            <source src="/img/manus/0626-v4_51a810bf.mov" type="video/quicktime" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')" }} />
        </div>
        <div className="relative z-10 flex-1 flex flex-col justify-start pt-8 md:pt-12">
          <div className="container">
            <Link to="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-black uppercase text-xs tracking-widest"><ArrowLeft className="w-4 h-4" /> Zurück</Link>
          </div>
        </div>
        <div className="relative z-10 pb-8 md:pb-12">
          <div className="container">
            <div className="mb-8 md:mb-10">
              <div className="inline-block bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 mb-4">Kursangebot</div>
              <h1 className="text-6xl md:text-8xl lg:text-9xl font-black uppercase tracking-tighter leading-[0.85] mb-4 text-white">UNSERE<br /><span className="text-primary">KURSE</span><span className="mt-4 block font-mono text-xs font-bold tracking-[0.22em] text-white/60 md:text-sm">Kurse in Köln · HYROX · SKILL · RAW · ATHX</span></h1>
              <p className="text-white/60 max-w-md text-sm md:text-base leading-relaxed font-medium">5 Formate. 1 System. Jedes Format hat einen klaren Fokus — zusammen bringen sie dich auf jedes Level.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
              {formats.map(f => (
                <a key={f.id} href={`#format-${f.anchor}`} className="relative bg-black/60 backdrop-blur-md border border-white/10 p-4 md:p-5 hover:border-primary hover:bg-black/70 transition-all duration-300 group cursor-pointer no-underline">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors"><f.icon className="w-4 h-4 text-primary" /></div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 group-hover:text-primary/60 transition-colors">{f.id}</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mb-1 group-hover:text-primary transition-colors">{f.name}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{f.tag}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary z-20" />
      </section>

      {/* ── YOUR JOURNEY ── */}
      <section className="py-20 bg-card border-b border-foreground/10">
        <div className="container">
          <div className="mb-14">
            <div className={badge}>Dein Weg</div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none mb-4">Start here.<br /><span className="text-primary">Level up.</span></h2>
            <p className="text-foreground/50 max-w-2xl text-sm leading-relaxed">Egal wo du stehst — bei SKILL gibt es einen klaren Weg nach oben. Kein Raten, kein Chaos. Du startest, du wächst, du performst.</p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-0">
            <div className="relative border-2 border-foreground/10 p-8 md:p-10 hover:border-primary/30 transition-colors">
              <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-foreground/30">Level 01</div>
              <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-6"><Zap className="w-6 h-6 text-primary" /></div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Build your base.</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Hybrid Bootcamp</p>
              <p className="text-foreground/60 text-sm leading-relaxed mb-4">{COURSE_SHORT_DESCRIPTIONS.SKILL_I}</p>
              <a href="#format-skill-i" className={chip}>→ SKILL I</a>
              <Connector />
            </div>
            <div className="relative border-2 border-foreground/10 p-8 md:p-10 hover:border-primary/30 transition-colors">
              <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-foreground/30">Level 02</div>
              <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-6"><Zap className="w-6 h-6 text-primary" /></div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Raise the pace.</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">SKILL II</p>
              <p className="text-foreground/60 text-sm leading-relaxed mb-4">{COURSE_SHORT_DESCRIPTIONS.SKILL_II}</p>
              <a href="#format-skill-ii" className={chip}>→ SKILL II</a>
              <Connector />
            </div>
            <div className="relative border-2 border-foreground/10 p-8 md:p-10 hover:border-primary/30 transition-colors">
              <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-foreground/30">Level 03</div>
              <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-6"><Trophy className="w-6 h-6 text-primary" /></div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Choose your focus.</h3>
              <p className="text-foreground/60 text-sm leading-relaxed mb-4">HYROX entwickelt deine Race Performance aus Running und acht Stationen. RAW baut Kraft, Technik und explosive Langhantel-Power auf.</p>
              <div className="flex gap-2"><a href="#format-hyrox" className={chip}>→ HYROX</a><a href="#format-raw" className={chip}>→ RAW</a></div>
            </div>
            <div className="relative border-2 border-primary/30 p-8 md:p-10 bg-primary/5">
              <div className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest text-primary">Level 04</div>
              <div className="w-12 h-12 bg-primary/20 flex items-center justify-center mb-6"><Flame className="w-6 h-6 text-primary" /></div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Own the floor.</h3>
              <p className="text-foreground/60 text-sm leading-relaxed mb-4">{COURSE_SHORT_DESCRIPTIONS.ATHX}</p>
              <a href="#format-athx" className="inline-block bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 hover:bg-primary/20 transition-colors no-underline">→ ATHX</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FORMAT DETAILS ── */}
      <section className="py-20 bg-background border-b border-foreground/10">
        <div className="container">
          <div className="mb-14">
            <div className={badge}>Alle Formate</div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight leading-none">Know what<br />you're <span className="text-primary">signing up for.</span></h2>
          </div>
          <div className="space-y-0">
            {formats.map(f => (
              <div key={f.id} id={`format-${f.anchor}`} className="border-b border-foreground/10 py-10 md:py-12 group hover:bg-card/50 transition-colors px-4 md:px-8 -mx-4 md:-mx-8 scroll-mt-24">
                {f.anchor === "hyrox" && (
                  <div id="hyrox" className="scroll-mt-24 mb-8 flex flex-col gap-4 border-2 border-primary bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">HYROX Official Gym Köln</p><p className="mt-1 text-sm text-foreground/70">Race Day Prep mit Coach: acht Stationen, Running, offizielle Schlitten. Erst testen, dann entscheiden.</p></div>
                    <Link to="/probetraining" onClick={() => trackCta("cta_probetraining_hyrox")} className="inline-flex shrink-0 items-center justify-center gap-2 bg-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90">Kostenloses Probetraining <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                )}
                <div className="grid md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-start">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl md:text-5xl font-black text-foreground/10 group-hover:text-primary/30 transition-colors">{f.id}</span>
                    <div className="w-10 h-10 bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors"><f.icon className="w-5 h-5 text-primary" /></div>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight">{f.name}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-3 py-1">{f.tag}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-foreground/5 text-foreground/40 px-3 py-1">{f.level}</span>
                    </div>
                    <p className="text-foreground/60 text-sm leading-relaxed mb-5 max-w-2xl">{f.desc}</p>
                    <div className="mb-5 max-w-md">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30 mb-3">Trainingsverteilung</p>
                      <div className="space-y-2">
                        {([["power", "Power"], ["agility", "Agility"], ["speed", "Speed"], ["endurance", "Endurance"]] as const).map(([key, label]) => {
                          const value = f.pillars[key]; if (value === 0) return null;
                          return (
                            <div key={key} className="flex items-center gap-3">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 w-20 text-right">{label}</span>
                              <div className="flex-1 h-2 bg-foreground/5 overflow-hidden"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${value}%` }} /></div>
                              <span className="text-[10px] font-black text-primary w-8">{value}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mb-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30 mb-2">Equipment</p>
                      <div className="flex flex-wrap gap-1.5">{f.equipment.map(e => <span key={e} className="text-[10px] font-bold uppercase tracking-widest bg-foreground/5 text-foreground/50 px-2 py-1 border border-foreground/5">{e}</span>)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">{f.tags.map(t => <span key={t} className="text-[10px] font-bold uppercase tracking-widest bg-primary/5 text-primary/60 px-2 py-1">{t}</span>)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE KURSPLAN WIDGET ── */}
      <section className="py-12 bg-background">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <div className="inline-block bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest px-4 py-1.5 mb-3">Live-Kursplan</div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-none">Kurs direkt <span className="text-primary">buchen</span></h2>
            </div>
            <a href={WIDGET_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-2 border-foreground/20 hover:border-primary text-foreground/60 hover:text-primary px-5 py-3 font-black uppercase text-xs tracking-widest transition-all duration-200 flex-shrink-0"><ExternalLink className="w-4 h-4" /> Im Browser öffnen</a>
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-5 p-4 bg-card border border-foreground/10">
            <div className="flex items-center gap-2 text-xs text-foreground/50 font-bold uppercase tracking-wide"><CalendarDays className="w-4 h-4 text-primary" /> Immer aktuell — direkt aus unserem System</div>
            <div className="ml-auto flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-xs font-black uppercase tracking-widest text-green-500">Live</span></div>
          </div>
          <ClassesWidget />
          <p className="text-center text-xs text-foreground/30 mt-4">Probleme beim Laden? <a href={WIDGET_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">Kursplan direkt öffnen →</a></p>
        </div>
      </section>

      {/* USC-Hinweis, schmal, ohne Knopf */}
      <section className="border-t border-foreground/10 bg-card py-5">
        <div className="container"><p className="text-center text-xs text-foreground/50">Du hast Urban Sports? Dann findest du unsere Classes in der USC App.</p></div>
      </section>
    </div>
  );
}
