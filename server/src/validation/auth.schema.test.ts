import { describe, expect, it } from "vitest";
import { registerSchema } from "./auth.schema";

describe("password validation", () => {
  it("rejects passwords that bcrypt would silently truncate at 72 UTF-8 bytes", () => {
    expect(registerSchema.safeParse({ username: "ola", nickname: "Ola", password: "a".repeat(72) }).success).toBe(true);
    expect(registerSchema.safeParse({ username: "ola", nickname: "Ola", password: "ą".repeat(37) }).success).toBe(false);
  });
});
