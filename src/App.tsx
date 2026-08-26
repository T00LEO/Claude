import { useEffect, useState } from "react";
import { loadState, useIsLoaded } from "./lib/store";
import { ProductsPage } from "./pages/ProductsPage";
import { CountPage } from "./pages/CountPage";
import { ReportPage } from "./pages/ReportPage";

type Tab = "contagem" | "produtos" | "relatorio";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "contagem", label: "Contagem", icon: "📋" },
  { id: "produtos", label: "Produtos", icon: "🍺" },
  { id: "relatorio", label: "Relatório", icon: "📊" },
];

export default function App() {
  const isLoaded = useIsLoaded();
  const [tab, setTab] = useState<Tab>("contagem");

  useEffect(() => {
    loadState();
  }, []);

  if (!isLoaded) {
    return (
      <div className="app-loading">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Contagem de Bebidas</h1>
      </header>

      <main className="app-main">
        {tab === "contagem" && <CountPage />}
        {tab === "produtos" && <ProductsPage />}
        {tab === "relatorio" && <ReportPage />}
      </main>

      <nav className="app-tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? "tab-btn tab-btn-active" : "tab-btn"}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
