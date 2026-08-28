import { useMemo, useState } from "react";
import { actions, useAppState } from "../lib/store";
import { formatQty, normalize } from "../lib/format";
import { Modal } from "../components/Modal";
import { SearchInput } from "../components/SearchInput";

export function ReportPage() {
  const state = useAppState();
  const [search, setSearch] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(state.activeSessionId);
  const [showNewCount, setShowNewCount] = useState(false);
  const [newCountLabel, setNewCountLabel] = useState("");

  const sortedSessions = useMemo(
    () => [...state.sessions].sort((a, b) => b.startedAt - a.startedAt),
    [state.sessions],
  );
  const selectedSession =
    state.sessions.find((s) => s.id === selectedSessionId) ?? state.sessions[state.sessions.length - 1];
  const isActiveSession = selectedSession?.id === state.activeSessionId;

  const sessionEntries = useMemo(
    () => state.entries.filter((e) => e.sessionId === selectedSession?.id),
    [state.entries, selectedSession],
  );

  const rows = useMemo(() => {
    const totals = new Map<string, Map<string, number>>();
    for (const entry of sessionEntries) {
      if (!totals.has(entry.productId)) totals.set(entry.productId, new Map());
      const byLoc = totals.get(entry.productId)!;
      byLoc.set(entry.locationId, (byLoc.get(entry.locationId) ?? 0) + entry.quantidade);
    }
    return state.products
      .map((p) => {
        const byLoc = totals.get(p.id);
        const total = byLoc ? [...byLoc.values()].reduce((a, b) => a + b, 0) : 0;
        return { product: p, byLoc, total };
      })
      .filter((r) => {
        const q = normalize(search);
        if (!q) return true;
        return normalize(r.product.nome).includes(q) || (r.product.codigo && normalize(r.product.codigo).includes(q));
      })
      .sort((a, b) => a.product.nome.localeCompare(b.product.nome, "pt-BR"));
  }, [state.products, sessionEntries, search]);

  const summary = useMemo(() => {
    const countedProducts = rows.filter((r) => r.total > 0).length;
    const totalItems = rows.reduce((sum, r) => sum + r.total, 0);
    return { countedProducts, totalItems, entries: sessionEntries.length };
  }, [rows, sessionEntries.length]);

  function buildExportRows() {
    return rows.map((r) => {
      const row: Record<string, string | number> = {
        Código: r.product.codigo ?? "",
        Produto: r.product.nome,
        Categoria: r.product.categoria ?? "",
        Unidade: r.product.unidade ?? "",
      };
      for (const loc of state.locations) {
        row[loc.nome] = Number((r.byLoc?.get(loc.id) ?? 0).toFixed(2));
      }
      row["Total"] = Number(r.total.toFixed(2));
      return row;
    });
  }

  function exportFileBase() {
    const datePart = selectedSession ? new Date(selectedSession.startedAt).toISOString().slice(0, 10) : "";
    return `contagem-estoque-${datePart}`;
  }

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contagem");
    XLSX.writeFile(wb, `${exportFileBase()}.xlsx`);
  }

  async function exportCsv() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFileBase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openNewCount() {
    setNewCountLabel("");
    setShowNewCount(true);
  }

  function confirmNewCount() {
    const session = actions.startNewSession(newCountLabel);
    setSelectedSessionId(session.id);
    setShowNewCount(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Relatório</h2>
      </div>

      <label className="session-select-label">
        Sessão de contagem
        <select value={selectedSession?.id} onChange={(e) => setSelectedSessionId(e.target.value)}>
          {sortedSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
              {s.id === state.activeSessionId ? " (atual)" : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-value">{summary.countedProducts}</span>
          <span className="summary-label">produtos contados</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">{formatQty(summary.totalItems)}</span>
          <span className="summary-label">unidades no total</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">{summary.entries}</span>
          <span className="summary-label">lançamentos</span>
        </div>
      </div>

      <div className="toolbar">
        <button type="button" className="btn-primary" onClick={exportXlsx} disabled={!rows.length}>
          Exportar Excel
        </button>
        <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!rows.length}>
          Exportar CSV
        </button>
        <button type="button" className="btn-danger-outline" onClick={openNewCount}>
          Iniciar nova contagem
        </button>
      </div>

      {!isActiveSession && (
        <p className="hint session-readonly-hint">
          Mostrando uma contagem anterior. A contagem em andamento continua sendo a sessão "(atual)".
        </p>
      )}

      <SearchInput placeholder="Buscar produto..." value={search} onChange={setSearch} />

      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Un.</th>
              {state.locations.map((loc) => (
                <th key={loc.id}>{loc.nome}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product.id} className={r.total > 0 ? "" : "row-zero"}>
                <td>
                  {r.product.nome}
                  {r.product.codigo && <span className="hint"> · {r.product.codigo}</span>}
                </td>
                <td>{r.product.unidade ?? "—"}</td>
                {state.locations.map((loc) => (
                  <td key={loc.id}>{formatQty(r.byLoc?.get(loc.id) ?? 0)}</td>
                ))}
                <td className="report-total-cell">{formatQty(r.total)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={state.locations.length + 3} className="empty-cell">
                  Nenhum produto para exibir.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showNewCount && (
        <Modal title="Iniciar nova contagem" onClose={() => setShowNewCount(false)}>
          <div className="form-grid">
            <p className="hint">
              O cadastro de produtos é mantido. Os lançamentos da contagem atual ficam guardados no
              Histórico — nada é apagado.
            </p>
            <label>
              Nome da nova contagem
              <input
                autoFocus
                value={newCountLabel}
                onChange={(e) => setNewCountLabel(e.target.value)}
                placeholder={`Contagem de ${new Date().toLocaleDateString("pt-BR")}`}
                onKeyDown={(e) => e.key === "Enter" && confirmNewCount()}
              />
            </label>
            <div className="keypad-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowNewCount(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={confirmNewCount}>
                Iniciar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
