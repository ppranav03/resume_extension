import { useEffect, useState } from "react";
import HomeTab from "./HomeTab.jsx";
import ContactsTab from "./ContactsTab.jsx";
import ClustersTab from "./ClustersTab.jsx";
import ApplicationsTab from "./ApplicationsTab.jsx";
import Logo from "./Logo.jsx";

const TABS = [
  { id: "home", label: "Home" },
  { id: "contacts", label: "Contacts" },
  { id: "clusters", label: "Clusters" },
  { id: "applications", label: "Applications" }
];

const PANELS = {
  home: HomeTab,
  contacts: ContactsTab,
  clusters: ClustersTab,
  applications: ApplicationsTab
};

const isTab = (id) => TABS.some((t) => t.id === id);

// A #clusters / #contacts link wins over the remembered tab. A first-ever visit (nothing
// in localStorage yet) lands on Home; a returning visit resumes wherever you left off.
function savedTab() {

  // Checking if we have it in the url already
  const fromHash = window.location.hash.slice(1);
  if (isTab(fromHash)) return fromHash;

  // If not, we check the localstorage and default to home
  try {
    const id = localStorage.getItem("tab");
    return isTab(id) ? id : "home";
  } catch {
    return "home";
  }
}

export default function App() {
  const [tab, setTab] = useState(savedTab);

  // A #tab link (e.g. from the extension's dashboard button) only changes the hash if
  // the site is already open in a tab, which doesn't reload the page.
  useEffect(() => {

    const onHashChange = () => {
      const id = window.location.hash.slice(1);
      if (isTab(id)) choose(id);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
        <button className="brand" onClick={() => choose("home")} aria-label="Go to homepage">
          <Logo />
          <h1>Referral Finder</h1>
        </button>
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
        {(() => {
          const Panel = PANELS[tab];
          return <Panel />;
        })()}
      </main>
    </div>
  );
}
