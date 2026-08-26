import { useMemo, useState } from "react";
import type { Product } from "../lib/types";
import { actions, useAppState } from "../lib/store";
import { formatQty, formatDateTime, normalize } from "../lib/format";
import { NumericKeypad } from "../components/NumericKeypad";
import { Modal } from "../components/Modal";

export function CountPage() {
  const state = useAppState();
  const [locationId, setLocationId] = useState(state.locations[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [keypadProduct, setKeypadProduct] = useState<Product | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");

  const activeLocation = state.locations.find((l) => l.id === locationId) ?? state.locations[0];
  const activeSession = state.sessions.find((s) => s.id === state.activeSessionId);
  const sessionEntries = useMemo(
    () => state.entries.filter((e) => e.sessionId === state.activeSessionId),
    [state.entries, state.activeSessionId],
  );

  const totalsByProduct = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const entry of sessionEntries) {
      if (!map.has(entry.productId)) map.set(entry.productId, new Map());
      const byLoc = map.get(entry.productId)!;
      byLoc.set(entry.locationId, (byLoc.get(entry.locationId) ?? 0) + entry.quantidade);
    }
    return map;
  }, [sessionEntries]);

  const filteredProducts = useMemo(() => {
    const q = normalize(search);
    if (!q) return state.products;
    return state.products.filter(
      (p) => normalize(p.nome).includes(q) || (p.codigo && normalize(p.codigo).includes(q)),
    );
  }, [state.products, search]);

  const recentEntries = useMemo(
    () => [...sessionEntries].sort((a, b) => b.timestamp - a.timestamp),
    [sessionEntries],
  );

  function locationTotal(productId: string, locId: string) {
    return totalsByProduct.get(productId)?.get(locId) ?? 0;
  }

  function grandTotal(productId: string) {
    const byLoc = totalsByProduct.get(productId);
    if (!byLoc) return 0;
    let sum = 0;
    for (const v of byLoc.values()) sum += v;
    return sum;
  }

  function handleAddLocation() {
    const name = newLocationName.trim();
    if (!name) return;
    const loc = actions.addLocation(name);
    setLocationId(loc.id);
    setNewLocationName("");
    setShowAddLocation(false);
  }

  if (state.products.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>Contagem</h2>
        </div>
        <div className="empty-state">
          <p>
            Cadastre produtos na aba <strong>Produtos</strong> antes de iniciar a contagem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Contagem</h2>
          {activeSession && <p className="hint session-hint">{activeSession.label}</p>}
        </div>
        <button type="button" className="btn-icon" onClick={() => setShowHistory(true)}>
          Lançamentos ({sessionEntries.length})
        </button>
      </div>

      <div className="location-chips">
        {state.locations.map((loc) => (
          <button
            key={loc.id}
            type="button"
            className={loc.id === locationId ? "chip chip-active" : "chip"}
            onClick={() => setLocationId(loc.id)}
          >
            {loc.nome}
          </button>
        ))}
        <button type="button" className="chip chip-add" onClick={() => setShowAddLocation(true)}>
          + Local
        </button>
      </div>

      <input
        className="search-input"
        placeholder="Buscar produto por nome ou código..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredProducts.length === 0 && (
        <div className="empty-state">
          <p>Nenhum produto encontrado para "{search}".</p>
        </div>
      )}

      <ul className="product-list">
        {filteredProducts.map((p) => {
          const here = locationTotal(p.id, activeLocation?.id ?? "");
          const total = grandTotal(p.id);
          const byLoc = totalsByProduct.get(p.id);
          return (
            <li key={p.id} className="count-list-item">
              <button
                type="button"
                className="count-list-main"
                onClick={() => setKeypadProduct(p)}
              >
                <div className="product-list-info">
                  <span className="product-name">{p.nome}</span>
                  <span className="product-meta">
                    {p.codigo && <span>Cód. {p.codigo}</span>}
                    {p.unidade && <span>{p.unidade}</span>}
                  </span>
                </div>
                <div className="count-list-qty">
                  <span className="count-here">{formatQty(here)}</span>
                  <span className="count-here-label">{activeLocation?.nome}</span>
                </div>
              </button>
              {byLoc && byLoc.size > 0 && (
                <div className="count-breakdown">
                  {state.locations
                    .filter((l) => (byLoc.get(l.id) ?? 0) > 0)
                    .map((l) => (
                      <span key={l.id} className="count-badge">
                        {l.nome}: {formatQty(byLoc.get(l.id) ?? 0)}
                      </span>
                    ))}
                  <span className="count-badge count-badge-total">Total: {formatQty(total)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {keypadProduct && activeLocation && (
        <NumericKeypad
          productName={keypadProduct.nome}
          locationName={activeLocation.nome}
          currentTotal={locationTotal(keypadProduct.id, activeLocation.id)}
          onCancel={() => setKeypadProduct(null)}
          onConfirm={(value) => {
            actions.addEntry(keypadProduct.id, activeLocation.id, value);
            setKeypadProduct(null);
          }}
        />
      )}

      {showAddLocation && (
        <Modal title="Novo local de contagem" onClose={() => setShowAddLocation(false)}>
          <div className="form-grid">
            <label>
              Nome do local
              <input
                autoFocus
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="Ex: Câmara fria, Depósito 2..."
                onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
              />
            </label>
            <div className="keypad-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowAddLocation(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={handleAddLocation} disabled={!newLocationName.trim()}>
                Adicionar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showHistory && (
        <Modal title="Lançamentos desta contagem" onClose={() => setShowHistory(false)} wide>
          {recentEntries.length === 0 ? (
            <p className="hint">Nenhum lançamento ainda.</p>
          ) : (
            <ul className="history-list">
              {recentEntries.map((entry) => {
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
                    <div className="history-actions">
                      <span className="history-qty">+{formatQty(entry.quantidade)}</span>
                      <button
                        type="button"
                        className="btn-icon btn-danger"
                        onClick={() => actions.deleteEntry(entry.id)}
                      >
                        Desfazer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
