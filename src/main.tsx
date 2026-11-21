import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/index.css";
import { initGads } from "./lib/gads";

/* /onboarding?t=…: Buchungslink aus der Mail. Token sofort aus der Adresse in sessionStorage verschieben, bevor Google Ads oder Meta Pixel die URL sehen. */
try {
  const u = new URL(window.location.href);
  if (u.pathname.replace(/\/+$/, "") === "/onboarding" && u.searchParams.get("t")) {
    sessionStorage.setItem("skill-onboarding-t", u.searchParams.get("t")!);
    u.searchParams.delete("t");
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }
} catch { /* sessionStorage gesperrt: Token bleibt in der Adresse, die Seite liest ihn dort */ }

/* SKILLTOOL2 (internes Dashboard): kein Google-Tag */
if (!/^\/skilltool2(\/|$)/.test(window.location.pathname)) initGads();

const root = document.getElementById("root")!;
const tree = <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>;
// Vorgerenderte Seiten werden hydriert, sonst normal gerendert
if (root.hasChildNodes()) ReactDOM.hydrateRoot(root, tree); else ReactDOM.createRoot(root).render(tree);
