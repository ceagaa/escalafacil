import { useState, useRef, useEffect, useCallback } from "react";

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function CityCombobox({
  cidades,
  value,
  onChange,
  onValidate,
  disabled,
  loading,
}) {
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [touched, setTouched] = useState(false);
  const [valid, setValid] = useState(true);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const containerRef = useRef(null);

  const filtered = inputValue.trim()
    ? cidades.filter((c) => normalize(c.nome).includes(normalize(inputValue)))
    : cidades;

  const maxVisible = 8;
  const visibleItems = filtered.slice(0, maxVisible);

  useEffect(() => {
    setInputValue(value || "");
    setValid(true);
  }, [value]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [inputValue]);

  const validateAndClose = useCallback(
    (val) => {
      const match = cidades.find(
        (c) => normalize(c.nome) === normalize(val)
      );
      if (match) {
        onChange(match.nome);
        setValid(true);
        onValidate?.(true);
      } else if (val.trim()) {
        setValid(false);
        onValidate?.(false);
      }
      setIsOpen(false);
    },
    [cidades, onChange, onValidate]
  );

  function handleBlur() {
    setTimeout(() => {
      setIsOpen(false);
      setTouched(true);
      validateAndClose(inputValue);
    }, 150);
  }

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsOpen(true);
        setHighlightIndex(0);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < visibleItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : visibleItems.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && highlightIndex < visibleItems.length) {
        const selected = visibleItems[highlightIndex];
        setInputValue(selected.nome);
        onChange(selected.nome);
        setValid(true);
        onValidate?.(true);
        setIsOpen(false);
        inputRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  function handleSelect(cidade) {
    setInputValue(cidade.nome);
    onChange(cidade.nome);
    setValid(true);
    onValidate?.(true);
    setIsOpen(false);
    setTouched(true);
  }

  function handleChange(e) {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    if (val.trim()) {
      const match = cidades.find(
        (c) => normalize(c.nome) === normalize(val)
      );
      if (match) {
        setValid(true);
        onValidate?.(true);
      } else {
        setValid(false);
        onValidate?.(false);
      }
    } else {
      setValid(false);
      onValidate?.(false);
    }
  }

  const showInvalid = touched && inputValue.trim() && !valid;

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-slate-700">
        Cidade
      </label>
      <div className="relative mt-1">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled
              ? "Selecione a UF primeiro"
              : loading
                ? "Carregando cidades..."
                : "Digite para buscar..."
          }
          autoComplete="off"
          className={`w-full rounded-xl border px-4 py-3 pr-10 text-base outline-none transition placeholder:text-slate-400 ${
            showInvalid
              ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-200"
              : "border-slate-200 focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
          } ${disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : "bg-white"}`}
        />
        {loading && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#42d27b]" />
          </div>
        )}
        {!loading && !disabled && inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue("");
              onChange("");
              setValid(false);
              onValidate?.(false);
              inputRef.current?.focus();
            }}
            aria-label="Limpar busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <i className="fi fi-rr-cross-small text-base" aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen && !disabled && !loading && visibleItems.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {visibleItems.map((cid, index) => (
            <li key={cid.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(cid)}
                className={`flex w-full items-center px-4 py-3 text-left text-base transition ${
                  index === highlightIndex
                    ? "bg-[#42d27b]/10 text-[#172233]"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {cid.nome}
              </button>
            </li>
          ))}
          {filtered.length > maxVisible && (
            <li className="px-4 py-2 text-center text-xs text-slate-400">
              +{filtered.length - maxVisible} cidades restantes
            </li>
          )}
        </ul>
      )}

      {isOpen && !disabled && !loading && inputValue.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white p-4 text-center shadow-lg">
          <p className="text-sm text-slate-400">Nenhuma cidade encontrada</p>
        </div>
      )}

      {showInvalid && (
        <p className="mt-1.5 text-xs text-red-600">
          Por favor, selecione uma cidade válida da lista.
        </p>
      )}
    </div>
  );
}
