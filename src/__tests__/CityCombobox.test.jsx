import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CityCombobox from "../components/CityCombobox";

const mockCidades = [
  { id: "25001", nome: "João Pessoa" },
  { id: "25002", nome: "Campina Grande" },
  { id: "25003", nome: "Santana" },
  { id: "25004", nome: "São Bento" },
];

describe("CityCombobox", () => {
  it("renders disabled with placeholder when disabled", () => {
    render(
      <CityCombobox
        cidades={mockCidades}
        value=""
        onChange={() => {}}
        disabled={true}
        loading={false}
      />
    );
    expect(screen.getByPlaceholderText("Selecione a UF primeiro")).toBeDefined();
    expect(screen.getByPlaceholderText("Selecione a UF primeiro").disabled).toBe(true);
  });

  it("renders with loading spinner when loading", () => {
    const { container } = render(
      <CityCombobox
        cidades={[]}
        value=""
        onChange={() => {}}
        disabled={false}
        loading={true}
      />
    );
    expect(screen.getByPlaceholderText("Carregando cidades...")).toBeDefined();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("filters cities case-insensitively with accent normalization", () => {
    render(
      <CityCombobox
        cidades={mockCidades}
        value=""
        onChange={() => {}}
        disabled={false}
        loading={false}
      />
    );
    const input = screen.getByPlaceholderText("Digite para buscar...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "joao" } });
    expect(screen.getByText("João Pessoa")).toBeDefined();
    expect(screen.queryByText("Campina Grande")).toBeNull();
  });

  it("filters cities ignoring accents on input", () => {
    render(
      <CityCombobox
        cidades={mockCidades}
        value=""
        onChange={() => {}}
        disabled={false}
        loading={false}
      />
    );
    const input = screen.getByPlaceholderText("Digite para buscar...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "joão" } });
    expect(screen.getByText("João Pessoa")).toBeDefined();
  });

  it("selects a city and calls onChange with the official name", () => {
    const onChange = vi.fn();
    render(
      <CityCombobox
        cidades={mockCidades}
        value=""
        onChange={onChange}
        disabled={false}
        loading={false}
      />
    );
    const input = screen.getByPlaceholderText("Digite para buscar...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Camp" } });
    fireEvent.click(screen.getByText("Campina Grande"));
    expect(onChange).toHaveBeenCalledWith("Campina Grande");
  });

  it("shows all cities when input is empty and focused", () => {
    render(
      <CityCombobox
        cidades={mockCidades}
        value=""
        onChange={() => {}}
        disabled={false}
        loading={false}
      />
    );
    const input = screen.getByPlaceholderText("Digite para buscar...");
    fireEvent.focus(input);
    expect(screen.getByText("João Pessoa")).toBeDefined();
    expect(screen.getByText("Campina Grande")).toBeDefined();
    expect(screen.getByText("Santana")).toBeDefined();
    expect(screen.getByText("São Bento")).toBeDefined();
  });

  it("validates on blur and shows error for invalid city", async () => {
    const onValidate = vi.fn();
    render(
      <CityCombobox
        cidades={mockCidades}
        value=""
        onChange={() => {}}
        onValidate={onValidate}
        disabled={false}
        loading={false}
      />
    );
    const input = screen.getByPlaceholderText("Digite para buscar...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Cidade Inexistente" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(onValidate).toHaveBeenCalledWith(false);
    });
  });

  it("validates on blur and passes for valid city", async () => {
    const onValidate = vi.fn();
    render(
      <CityCombobox
        cidades={mockCidades}
        value=""
        onChange={() => {}}
        onValidate={onValidate}
        disabled={false}
        loading={false}
      />
    );
    const input = screen.getByPlaceholderText("Digite para buscar...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Santana" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(onValidate).toHaveBeenCalledWith(true);
    });
  });

  it("shows error message for invalid input after blur", async () => {
    render(
      <CityCombobox
        cidades={mockCidades}
        value=""
        onChange={() => {}}
        disabled={false}
        loading={false}
      />
    );
    const input = screen.getByPlaceholderText("Digite para buscar...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "XPTO" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.getByText("Por favor, selecione uma cidade válida da lista.")).toBeDefined();
    });
  });

  it("clears input when clear button is clicked", () => {
    const onChange = vi.fn();
    render(
      <CityCombobox
        cidades={mockCidades}
        value="Santana"
        onChange={onChange}
        disabled={false}
        loading={false}
      />
    );
    const clearBtn = screen.getByRole("button");
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("displays overflow count when more than 8 cities match", () => {
    const manyCidades = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      nome: `Cidade ${String(i).padStart(2, "0")}`,
    }));
    render(
      <CityCombobox
        cidades={manyCidades}
        value=""
        onChange={() => {}}
        disabled={false}
        loading={false}
      />
    );
    const input = screen.getByPlaceholderText("Digite para buscar...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Cidade" } });
    expect(screen.getByText("+4 cidades restantes")).toBeDefined();
  });
});
