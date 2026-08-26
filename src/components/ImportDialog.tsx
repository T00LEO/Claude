import { useState } from "react";
import { Modal } from "./Modal";
import type { ProductInput } from "../lib/store";

interface ImportDialogProps {
  onImport: (rows: ProductInput[]) => { imported: number; updated: number };
  onClose: () => void;
}

interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
}

const NONE = "__none__";

function guessColumn(headers: string[], keywords: string[]): string {
  const found = headers.find((h) => keywords.some((k) => h.toLowerCase().includes(k)));
  return found ?? NONE;
}

export function ImportDialog({ onImport, onClose }: ImportDialogProps) {
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState({ codigo: NONE, nome: NONE, categoria: NONE, unidade: NONE });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; updated: number } | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!rows.length) {
        setError("A planilha está vazia.");
        setSheet(null);
        return;
      }
      const headers = Object.keys(rows[0]);
      setSheet({ headers, rows, fileName: file.name });
      setMapping({
        codigo: guessColumn(headers, ["codigo", "código", "sku", "cod"]),
        nome: guessColumn(headers, ["nome", "produto", "descri", "item"]),
        categoria: guessColumn(headers, ["categoria", "tipo", "grupo", "familia"]),
        unidade: guessColumn(headers, ["unidade", "unid", "medida", "un"]),
      });
    } catch {
      setError("Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv.");
      setSheet(null);
    }
  }

  function confirmImport() {
    if (!sheet) return;
    if (mapping.nome === NONE) {
      setError("Selecione qual coluna contém o nome do produto.");
      return;
    }
    setError(null);
    const parsed: ProductInput[] = sheet.rows
      .map((r) => ({
        codigo: mapping.codigo !== NONE ? String(r[mapping.codigo] ?? "").trim() || undefined : undefined,
        nome: String(r[mapping.nome] ?? "").trim(),
        categoria:
          mapping.categoria !== NONE ? String(r[mapping.categoria] ?? "").trim() || undefined : undefined,
        unidade: mapping.unidade !== NONE ? String(r[mapping.unidade] ?? "").trim() || undefined : undefined,
      }))
      .filter((r) => r.nome);
    if (!parsed.length) {
      setError("Nenhuma linha com nome válido foi encontrada.");
      return;
    }
    const res = onImport(parsed);
    setResult(res);
  }

  return (
    <Modal title="Importar produtos de planilha" onClose={onClose} wide>
      {!sheet && (
        <div className="import-drop">
          <p>Selecione um arquivo .xlsx, .xls ou .csv com seus produtos.</p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <p className="hint">
            Dica: a planilha pode ter colunas como Código, Nome, Categoria e Unidade — nessa ordem ou não,
            você mapeia a seguir.
          </p>
        </div>
      )}

      {sheet && !result && (
        <div>
          <p className="hint">
            Arquivo: <strong>{sheet.fileName}</strong> · {sheet.rows.length} linha(s) encontrada(s)
          </p>
          <div className="mapping-grid">
            <label>
              Nome do produto *
              <select
                value={mapping.nome}
                onChange={(e) => setMapping((m) => ({ ...m, nome: e.target.value }))}
              >
                <option value={NONE}>— selecione —</option>
                {sheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Código / SKU
              <select
                value={mapping.codigo}
                onChange={(e) => setMapping((m) => ({ ...m, codigo: e.target.value }))}
              >
                <option value={NONE}>— nenhuma —</option>
                {sheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoria
              <select
                value={mapping.categoria}
                onChange={(e) => setMapping((m) => ({ ...m, categoria: e.target.value }))}
              >
                <option value={NONE}>— nenhuma —</option>
                {sheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unidade
              <select
                value={mapping.unidade}
                onChange={(e) => setMapping((m) => ({ ...m, unidade: e.target.value }))}
              >
                <option value={NONE}>— nenhuma —</option>
                {sheet.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Unidade</th>
                </tr>
              </thead>
              <tbody>
                {sheet.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    <td>{mapping.codigo !== NONE ? String(r[mapping.codigo] ?? "") : "—"}</td>
                    <td>{mapping.nome !== NONE ? String(r[mapping.nome] ?? "") : "—"}</td>
                    <td>{mapping.categoria !== NONE ? String(r[mapping.categoria] ?? "") : "—"}</td>
                    <td>{mapping.unidade !== NONE ? String(r[mapping.unidade] ?? "") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="keypad-actions">
            <button type="button" className="btn-secondary" onClick={() => setSheet(null)}>
              Trocar arquivo
            </button>
            <button type="button" className="btn-primary" onClick={confirmImport}>
              Importar {sheet.rows.length} linha(s)
            </button>
          </div>
        </div>
      )}

      {result && (
        <div>
          <p className="success-text">
            Importação concluída: {result.imported} produto(s) novo(s) e {result.updated} atualizado(s).
          </p>
          <div className="keypad-actions">
            <button type="button" className="btn-primary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
