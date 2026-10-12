import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("API error handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("explains that the server is unavailable when the proxy returns an HTML gateway error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Gateway", { status: 502, headers: { "content-type": "text/html" } })));

    await expect(api("/api/offers")).rejects.toMatchObject({
      status: 502,
      code: "SERVER_UNAVAILABLE",
      message: "Serwer nie odpowiada.",
    });
  });
});
