/* Server-Einstieg für das Prerendering: rendert eine Route zu statischem HTML. */
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import App from "./App";
import { preloadAllPages } from "./pages/registry";
export { ROUTES, SITE_URL } from "./routes";
import { jsonLdCollector, resetJsonLd } from "./lib/jsonld";

export async function render(url: string): Promise<{ html: string; jsonLd: string[] }> {
  await preloadAllPages();
  resetJsonLd();
  const html = renderToString(
    <React.StrictMode><StaticRouter location={url}><App /></StaticRouter></React.StrictMode>
  );
  return { html, jsonLd: [...jsonLdCollector] };
}
