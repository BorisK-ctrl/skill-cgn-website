import { useEffect } from "react";

/** Setzt Titel, Description, Robots und optional das OG-Bild pro Seite (Standard /img/og.jpg). */
export function usePageMeta(title: string, description: string, robots = "index,follow", image = "/img/og.jpg") {
  useEffect(() => {
    document.title = title;
    const set = (sel: string, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(sel);
      if (!el) { el = document.createElement("meta"); const [k, v] = sel.replace(/^meta\[|\]$/g, "").split("="); el.setAttribute(k, v.replace(/"/g, "")); document.head.appendChild(el); }
      el.setAttribute(attr, value);
    };
    set('meta[name="description"]', "content", description);
    set('meta[name="robots"]', "content", robots);
    set('meta[property="og:title"]', "content", title);
    set('meta[property="og:description"]', "content", description);
    const url = "https://skill-studios.com" + (location.pathname === "/" ? "/" : location.pathname.replace(/\/$/, ""));
    set('meta[property="og:url"]', "content", url);
    set('meta[property="og:image"]', "content", "https://skill-studios.com" + image);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = url;
  }, [title, description, robots, image]);
}
