import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9_]+$/, "Login może zawierać litery, cyfry i podkreślenia."),
  nickname: z.string().trim().min(2).max(32),
  password: z.string().min(8).max(72).refine((password) => new TextEncoder().encode(password).length <= 72, "Hasło może mieć maksymalnie 72 bajty UTF-8."),
});

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(24),
  password: z.string().min(1).max(72).refine((password) => new TextEncoder().encode(password).length <= 72, "Hasło może mieć maksymalnie 72 bajty UTF-8."),
});
