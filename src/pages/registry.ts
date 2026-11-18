/* Seiten je Route nachladen (Code-Splitting). Im Browser React.lazy, beim Prerendering werden alle Seiten vorab geladen,
   damit renderToString echtes HTML liefert statt des Suspense-Fallbacks. */
import { lazy, type ComponentType } from "react";

const loaders = {
  Home: () => import("@/pages/Home"), Start39: () => import("@/pages/Start39"), Back39: () => import("@/pages/Back39"), VorOrt: () => import("@/pages/VorOrt"),
  Shop: () => import("@/pages/Shop"), Kursplan: () => import("@/pages/Kursplan"), ShopDanke: () => import("@/pages/ShopDanke"), Memberships: () => import("@/pages/Memberships"),
  Classes: () => import("@/pages/Classes"), Probetraining: () => import("@/pages/Probetraining"), Checkout: () => import("@/pages/Checkout"), Danke: () => import("@/pages/Danke"),
  Kuendigung: () => import("@/pages/Kuendigung"), KuendigungBestaetigt: () => import("@/pages/KuendigungBestaetigt"), Impressum: () => import("@/pages/Impressum"),
  Datenschutz: () => import("@/pages/Datenschutz"), Agb: () => import("@/pages/Agb"), Brand: () => import("@/pages/Brand"), NotFound: () => import("@/pages/NotFound"),
  Scan: () => import("@/pages/Scan"), ScanDanke: () => import("@/pages/ScanDanke"), PersonalTraining: () => import("@/pages/PersonalTraining"), BlackMonth: () => import("@/pages/BlackMonth"), BlackMonthDanke: () => import("@/pages/BlackMonthDanke"), BlackWeek: () => import("@/pages/BlackWeek"), BlackWeekDanke: () => import("@/pages/BlackWeekDanke"),
};
export type PageName = keyof typeof loaders;
const loaded: Partial<Record<PageName, ComponentType>> = {};
const lazyCache: Partial<Record<PageName, ComponentType>> = {};

export async function preloadAllPages() {
  for (const [k, l] of Object.entries(loaders) as [PageName, () => Promise<{ default: ComponentType }>][]) loaded[k] = (await l()).default;
}
export function page(name: PageName): ComponentType {
  return loaded[name] ?? (lazyCache[name] ||= lazy(loaders[name] as () => Promise<{ default: ComponentType<any> }>));
}
