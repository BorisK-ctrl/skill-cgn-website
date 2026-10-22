import { Outlet, useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileContactBar from "@/components/MobileContactBar";
import CookieConsent from "@/components/CookieConsent";

/* Wie in manus-src/client/src/App.tsx: auf /start39 ohne Navbar, Footer und Mobile-Leiste. */
export default function Layout() {
  const pathname = useLocation().pathname.replace(/\/+$/, "") || "/";
  const hideChrome = pathname === "/start39" || pathname === "/back39" || pathname === "/vor-ort" || pathname === "/scan" || pathname === "/scan/danke";
  const ownTopPadding = pathname === "/" || hideChrome;
  return (
    <>
      {!hideChrome && <Navbar />}
      {hideChrome ? <Outlet /> : <main className={ownTopPadding ? "" : "pt-20"}><Outlet /></main>}
      {!hideChrome && <Footer />}
      {!hideChrome && <MobileContactBar />}
      <CookieConsent />
    </>
  );
}
