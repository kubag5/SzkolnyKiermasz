import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MyOffersPage } from "./MyOffersPage";

describe("my offers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders offers from the paginated API response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: {
      offers: [{
        id: "offer-1", title: "Matematyka 2", description: "Dobry stan książki.", pricePln: 25.5,
        condition: "GOOD", status: "AVAILABLE", sellerId: "seller-1", seller: { id: "seller-1", nickname: "Ola" },
        createdAt: "2026-10-12T10:00:00.000Z", updatedAt: "2026-10-12T10:00:00.000Z",
      }],
      meta: { page: 1, limit: 48, total: 1 },
    } })));

    render(<MemoryRouter><MyOffersPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Matematyka 2" })).toBeInTheDocument();
  });
});
