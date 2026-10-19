import { describe, it, expect } from "vitest";
import { generateEventSlug } from "../services/eventService";

describe("generateEventSlug", () => {
  describe("assembleia_circuito", () => {
    it("generates slug with single circuito", () => {
      const slug = generateEventSlug(
        "assembleia_circuito",
        "",
        "",
        "PB-008 B",
        2026
      );
      expect(slug).toBe("assembleiacircuito-pb008b-2026");
    });

    it("generates slug with identificacoes array", () => {
      const slug = generateEventSlug(
        "assembleia_circuito",
        "",
        "",
        null,
        2026,
        ["PB-008 B"]
      );
      expect(slug).toBe("assembleiacircuito-pb008b-2026");
    });

    it("sorts multiple circuitos alphabetically", () => {
      const slug = generateEventSlug(
        "assembleia_circuito",
        "",
        "",
        null,
        2026,
        ["SP-138 A", "SP-028 A"]
      );
      expect(slug).toBe("assembleiacircuito-sp028a-sp138a-2026");
    });

    it("produces identical slug regardless of input order", () => {
      const slugA = generateEventSlug(
        "assembleia_circuito",
        "",
        "",
        null,
        2026,
        ["SP-138 A", "SP-028 A"]
      );
      const slugB = generateEventSlug(
        "assembleia_circuito",
        "",
        "",
        null,
        2026,
        ["SP-028 A", "SP-138 A"]
      );
      expect(slugA).toBe(slugB);
      expect(slugA).toBe("assembleiacircuito-sp028a-sp138a-2026");
    });

    it("filters empty strings from identificacoes", () => {
      const slug = generateEventSlug(
        "assembleia_circuito",
        "",
        "",
        null,
        2026,
        ["SP-028 A", "", "SP-138 A"]
      );
      expect(slug).toBe("assembleiacircuito-sp028a-sp138a-2026");
    });

    it("ignores UF and city in slug", () => {
      const slug = generateEventSlug(
        "assembleia_circuito",
        "SP",
        "São Paulo",
        "SP-028 A",
        2026
      );
      expect(slug).toBe("assembleiacircuito-sp028a-2026");
    });
  });

  describe("assembleia_representante", () => {
    it("generates slug without UF/city", () => {
      const slug = generateEventSlug(
        "assembleia_representante",
        "PB",
        "João Pessoa",
        "PB-008 B",
        2026
      );
      expect(slug).toBe("assembleiarepresentante-pb008b-2026");
    });

    it("sorts multiple circuitos", () => {
      const slug = generateEventSlug(
        "assembleia_representante",
        "",
        "",
        null,
        2026,
        ["PB-099 A", "PB-008 B"]
      );
      expect(slug).toBe("assembleiarepresentante-pb008b-pb099a-2026");
    });
  });

  describe("congresso_regional", () => {
    it("generates slug with UF, city and identificacao", () => {
      const slug = generateEventSlug(
        "congresso_regional",
        "PB",
        "João Pessoa",
        null,
        2026,
        ["027 (B)"]
      );
      expect(slug).toBe("congressoregional-pb-joaopessoa-027b-2026");
    });

    it("sorts multiple identificacoes", () => {
      const slug = generateEventSlug(
        "congresso_regional",
        "RJ",
        "São Gonçalo",
        null,
        2026,
        ["001 (A)", "027 (B)"]
      );
      expect(slug).toBe("congressoregional-rj-saogoncalo-001a-027b-2026");
    });

    it("normalizes accents and special characters", () => {
      const slug = generateEventSlug(
        "congresso_regional",
        "SP",
        "Mairiporá",
        null,
        2026,
        ["001 (A)", "002-B"]
      );
      expect(slug).toBe("congressoregional-sp-mairipora-001a-002b-2026");
    });

    it("falls back to circuito string when identificacoes not provided", () => {
      const slug = generateEventSlug(
        "congresso_regional",
        "PB",
        "Campina Grande",
        "027 (B)",
        2026
      );
      expect(slug).toBe("congressoregional-pb-campinagrande-027b-2026");
    });
  });
});
