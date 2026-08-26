import { useMemo, useState } from "react";
import { actions, useAppState } from "../lib/store";
import { formatQty, normalize } from "../lib/format";

export function ReportPage() {
  const state = useAppState();
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const totals = new Map<string, Map<string, number>>();
    for (const entry of state.entries) {
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
  }, [state.products, state.entries, search]);

  const summary = useMemo(() => {
    const countedProducts = rows.filter((r) => r.total > 0).length;
    const totalItems = rows.reduce((sum, r) => sum + r.total, 0);
    return { countedProducts, totalItems, entries: state.entries.length };
  }, [rows, state.entries.length]);

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

  async function exportXlsx() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contagem");
    XLSX.writeFile(wb, `contagem-estoque-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportCsv() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contagem-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleNewCount() {
    if (
      confirm(
        "Iniciar uma nova contagem apaga todos os lançamentos atuais (o cadastro de produtos é mantido). Exporte antes se ainda não exportou. Continuar?",
      )
    ) {
      actions.clearEntries();
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Relatório</h2>
      </div>

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
        <button type="button" className="btn-danger-outline" onClick={handleNewCount} disabled={!state.entries.length}>
          Nova contagem
        </button>
      </div>

      <input
        className="search-input"
        placeholder="Buscar produto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

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
    </div>
  );
}
