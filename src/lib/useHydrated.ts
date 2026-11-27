import { useSyncExternalStore } from "react";

/* false im Prerender und während React das vorgerenderte HTML übernimmt (Hydration), direkt danach true.
   Für Werte, die der Prerender nicht kennen kann (z. B. die Query): beim Hydrieren wie im Prerender rendern, sonst passt das HTML nicht
   (React-Fehler #418/#425/#422, die Seite wird komplett neu aufgebaut). Kommt die Komponente erst im Browser dazu (Seitenwechsel per Link),
   ist der Wert sofort true, ohne Umweg über den Prerender-Stand. */
const subscribe = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
