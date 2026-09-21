import { useState } from "react";
import ContactsTab from "./ContactsTab.jsx";
import ClustersTab from "./ClustersTab.jsx";

const TABS = [
  { id: "contacts", label: "Contacts" },
  { id: "clusters", label: "Clusters" }
];

const isTab = (id) => TABS.some((t) => t.id === id);

// A #clusters / #contacts link wins over the remembered tab.
function savedTab() {
  const fromHash = window.location.hash.slice(1);
  if (isTab(fromHash)) return fromHash;
  try {
    const id = localStorage.getItem("tab");
    return isTab(id) ? id : "contacts";
  } catch {
    return "contacts";
  }
}

export default function App() {
  const [tab, setTab] = useState(savedTab);

  function choose(id) {
    setTab(id);
    try {
      localStorage.setItem("tab", id);
    } catch {
      // Storage can be blocked; the tab just won't be remembered.
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Referral Finder</h1>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => choose(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <main id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "contacts" ? <ContactsTab /> : <ClustersTab />}
      </main>
    </div>
  );
}
