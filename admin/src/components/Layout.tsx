import type { ReactNode } from "react";

export interface Section {
  id: string;
  label: string;
  badge?: number;
}

export function Layout({
  sections, active, onSelect, onLogout, children,
}: {
  sections: Section[];
  active: string;
  onSelect: (id: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <aside className="sidebar">
        <p className="sidebar__brand">Nostalgia</p>
        <p className="sidebar__sub">Διαχείριση · React</p>
        <nav className="sidebar__nav">
          {sections.map((s) => (
            <button key={s.id} className={active === s.id ? "is-active" : ""} onClick={() => onSelect(s.id)}>
              <span>{s.label}</span>
              {s.badge ? <span className="pill">{s.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar__foot">
          <a href="/" target="_blank" rel="noopener noreferrer">Προβολή site ↗</a>
          <button onClick={onLogout}>Αποσύνδεση</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
