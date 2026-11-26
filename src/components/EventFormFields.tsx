import CityCombobox from "./CityCombobox";
import type { Cidade, Estado } from "../types";

/** Máscara de circuito: "PB008 B" → "PB-008 B". */
export function applyCircuitoMask(value: string): string {
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

export function maskIdentificacao(value: string, isAssembleia: boolean): string {
  return isAssembleia ? applyCircuitoMask(value) : value.toUpperCase().slice(0, 10);
}

const INPUT_CLASS = "ef-input";
const SELECT_CLASS = "ef-select";
const ICON_BUTTON_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-input border border-[var(--ef-border)] bg-[var(--ef-tile)] text-[var(--ef-muted)] transition hover:border-[var(--ef-danger)] hover:bg-[var(--ef-danger-soft)] hover:text-[var(--ef-danger)] disabled:opacity-50";

interface UfCityFieldsProps {
  uf: string;
  cidade: string;
  estados: Estado[];
  cidades: Cidade[];
  loadingCidades?: boolean;
  disabled?: boolean;
  onChangeUf: (value: string) => void;
  onChangeCidade: (value: string) => void;
  onValidateCidade?: (valid: boolean) => void;
}

/**
 * Par Estado (UF) + cidade usada no cadastro/edição de congresso.
 * Compartilhado entre os formulários de criar e editar evento.
 */
export function UfCityFields({
  uf,
  cidade,
  estados,
  cidades,
  loadingCidades,
  disabled,
  onChangeUf,
  onChangeCidade,
  onValidateCidade,
}: UfCityFieldsProps) {
  return (
    <>
      <div>
        <label className="ef-label">Estado (UF)</label>
        <select
          value={uf}
          onChange={(event) => onChangeUf(event.target.value)}
          disabled={disabled}
          className={SELECT_CLASS}
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

interface IdentificacoesFieldsProps {
  values: string[];
  isAssembleia: boolean;
  disabled?: boolean;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  addLabel: string;
  addHint?: string;
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
}: IdentificacoesFieldsProps) {
  const PLACEHOLDERS = isAssembleia
    ? ["Ex: PB-008 B", "Ex: SP-138 A"]
    : ["Ex: 027 (B)", "Ex: 001 (A)"];

  return (
    <div>
      <label className="ef-label">
        {isAssembleia ? "Circuito(s)" : "Identificação do Congresso"}
      </label>
      <div className="space-y-2">
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
                <i className="fi fi-rr-trash text-base" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--ef-accent-strong)] transition hover:bg-[var(--ef-accent-soft)] disabled:opacity-50"
      >
        <i className="fi fi-rr-plus text-[10px]" />
        {addLabel}
      </button>
      {addHint && <p className="mt-1 text-xs text-[var(--ef-muted)]">{addHint}</p>}
    </div>
  );
}
