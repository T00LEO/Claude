import { useMemo, useState } from "react";
import type { Product } from "../lib/types";
import { actions, useAppState } from "../lib/store";
import { normalize } from "../lib/format";
import { Modal } from "../components/Modal";
import { ImportDialog } from "../components/ImportDialog";
import { SearchInput } from "../components/SearchInput";

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
  const [newEmail, setNewEmail] = useState("");

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

  function handleAddEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    actions.addAllowedEmail(email);
    setNewEmail("");
  }

  function handleRemoveEmail(email: string) {
    if (confirm(`Remover o acesso de "${email}"?`)) {
      actions.removeAllowedEmail(email);
    }
  }

  const sortedAllowedEmails = useMemo(
    () => [...state.allowedEmails].sort((a, b) => a.email.localeCompare(b.email)),
    [state.allowedEmails],
  );

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

      <SearchInput
        placeholder="Buscar por nome ou código..."
        value={search}
        onChange={setSearch}
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

      <div className="backup-box">
        <p className="hint">
          <strong>Acesso de pessoas externas.</strong> Contas @dduck.com.br já entram
          automaticamente. Pra liberar alguém sem e-mail da empresa (ex: um contador avulso),
          adicione o e-mail Google dessa pessoa aqui.
        </p>
        <div className="toolbar">
          <input
            className="search-input email-input"
            placeholder="email@gmail.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
          />
          <button type="button" className="btn-primary" onClick={handleAddEmail} disabled={!newEmail.includes("@")}>
            Liberar
          </button>
        </div>
        {sortedAllowedEmails.length > 0 && (
          <ul className="product-list allowed-emails-list">
            {sortedAllowedEmails.map((a) => (
              <li key={a.email} className="product-list-item">
                <div className="product-list-info">
                  <span className="product-name">{a.email}</span>
                </div>
                <div className="product-list-actions">
                  <button
                    type="button"
                    className="btn-icon btn-danger"
                    onClick={() => handleRemoveEmail(a.email)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
