import { useState } from "react";
import { Modal } from "./Modal";

interface NumericKeypadProps {
  productName: string;
  locationName: string;
  currentTotal: number;
  onConfirm: (value: number) => void;
  onCancel: () => void;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const QUICK_ADD = [1, 6, 12, 24];
const MAX_CENTS = 999999_99;

export function NumericKeypad({
  productName,
  locationName,
  currentTotal,
  onConfirm,
  onCancel,
}: NumericKeypadProps) {
  const [cents, setCents] = useState(0);

  const value = cents / 100;
  const display = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function pressDigit(d: string) {
    setCents((c) => {
      const next = c * 10 + Number(d);
      return next > MAX_CENTS ? c : next;
    });
  }

  function backspace() {
    setCents((c) => Math.floor(c / 10));
  }

  function clear() {
    setCents(0);
  }

  function quickAdd(units: number) {
    setCents((c) => Math.min(MAX_CENTS, c + units * 100));
  }

  function confirm() {
    if (value <= 0) return;
    onConfirm(value);
  }

  return (
    <Modal title={productName} onClose={onCancel}>
      <p className="keypad-subtitle">
        Local: <strong>{locationName}</strong> · já contado: <strong>{currentTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      </p>
      <div className="keypad-display" aria-live="polite">
        {display}
      </div>
      <div className="keypad-quick">
        {QUICK_ADD.map((n) => (
          <button key={n} type="button" className="keypad-quick-btn" onClick={() => quickAdd(n)}>
            +{n}
          </button>
        ))}
      </div>
      <div className="keypad-grid">
        {DIGITS.map((d) => (
          <button key={d} type="button" onClick={() => pressDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="keypad-clear" onClick={clear}>
          C
        </button>
        <button type="button" onClick={() => pressDigit("0")}>
          0
        </button>
        <button type="button" className="keypad-back" onClick={backspace} aria-label="Apagar">
          ⌫
        </button>
      </div>
      <div className="keypad-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={confirm} disabled={value <= 0}>
          Adicionar {display}
        </button>
      </div>
    </Modal>
  );
}
