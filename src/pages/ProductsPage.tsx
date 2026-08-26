import { useMemo, useState } from "react";
import type { Product } from "../lib/types";
import { actions, useAppState } from "../lib/store";
import { normalize } from "../lib/format";
import { Modal } from "../components/Modal";
import { ImportDialog } from "../components/ImportDialog";

function ProductForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Product;
  onSave: (input: Omit<Product, "id">) => void;
  onCancel: () => void;
}) {
  const [codigo, setCodigo] = useState(initial?.codigo ?? "");
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [categoria, setCategoria] = useState(initial?.categoria ?? "");
  const [unidade, setUnidade] = useState(initial?.unidade ?? "un");

  function submit() {
    if (!nome.trim()) return;
    onSave({
      codigo: codigo.trim() || undefined,
      nome: nome.trim(),
      categoria: categoria.trim() || undefined,
      unidade: unidade.trim() || undefined,
    });
  }

  return (
    <div className="form-grid">
      <label>
        Nome do produto *
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Cerveja Pilsen 600ml" autoFocus />
      </label>
      <label>
        Código / SKU
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Opcional" />
      </label>
      <label>
        Categoria
        <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: Cerveja, Refrigerante..." />
      </label>
      <label>
        Unidade
        <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex: garrafa, litro, un, caixa" />
      </label>
      <div className="keypad-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={submit} disabled={!nome.trim()}>
          Salvar
        </button>
      </div>
    </div>
  );
}

export function ProductsPage() {
  const state = useAppState();
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return state.products;
    return state.products.filter(
      (p) => normalize(p.nome).includes(q) || (p.codigo && normalize(p.codigo).includes(q)),
    );
  }, [state.products, search]);

  function handleDelete(p: Product) {
    if (confirm(`Remover "${p.nome}" do cadastro? Isso também apaga os lançamentos de contagem dele.`)) {
      actions.deleteProduct(p.id);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Produtos</h2>
        <span className="badge">{state.products.length} cadastrado(s)</span>
      </div>

      <div className="toolbar">
        <button type="button" className="btn-primary" onClick={() => setShowImport(true)}>
          Importar planilha
        </button>
        <button type="button" className="btn-secondary" onClick={() => setShowAdd(true)}>
          + Adicionar manual
        </button>
      </div>

      <input
        className="search-input"
        placeholder="Buscar por nome ou código..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 && (
        <div className="empty-state">
          {state.products.length === 0 ? (
            <p>
              Nenhum produto cadastrado ainda. Use <strong>Importar planilha</strong> para cadastrar vários
              produtos de uma vez, ou adicione manualmente.
            </p>
          ) : (
            <p>Nenhum produto encontrado para "{search}".</p>
          )}
        </div>
      )}

      <ul className="product-list">
        {filtered.map((p) => (
          <li key={p.id} className="product-list-item">
            <div className="product-list-info">
              <span className="product-name">{p.nome}</span>
              <span className="product-meta">
                {p.codigo && <span>Cód. {p.codigo}</span>}
                {p.categoria && <span>{p.categoria}</span>}
                {p.unidade && <span>{p.unidade}</span>}
              </span>
            </div>
            <div className="product-list-actions">
              <button type="button" className="btn-icon" onClick={() => setEditing(p)} aria-label="Editar">
                Editar
              </button>
              <button type="button" className="btn-icon btn-danger" onClick={() => handleDelete(p)} aria-label="Excluir">
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showImport && (
        <ImportDialog onImport={(rows) => actions.importProducts(rows)} onClose={() => setShowImport(false)} />
      )}

      {showAdd && (
        <Modal title="Novo produto" onClose={() => setShowAdd(false)}>
          <ProductForm
            onSave={(input) => {
              actions.addProduct(input);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Editar produto" onClose={() => setEditing(null)}>
          <ProductForm
            initial={editing}
            onSave={(input) => {
              actions.updateProduct(editing.id, input);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
