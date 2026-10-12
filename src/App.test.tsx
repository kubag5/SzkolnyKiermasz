import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth/AuthContext";
import { App } from "./App";

describe("mobile navigation", () => {
  it("opens the navigation without opening the account menu", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.includes("/api/auth/me")) return Response.json({ data: { user: { id: "u1", username: "ola", nickname: "Ola" } } });
      if (path.includes("/api/currencies")) return Response.json({ data: [{ iso_code: "PLN", name: "Polski złoty" }] });
      if (path.includes("/api/offers")) return Response.json({ data: { offers: [], meta: { page: 1, limit: 24, total: 0 } } });
      return Response.json({ data: {} });
    }));

    render(<BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>);
    const menuButton = await screen.findByRole("button", { name: "Otwórz menu" });
    fireEvent.click(menuButton);

    await waitFor(() => expect(screen.getByRole("navigation", { name: "Główna nawigacja" })).toHaveClass("is-open"));
    expect(screen.queryByRole("button", { name: /wyloguj/i })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
