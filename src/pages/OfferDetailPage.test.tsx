import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { OfferDetailPage } from "./OfferDetailPage";

describe("offer detail currency", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not show the previous currency rate while a new quote is loading", async () => {
    let resolveUsd!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/api/auth/me")) return Promise.resolve(Response.json({ error: { message: "Zaloguj się" } }, { status: 401 }));
      if (path.includes("/api/offers/offer-1")) return Promise.resolve(Response.json({ data: {
        id: "offer-1", title: "Matematyka 2", description: "Dobry stan, bez notatek.", pricePln: 100,
        condition: "GOOD", status: "AVAILABLE", sellerId: "seller-1", seller: { id: "seller-1", nickname: "Ola" },
        createdAt: "2026-10-12T10:00:00.000Z", updatedAt: "2026-10-12T10:00:00.000Z",
      } }));
      if (path.includes("/api/rates/EUR")) return Promise.resolve(Response.json({ data: { base: "PLN", quote: "EUR", date: "2026-10-10", rate: 0.25, stale: false } }));
      if (path.includes("/api/rates/USD")) return new Promise<Response>((resolve) => { resolveUsd = resolve; });
      return Promise.resolve(Response.json({ data: {} }));
    }));

    render(<MemoryRouter initialEntries={["/oferta/offer-1"]}><AuthProvider><Routes><Route path="/oferta/:id" element={<OfferDetailPage />} /></Routes></AuthProvider></MemoryRouter>);
    fireEvent.change(await screen.findByRole("combobox", { name: "Waluta ceny" }), { target: { value: "EUR" } });
    expect(await screen.findByText(/Około 25,00/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Waluta ceny" }), { target: { value: "USD" } });
    expect(await screen.findByText(/Pobieranie kursu USD/)).toBeInTheDocument();
    expect(screen.queryByText(/Około 25,00/)).not.toBeInTheDocument();
    resolveUsd(Response.json({ data: { base: "PLN", quote: "USD", date: "2026-10-10", rate: 0.27, stale: false } }));
    expect(await screen.findByText(/Około 27,00/)).toBeInTheDocument();
  });
});
