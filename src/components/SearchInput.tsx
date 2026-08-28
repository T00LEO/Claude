interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({ value, onChange, placeholder, className, autoFocus }: SearchInputProps) {
  return (
    <div className={className ? `search-input-wrap ${className}` : "search-input-wrap"}>
      <input
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
      {value && (
        <button
          type="button"
          className="search-clear-btn"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
        >
          ×
        </button>
      )}
    </div>
  );
}
