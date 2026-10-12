import { describe, expect, it } from "vitest";
import { formatCurrency, convertPrice } from "./currency";

describe("currency display", () => {
  it("formats prices with the selected Polish currency", () => {
    expect(formatCurrency(42, "PLN")).toBe("42,00 zł");
  });

  it("calculates the displayed amount without mutating the PLN source price", () => {
    expect(convertPrice(49.99, 0.231)).toBe(11.55);
  });
});
