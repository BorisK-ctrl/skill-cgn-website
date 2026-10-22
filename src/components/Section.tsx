import type { ReactNode } from "react";

type Variant = "default" | "panel" | "acc";
export default function Section({ variant = "default", id, className = "", children }: { variant?: Variant; id?: string; className?: string; children: ReactNode }) {
  const v = variant === "panel" ? "sec-panel" : variant === "acc" ? "sec-acc" : "";
  return <section id={id} className={`sec ${v} ${className}`}><div className="wrap">{children}</div></section>;
}
