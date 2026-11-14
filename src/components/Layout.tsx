import { Outlet, useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileContactBar from "@/components/MobileContactBar";
import CookieConsent from "@/components/CookieConsent";
import BlackMonthBanner from "@/components/BlackMonthBanner";
import { useBlackMonthActive } from "@/lib/blackmonth";

/* Wie in manus-src/client/src/App.tsx: auf /start39 ohne Navbar, Footer und Mobile-Leiste.
   Black-Month-Banner auf allen Seiten mit Navbar (bis 30.11.2026); er sitzt unter der festen Navbar und ersetzt so lange das pt-20 der Seite. */
export default function Layout() {
  const pathname = useLocation().pathname.replace(/\/+$/, "") || "/";
  const hideChrome = pathname === "/start39" || pathname === "/back39" || pathname === "/blackmonth" || pathname === "/blackmonth/danke" || pathname === "/vor-ort" || pathname === "/scan" || pathname === "/scan/danke";
  /* Auf /onboarding hat der Kunde schon gekauft: kein Aktionsbanner */
  const blackMonth = useBlackMonthActive() && pathname !== "/onboarding";
  const ownTopPadding = pathname === "/" || hideChrome || blackMonth;
  return (
    <>
      {!hideChrome && <Navbar />}
      {!hideChrome && blackMonth && <BlackMonthBanner />}
      {hideChrome ? <Outlet /> : <main className={ownTopPadding ? "" : "pt-20"}><Outlet /></main>}
      {!hideChrome && <Footer />}
      {!hideChrome && <MobileContactBar />}
      {pathname !== "/vor-ort" && <CookieConsent />}
    </>
  );
}
