import { useState } from "react";
import { Modal } from "./Modal";

interface NumericKeypadProps {
  productName: string;
  locationName: string;
  currentTotal: number;
  onConfirm: (value: number) => void;
  onCancel: () => void;
}

type Operator = "+" | "−" | "×" | "÷";

const DIGITS = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];
const OPERATORS: Operator[] = ["÷", "×", "−", "+"];
const QUICK_ADD = [1, 6, 12, 24];
const MAX_VALUE = 999999;

function parseDisplay(display: string): number {
  return Number(display.replace(",", ".")) || 0;
}

// Rounds away binary-float noise (e.g. 0.1+0.2) and drops trailing zeros —
// decimals only show up when the count actually needs them.
function formatValue(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function compute(a: number, op: Operator, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? a : a / b;
  }
}

export function NumericKeypad({
  productName,
  locationName,
  currentTotal,
  onConfirm,
  onCancel,
}: NumericKeypadProps) {
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Operator | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);

  function pressDigit(d: string) {
    if (justEvaluated) {
      setDisplay(d);
      setJustEvaluated(false);
      return;
    }
    setDisplay((cur) => {
      if (cur.includes(",")) {
        const [, frac] = cur.split(",");
        if (frac.length >= 2) return cur;
      }
      if (cur === "0") return d;
      if (cur.replace(",", "").length >= 6) return cur;
      return cur + d;
    });
  }

  function pressComma() {
    if (justEvaluated) {
      setDisplay("0,");
      setJustEvaluated(false);
      return;
    }
    setDisplay((cur) => (cur.includes(",") ? cur : cur + ","));
  }

  function backspace() {
    setDisplay((cur) => (cur.length <= 1 ? "0" : cur.slice(0, -1)));
  }

  function clear() {
    setDisplay("0");
    setStoredValue(null);
    setPendingOp(null);
    setJustEvaluated(false);
  }

  function pressOperator(op: Operator) {
    const current = parseDisplay(display);
    if (storedValue !== null && pendingOp !== null && !justEvaluated) {
      setStoredValue(compute(storedValue, pendingOp, current));
    } else {
      setStoredValue(current);
    }
    setPendingOp(op);
    setDisplay("0");
    setJustEvaluated(false);
  }

  function pressEquals() {
    if (pendingOp === null || storedValue === null) return;
    const result = compute(storedValue, pendingOp, parseDisplay(display));
    setDisplay(formatValue(Math.min(MAX_VALUE, Math.max(0, result))));
    setStoredValue(null);
    setPendingOp(null);
    setJustEvaluated(true);
  }

  function currentValue(): number {
    if (pendingOp !== null && storedValue !== null) {
      return compute(storedValue, pendingOp, parseDisplay(display));
    }
    return parseDisplay(display);
  }

  function quickAdd(units: number) {
    const next = Math.min(MAX_VALUE, currentValue() + units);
    setDisplay(formatValue(next));
    setStoredValue(null);
    setPendingOp(null);
    setJustEvaluated(true);
  }

  function confirm() {
    const value = currentValue();
    if (value <= 0) return;
    onConfirm(value);
  }

  const previewValue = currentValue();

  return (
    <Modal title={productName} onClose={onCancel}>
      <p className="keypad-subtitle">
        Local: <strong>{locationName}</strong> · já contado:{" "}
        <strong>
          {currentTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      </p>
      {pendingOp !== null && storedValue !== null && (
        <p className="keypad-expression">
          {formatValue(storedValue)} {pendingOp}
        </p>
      )}
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
        <button type="button" className="keypad-clear" onClick={clear}>
          C
        </button>
        <button type="button" className="keypad-back" onClick={backspace} aria-label="Apagar">
          ⌫
        </button>
        {OPERATORS.slice(0, 2).map((op) => (
          <button
            key={op}
            type="button"
            className={pendingOp === op ? "keypad-op keypad-op-active" : "keypad-op"}
            onClick={() => pressOperator(op)}
          >
            {op}
          </button>
        ))}
        {DIGITS.slice(0, 3).map((d) => (
          <button key={d} type="button" onClick={() => pressDigit(d)}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className={pendingOp === OPERATORS[2] ? "keypad-op keypad-op-active" : "keypad-op"}
          onClick={() => pressOperator(OPERATORS[2])}
        >
          {OPERATORS[2]}
        </button>
        {DIGITS.slice(3, 6).map((d) => (
          <button key={d} type="button" onClick={() => pressDigit(d)}>
            {d}
          </button>
        ))}
        <button
          type="button"
          className={pendingOp === OPERATORS[3] ? "keypad-op keypad-op-active" : "keypad-op"}
          onClick={() => pressOperator(OPERATORS[3])}
        >
          {OPERATORS[3]}
        </button>
        {DIGITS.slice(6, 9).map((d) => (
          <button key={d} type="button" onClick={() => pressDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="keypad-equals" onClick={pressEquals}>
          =
        </button>
        <button type="button" className="keypad-wide" onClick={() => pressDigit("0")}>
          0
        </button>
        <button type="button" className="keypad-wide" onClick={pressComma}>
          ,
        </button>
      </div>
      <div className="keypad-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={confirm} disabled={previewValue <= 0}>
          Adicionar {formatValue(previewValue)}
        </button>
      </div>
    </Modal>
  );
}
