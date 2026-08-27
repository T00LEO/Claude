import { useMemo, useRef, useState } from "react";
import { actions, useAppState } from "../lib/store";
import { formatQty, formatDateTime, normalize } from "../lib/format";
import type { AppState } from "../lib/types";

function isBackupShape(data: unknown): data is Partial<AppState> {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.products) &&
    Array.isArray(d.locations) &&
    Array.isArray(d.sessions) &&
    Array.isArray(d.entries)
  );
}

export function HistoryPage() {
  const state = useAppState();
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const q = normalize(search);
    const bySession = new Map<string, typeof state.entries>();
    for (const entry of state.entries) {
      const product = state.products.find((p) => p.id === entry.productId);
      if (q) {
        const matches =
          (product && normalize(product.nome).includes(q)) ||
          (product?.codigo && normalize(product.codigo).includes(q));
        if (!matches) continue;
      }
      if (!bySession.has(entry.sessionId)) bySession.set(entry.sessionId, []);
      bySession.get(entry.sessionId)!.push(entry);
    }
    return state.sessions
      .map((session) => {
        const entries = (bySession.get(session.id) ?? []).sort((a, b) => b.timestamp - a.timestamp);
        const total = entries.reduce((sum, e) => sum + e.quantidade, 0);
        return { session, entries, total };
      })
      .filter((g) => g.entries.length > 0)
      .sort((a, b) => b.session.startedAt - a.session.startedAt);
  }, [state.entries, state.products, state.sessions, search]);

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-contagem-bebidas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openFilePicker() {
    setFeedback(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!isBackupShape(data)) {
        setFeedback({ ok: false, text: "Esse arquivo não parece ser um backup válido deste app." });
        return;
      }
      const summary = actions.mergeState(data);
      setFeedback({
        ok: true,
        text: `Importado: ${summary.products} produto(s), ${summary.locations} local(is), ${summary.sessions} sessão(ões) e ${summary.entries} lançamento(s) novos. O que já existia aqui foi mantido, sem duplicar.`,
      });
    } catch {
      setFeedback({ ok: false, text: "Não foi possível ler esse arquivo. Confira se é o .json exportado pelo app." });
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Histórico</h2>
        <span className="badge">{state.entries.length} lançamento(s)</span>
      </div>

      <div className="backup-box">
        <p className="hint">
          Leve os dados (produtos, locais e lançamentos) de um aparelho pro outro: exporte um arquivo aqui e
          importe no outro aparelho — pode mandar por WhatsApp, e-mail ou Drive. A importação soma ao que já
          existe, nunca apaga nada.
        </p>
        <div className="toolbar">
          <button type="button" className="btn-primary" onClick={exportBackup}>
            Exportar backup
          </button>
          <button type="button" className="btn-secondary" onClick={openFilePicker}>
            Importar backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
              e.target.value = "";
            }}
          />
        </div>
        {feedback && <p className={feedback.ok ? "success-text" : "error-text"}>{feedback.text}</p>}
      </div>

      <input
        className="search-input"
        placeholder="Buscar por produto ou código..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {groups.length === 0 && (
        <div className="empty-state">
          <p>
            {search
              ? `Nenhum lançamento encontrado para "${search}".`
              : "Nenhum lançamento registrado ainda. Comece a contar na aba Contagem."}
          </p>
        </div>
      )}

      <div className="history-groups">
        {groups.map(({ session, entries, total }, i) => (
          <details key={session.id} className="history-session" open={i === 0}>
            <summary>
              <span className="history-session-label">{session.label}</span>
              <span className="hint">
                {entries.length} lançamento(s) · {formatQty(total)} un.
              </span>
            </summary>
            <ul className="history-list">
              {entries.map((entry) => {
                const product = state.products.find((p) => p.id === entry.productId);
                const loc = state.locations.find((l) => l.id === entry.locationId);
                return (
                  <li key={entry.id} className="history-item">
                    <div>
                      <strong>{product?.nome ?? "Produto removido"}</strong>
                      <div className="hint">
                        {loc?.nome ?? "Local removido"} · {formatDateTime(entry.timestamp)}
                      </div>
                    </div>
                    <span className="history-qty">+{formatQty(entry.quantidade)}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
