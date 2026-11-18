import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePageMeta } from "@/lib/meta";
import { usePromo } from "@/lib/blackweek";

export default function NotFound() {
  const promo = usePromo();
  usePageMeta("Seite nicht gefunden — SKILL CGN", "Diese Seite gibt es nicht.", "noindex,nofollow");
  return (
    <section className="min-h-[60vh] flex items-center border-b-4 border-primary">
      <div className="container py-24">
        <div className="inline-block bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest px-4 py-1.5 mb-6">404</div>
        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight leading-none mb-6">Diese Seite<br /><span className="text-primary">gibt es nicht.</span></h1>
        <p className="text-foreground/60 max-w-lg mb-10">Der Link ist veraltet oder vertippt. Hier geht es weiter.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/" className="inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm px-8 py-4 hover:bg-primary/90 transition-all">Zur Startseite <ArrowRight className="w-4 h-4" /></Link>
          <Link to={promo.path} className="inline-flex items-center justify-center gap-3 border-2 border-primary text-primary font-black uppercase tracking-widest text-sm px-8 py-4 hover:bg-primary hover:text-primary-foreground transition-all">{promo.cta}</Link>
        </div>
      </div>
    </section>
  );
}
