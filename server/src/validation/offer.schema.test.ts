import { describe, expect, it } from "vitest";
import { offerInputSchema } from "./offer.schema";

describe("offerInputSchema", () => {
  it("accepts valid listing data and trims user text", () => {
    expect(
      offerInputSchema.parse({
        title: "  Matematyka 1  ",
        description: "  Dobry stan  ",
        pricePln: 25.5,
        condition: "GOOD",
      }),
    ).toEqual({ title: "Matematyka 1", description: "Dobry stan", pricePln: 25.5, condition: "GOOD" });
  });

  it("rejects negative prices and empty titles", () => {
    expect(
      offerInputSchema.safeParse({
        title: " ",
        description: "Ok",
        pricePln: -3,
        condition: "GOOD",
      }).success,
    ).toBe(false);
  });
});
