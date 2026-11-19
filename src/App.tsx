import { Suspense, useEffect, useRef } from "react";
import { page } from "@/pages/registry";
import { track } from "@/lib/pixel";
import { utmParams, captureLandingSource } from "@/lib/events";
import { Routes, Route, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";

/** Bei Seitenwechsel nach oben, bei Ankerlinks zum Ziel. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  /* PageView je Seitenwechsel innerhalb der App (der erste PageView kommt beim Laden des Pixels) */
  const first = useRef(true);
  /* Klick-IDs, UTM und Quelle fürs Team beim ersten Aufruf sichern (Punkt 9), bevor ein Link der Startseite die URL ändert */
  useEffect(() => { utmParams(); captureLandingSource(); }, []);
  useEffect(() => { if (first.current) { first.current = false; return; } track("PageView"); }, [pathname]);
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return; }
    /* Seiten laden nachträglich (Code-Splitting): bis zu zwei Sekunden auf das Ankerziel warten. */
    let tries = 0; let t = 0;
    const jump = () => { const el = document.getElementById(hash.slice(1)); if (el) { el.scrollIntoView({ behavior: "instant" as ScrollBehavior }); return; } if (++tries < 40) t = window.setTimeout(jump, 50); };
    jump();
    return () => window.clearTimeout(t);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  const Home = page("Home"), Start39 = page("Start39"), Back39 = page("Back39"), VorOrt = page("VorOrt"), Shop = page("Shop"), Kursplan = page("Kursplan"), ShopDanke = page("ShopDanke"), Memberships = page("Memberships"), Classes = page("Classes"), Probetraining = page("Probetraining"), Checkout = page("Checkout"), Danke = page("Danke"), Kuendigung = page("Kuendigung"), KuendigungBestaetigt = page("KuendigungBestaetigt"), Impressum = page("Impressum"), Datenschutz = page("Datenschutz"), Agb = page("Agb"), Brand = page("Brand"), NotFound = page("NotFound"), Scan = page("Scan"), ScanDanke = page("ScanDanke"), PersonalTraining = page("PersonalTraining"), BlackMonth = page("BlackMonth"), BlackMonthDanke = page("BlackMonthDanke"), BlackWeek = page("BlackWeek"), BlackWeekDanke = page("BlackWeekDanke"), Onboarding = page("Onboarding");
  return (
    <>
      <ScrollManager />
      <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/start39" element={<Start39 />} />
          <Route path="/back39" element={<Back39 />} />
          <Route path="/vor-ort" element={<VorOrt />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/scan/danke" element={<ScanDanke />} />
          <Route path="/memberships" element={<Memberships />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/probetraining" element={<Probetraining />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/personal-training" element={<PersonalTraining />} />
          <Route path="/blackmonth" element={<BlackMonth />} />
          <Route path="/blackmonth/danke" element={<BlackMonthDanke />} />
          <Route path="/blackweek" element={<BlackWeek />} />
          <Route path="/blackweek/danke" element={<BlackWeekDanke />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/kursplan" element={<Kursplan />} />
          <Route path="/shop/danke" element={<ShopDanke />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/danke" element={<Danke />} />
          <Route path="/kuendigung" element={<Kuendigung />} />
          <Route path="/kuendigung-bestaetigt" element={<KuendigungBestaetigt />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
          <Route path="/agb" element={<Agb />} />
          <Route path="/brand" element={<Brand />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </>
  );
}
