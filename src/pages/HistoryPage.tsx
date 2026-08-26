import { useMemo, useState } from "react";
import { useAppState } from "../lib/store";
import { formatQty, formatDateTime, normalize } from "../lib/format";

export function HistoryPage() {
  const state = useAppState();
  const [search, setSearch] = useState("");

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

  return (
    <div className="page">
      <div className="page-header">
        <h2>Histórico</h2>
        <span className="badge">{state.entries.length} lançamento(s)</span>
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
