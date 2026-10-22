import type { ReactNode } from "react";

/** Seitenkopf: Kicker in Mono, Headline links, optional Lead und weitere Inhalte. */
export default function Hero({ kick, title, lead, children, className = "", titleClass = "" }: { kick?: string; title: ReactNode; lead?: ReactNode; children?: ReactNode; className?: string; titleClass?: string }) {
  return (
    <section className={`hero ${className}`}>
      <div className="wrap">
        {kick && <p className="kick">{kick}</p>}
        <h1 className={titleClass}>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
    </section>
  );
}
