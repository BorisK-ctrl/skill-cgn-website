import { useEffect } from "react";

/** Setzt Titel, Description und Robots pro Seite. */
export function usePageMeta(title: string, description: string, robots = "index,follow") {
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
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = url;
  }, [title, description, robots]);
}
