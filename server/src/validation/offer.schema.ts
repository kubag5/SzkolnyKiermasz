import { z } from "zod";

export const offerConditionSchema = z.enum(["NEW", "VERY_GOOD", "GOOD", "ACCEPTABLE"]);

export const offerInputSchema = z.object({
  title: z.string().trim().min(2, "Podaj nazwę książki.").max(120, "Nazwa może mieć maksymalnie 120 znaków."),
  description: z.string().trim().min(5, "Opis musi mieć co najmniej 5 znaków.").max(1200, "Opis może mieć maksymalnie 1200 znaków."),
  pricePln: z.number().finite().min(0.01, "Cena musi być większa od zera.").max(100000, "Cena jest zbyt wysoka."),
  condition: offerConditionSchema,
});

export const offerStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "SOLD"]),
});

export type OfferInput = z.infer<typeof offerInputSchema>;
