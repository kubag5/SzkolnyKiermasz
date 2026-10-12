import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import rateLimit from "express-rate-limit";
import { z, ZodError } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createCurrencyService, createFrankfurterClient, CurrencyUnavailableError, UnsupportedCurrencyError, type CurrencyService, type FrankfurterClient } from "./currency";
import { loginSchema, registerSchema } from "./validation/auth.schema";
import { offerInputSchema, offerStatusSchema } from "./validation/offer.schema";

const SESSION_COOKIE = "sk_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const sellerSelect = { id: true, nickname: true } as const;

export type AppOptions = {
  prisma: PrismaClient;
  jwtSecret?: string;
  frontendOrigin?: string;
  frankfurter?: FrankfurterClient;
};

export function createApp({ prisma, jwtSecret = process.env.JWT_SECRET, frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173", frankfurter }: AppOptions) {
  const configuredSecret = jwtSecret?.trim() || undefined;
  if (configuredSecret === "local-development-only-change-me") throw new Error("JWT_SECRET must not use the example value.");
  if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) throw new Error("JWT_SECRET must be configured with at least 32 characters in production.");
  const secret = configuredSecret ?? randomBytes(48).toString("base64url");
  const gateway = frankfurter ?? createFrankfurterClient();
  const currencyService: CurrencyService = createCurrencyService(prisma, gateway);
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ data: { status: "ok" } }));

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const input = registerSchema.parse(req.body);
      const existing = await prisma.user.findUnique({ where: { username: input.username } });
      if (existing) return sendError(res, 409, "USERNAME_TAKEN", "Ten login jest już zajęty.");

      const user = await prisma.user.create({
        data: { username: input.username, nickname: input.nickname, passwordHash: await bcrypt.hash(input.password, 12) },
        select: { id: true, username: true, nickname: true },
      });
      setSession(res, user, secret);
      return res.status(201).json({ data: { user } });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => sendError(res, 429, "RATE_LIMITED", "Zbyt wiele prób logowania. Spróbuj później.") }), async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { username: input.username } });
      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        return sendError(res, 401, "INVALID_CREDENTIALS", "Nieprawidłowy login lub hasło.");
      }
      setSession(res, user, secret);
      return res.json({ data: { user: { id: user.id, username: user.username, nickname: user.nickname } } });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.json({ data: { signedOut: true } });
  });

  app.get("/api/auth/me", requireSession(secret), (_req, res) => {
    res.json({ data: { user: res.locals.user } });
  });

  app.get("/api/offers", async (req, res, next) => {
    try {
      const filters = z.object({
        search: z.string().trim().max(120).optional(),
        status: z.enum(["AVAILABLE", "SOLD", "ALL"]).default("AVAILABLE"),
        minPrice: z.coerce.number().finite().min(0).optional(),
        maxPrice: z.coerce.number().finite().min(0).optional(),
        page: z.coerce.number().int().min(1).max(1000).default(1),
        limit: z.coerce.number().int().min(1).max(48).default(24),
        mine: z.enum(["true", "false"]).default("false"),
      }).parse(req.query);

      if (filters.minPrice !== undefined && filters.maxPrice !== undefined && filters.minPrice > filters.maxPrice) {
        return sendError(res, 400, "INVALID_PRICE_RANGE", "Cena minimalna nie może być wyższa od maksymalnej.");
      }
      const sellerId = filters.mine === "true" ? getSessionUserId(req, secret) : undefined;
      if (filters.mine === "true" && !sellerId) return sendError(res, 401, "UNAUTHORIZED", "Zaloguj się, aby zobaczyć swoje oferty.");

      const where = {
        ...(filters.status === "ALL" ? {} : { status: filters.status }),
        ...(sellerId ? { sellerId } : {}),
        ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" as const } } : {}),
        ...((filters.minPrice !== undefined || filters.maxPrice !== undefined) ? {
          pricePln: {
            ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
          },
        } : {}),
      };
      const [offers, total] = await Promise.all([
        prisma.offer.findMany({
          where,
          include: { seller: { select: sellerSelect } },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          skip: (filters.page - 1) * filters.limit,
          take: filters.limit,
        }),
        prisma.offer.count({ where }),
      ]);

      return res.json({ data: { offers: offers.map(serializeOffer), meta: { page: filters.page, limit: filters.limit, total } } });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/offers/:id", async (req, res, next) => {
    try {
      const offerId = routeParam(req.params.id);
      const offer = await prisma.offer.findUnique({ where: { id: offerId }, include: { seller: { select: sellerSelect } } });
      if (!offer) return sendError(res, 404, "OFFER_NOT_FOUND", "Nie znaleziono tej oferty.");
      return res.json({ data: serializeOffer(offer) });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/offers", requireSession(secret), async (req, res, next) => {
    try {
      const input = offerInputSchema.parse(req.body);
      const offer = await prisma.offer.create({
        data: { ...input, sellerId: res.locals.user.id },
        include: { seller: { select: sellerSelect } },
      });
      return res.status(201).json({ data: serializeOffer(offer) });
    } catch (error) {
      return next(error);
    }
  });

  app.put("/api/offers/:id", requireSession(secret), async (req, res, next) => {
    try {
      const input = offerInputSchema.parse(req.body);
      const offerId = routeParam(req.params.id);
      const existing = await prisma.offer.findUnique({ where: { id: offerId } });
      if (!existing) return sendError(res, 404, "OFFER_NOT_FOUND", "Nie znaleziono tej oferty.");
      if (existing.sellerId !== res.locals.user.id) return sendError(res, 403, "FORBIDDEN", "Możesz edytować tylko własne oferty.");
      const offer = await prisma.offer.update({
        where: { id: offerId },
        data: input,
        include: { seller: { select: sellerSelect } },
      });
      return res.json({ data: serializeOffer(offer) });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/offers/:id/status", requireSession(secret), async (req, res, next) => {
    try {
      const { status } = offerStatusSchema.parse(req.body);
      const offerId = routeParam(req.params.id);
      const existing = await prisma.offer.findUnique({ where: { id: offerId } });
      if (!existing) return sendError(res, 404, "OFFER_NOT_FOUND", "Nie znaleziono tej oferty.");
      if (existing.sellerId !== res.locals.user.id) return sendError(res, 403, "FORBIDDEN", "Możesz zmieniać status tylko własnych ofert.");
      const offer = await prisma.offer.update({
        where: { id: offerId }, data: { status }, include: { seller: { select: sellerSelect } },
      });
      return res.json({ data: serializeOffer(offer) });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/offers/:id", requireSession(secret), async (req, res, next) => {
    try {
      const offerId = routeParam(req.params.id);
      const existing = await prisma.offer.findUnique({ where: { id: offerId } });
      if (!existing) return sendError(res, 404, "OFFER_NOT_FOUND", "Nie znaleziono tej oferty.");
      if (existing.sellerId !== res.locals.user.id) return sendError(res, 403, "FORBIDDEN", "Możesz usuwać tylko własne oferty.");
      await prisma.offer.delete({ where: { id: offerId } });
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/currencies", async (_req, res, next) => {
    try {
      const currencies = await gateway.getCurrencies();
      return res.json({ data: currencies });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/rates/:currency", async (req, res, next) => {
    try {
      const currency = req.params.currency.toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) return sendError(res, 400, "INVALID_CURRENCY", "Nieprawidłowy kod waluty.");
      const rate = await currencyService.getRate(currency);
      return res.json({ data: rate });
    } catch (error) {
      if (error instanceof UnsupportedCurrencyError) return sendError(res, 422, "UNSUPPORTED_CURRENCY", error.message);
      if (error instanceof CurrencyUnavailableError) return sendError(res, 503, "RATE_UNAVAILABLE", error.message);
      return next(error);
    }
  });

  app.use((_req, res) => sendError(res, 404, "NOT_FOUND", "Nie znaleziono tej strony."));
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      return sendError(res, 400, "VALIDATION_ERROR", "Niepoprawne dane.", error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })));
    }
    if (isBodyParserError(error, "entity.parse.failed")) return sendError(res, 400, "INVALID_JSON", "Niepoprawny JSON.");
    if (isBodyParserError(error, "entity.too.large")) return sendError(res, 413, "BODY_TOO_LARGE", "Żądanie jest zbyt duże.");
    if (isPrismaUniqueError(error)) return sendError(res, 409, "CONFLICT", "Taki rekord już istnieje.");
    console.error("API error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Błąd serwera.");
  };
  app.use(errorHandler);
  return app;
}

function requireSession(secret: string) {
  return (req: Request, res: Response, next: (error?: unknown) => void) => {
    const user = readSession(req, secret);
    if (!user) return sendError(res, 401, "UNAUTHORIZED", "Zaloguj się.");
    res.locals.user = user;
    return next();
  };
}

function getSessionUserId(req: Request, secret: string) {
  return readSession(req, secret)?.id;
}

function readSession(req: Request, secret: string): { id: string; username: string; nickname: string } | undefined {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return undefined;
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    if (typeof payload.sub !== "string" || typeof payload.username !== "string" || typeof payload.nickname !== "string") return undefined;
    return { id: payload.sub, username: payload.username, nickname: payload.nickname };
  } catch {
    return undefined;
  }
}

function setSession(res: Response, user: { id: string; username: string; nickname: string }, secret: string) {
  const token = jwt.sign({ username: user.username, nickname: user.nickname }, secret, { subject: user.id, expiresIn: "7d" });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MAX_AGE });
}

function cookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
}

function serializeOffer<T extends { pricePln: unknown; createdAt: Date; updatedAt: Date }>(offer: T) {
  return {
    ...offer,
    pricePln: Number(offer.pricePln),
    createdAt: offer.createdAt?.toISOString?.() ?? offer.createdAt,
    updatedAt: offer.updatedAt?.toISOString?.() ?? offer.updatedAt,
  };
}

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isPrismaUniqueError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

function isBodyParserError(error: unknown, type: string): boolean {
  return typeof error === "object" && error !== null && "type" in error && (error as { type?: unknown }).type === type;
}
