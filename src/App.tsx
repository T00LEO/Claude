import { useEffect, useState } from "react";
import { loadState, useIsLoaded } from "./lib/store";
import { ProductsPage } from "./pages/ProductsPage";
import { CountPage } from "./pages/CountPage";
import { ReportPage } from "./pages/ReportPage";
import { HistoryPage } from "./pages/HistoryPage";

type Tab = "contagem" | "produtos" | "relatorio" | "historico";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "contagem", label: "Contagem", icon: "📋" },
  { id: "produtos", label: "Produtos", icon: "🍺" },
  { id: "relatorio", label: "Relatório", icon: "📊" },
  { id: "historico", label: "Histórico", icon: "🕘" },
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
        <img src={`${import.meta.env.BASE_URL}logo-dduck.png`} alt="DDuck" className="app-logo" />
        <h1>Controle de Estoque</h1>
      </header>

      <main className="app-main">
        {tab === "contagem" && <CountPage />}
        {tab === "produtos" && <ProductsPage />}
        {tab === "relatorio" && <ReportPage />}
        {tab === "historico" && <HistoryPage />}
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
