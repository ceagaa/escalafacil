import CityCombobox from "./CityCombobox";

/** Máscara de circuito: "PB008 B" → "PB-008 B". */
export function applyCircuitoMask(value) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length === 0) return "";
  const letters = raw.replace(/[0-9]/g, "");
  const digits = raw.replace(/[^0-9]/g, "");
  if (letters.length <= 2) {
    return letters + (digits ? "-" + digits : "");
  }
  const uf = letters.slice(0, 2);
  const rest = letters.slice(2);
  return uf + "-" + digits + (rest ? " " + rest : "");
}

export function maskIdentificacao(value, isAssembleia) {
  return isAssembleia ? applyCircuitoMask(value) : value.toUpperCase().slice(0, 10);
}

const INPUT_CLASS =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20";
const SELECT_CLASS = INPUT_CLASS;
const ICON_BUTTON_CLASS =
  "shrink-0 rounded-xl border border-slate-200 px-3 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-500";

/**
 * Par Estado (UF) + cidade usada no cadastro/edição de congresso.
 * Compartilhado entre os formulários de criar e editar evento.
 */
export function UfCityFields({ uf, cidade, estados, cidades, loadingCidades, disabled, onChangeUf, onChangeCidade, onValidateCidade }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700">Estado (UF)</label>
        <select
          value={uf}
          onChange={(event) => onChangeUf(event.target.value)}
          disabled={disabled}
          className={`mt-1 ${SELECT_CLASS}`}
        >
          <option value="">Selecione o estado</option>
          {estados.map((estado) => (
            <option key={estado.id} value={estado.sigla}>
              {estado.nome} ({estado.sigla})
            </option>
          ))}
        </select>
      </div>

      <CityCombobox
        cidades={cidades}
        value={cidade}
        onChange={onChangeCidade}
        onValidate={onValidateCidade}
        disabled={disabled || !uf}
        loading={loadingCidades}
      />
    </>
  );
}

/**
 * Lista de identificações (circuitos ou seções do congresso) com máscara,
 * botão de remover por linha e botão de adicionar.
 */
export function IdentificacoesFields({
  values,
  isAssembleia,
  disabled,
  onChange,
  onAdd,
  onRemove,
  addLabel,
  addHint,
}) {
  const PLACEHOLDERS = isAssembleia
    ? ["Ex: PB-008 B", "Ex: SP-138 A"]
    : ["Ex: 027 (B)", "Ex: 001 (A)"];

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {isAssembleia ? "Circuito(s)" : "Identificação do Congresso"}
      </label>
      <div className="mt-1 space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={value}
              onChange={(event) => onChange(index, event.target.value)}
              placeholder={PLACEHOLDERS[index === 0 ? 0 : 1]}
              maxLength={10}
              disabled={disabled}
              className={`${INPUT_CLASS} uppercase placeholder:normal-case`}
            />
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                className={ICON_BUTTON_CLASS}
                aria-label={`Remover identificação ${index + 1}`}
              >
                <i className="fi fi-rr-trash-small text-base" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-brand-400 transition hover:bg-brand-400/5"
      >
        <i className="fi fi-rr-plus text-[10px]" />
        {addLabel}
      </button>
      {addHint && <p className="mt-1 text-xs text-slate-400">{addHint}</p>}
    </div>
  );
}
