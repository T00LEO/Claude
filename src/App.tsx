import { useState } from "react";
import { AuthGate } from "./components/AuthGate";
import { signOutUser, useCurrentUser } from "./lib/auth";
import { useIsLoaded } from "./lib/store";
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

function UserBadge() {
  const user = useCurrentUser();
  if (!user) return null;
  return (
    <div className="user-badge">
      {user.photoURL && <img src={user.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer" />}
      <span className="user-name">{user.displayName ?? user.email}</span>
      <button type="button" className="btn-icon" onClick={() => signOutUser()}>
        Sair
      </button>
    </div>
  );
}

function AppShell() {
  const isLoaded = useIsLoaded();
  const [tab, setTab] = useState<Tab>("contagem");

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
        <UserBadge />
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

export default function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}
