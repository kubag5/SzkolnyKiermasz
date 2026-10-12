import bcrypt from "bcryptjs";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { UnsupportedCurrencyError } from "./currency";

describe("offer access control", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects the known example JWT secret", () => {
    expect(() => createApp({ prisma: {} as PrismaClient, jwtSecret: "local-development-only-change-me" })).toThrow(/JWT_SECRET/);
  });

  it("requires a strong configured JWT secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => createApp({ prisma: {} as PrismaClient, jwtSecret: "too-short" })).toThrow(/JWT_SECRET/);
    expect(() => createApp({ prisma: {} as PrismaClient, jwtSecret: "   " })).toThrow(/JWT_SECRET/);
    expect(() => createApp({ prisma: {} as PrismaClient, jwtSecret: "a-secure-production-secret-with-at-least-32-chars" })).not.toThrow();
  });

  it("limits repeated login attempts", async () => {
    const prisma = { user: { findUnique: vi.fn(async () => null) } } as unknown as PrismaClient;
    const app = createApp({ prisma, jwtSecret: "test-secret" });
    for (let attempt = 0; attempt < 10; attempt++) await request(app).post("/api/auth/login").send({ username: "missing", password: "not-a-real-user" }).expect(401);
    const limited = await request(app).post("/api/auth/login").send({ username: "missing", password: "not-a-real-user" });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
  });

  it("rejects pagination offsets above the supported maximum", async () => {
    const response = await request(createApp({ prisma: {} as PrismaClient, jwtSecret: "test-secret" })).get("/api/offers?page=999999");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks an authenticated student from changing another seller's offer", async () => {
    const passwordHash = await bcrypt.hash("tajnehaslo", 4);
    const prisma = {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { username?: string } }) =>
          where.username === "ala" ? { id: "user-1", username: "ala", nickname: "Ala", passwordHash } : null,
        ),
        create: vi.fn(),
      },
      offer: {
        findUnique: vi.fn(async () => ({ id: "offer-1", sellerId: "user-2", status: "AVAILABLE" })),
        update: vi.fn(),
      },
    } as unknown as PrismaClient;
    const agent = request.agent(createApp({ prisma, jwtSecret: "test-secret", frontendOrigin: "http://localhost:5173" }));

    await agent.post("/api/auth/login").send({ username: "ala", password: "tajnehaslo" }).expect(200);
    const response = await agent.patch("/api/offers/offer-1/status").send({ status: "SOLD" });

    expect(response.status).toBe(403);
    expect(prisma.offer.update).not.toHaveBeenCalled();
  });

  it("reports an unsupported currency as a client error", async () => {
    const prisma = {
      exchangeRate: { findFirst: vi.fn(async () => null), upsert: vi.fn() },
    } as unknown as PrismaClient;
    const frankfurter = {
      getRate: vi.fn(async () => { throw new UnsupportedCurrencyError(); }),
      getCurrencies: vi.fn(async () => []),
    };
    const response = await request(createApp({ prisma, jwtSecret: "test-secret", frankfurter }))
      .get("/api/rates/XYZ");

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("UNSUPPORTED_CURRENCY");
  });

  it("returns a clear client error for malformed JSON bodies", async () => {
    const prisma = {} as PrismaClient;
    const response = await request(createApp({ prisma, jwtSecret: "test-secret" }))
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });
});

describe("offer lifecycle", () => {
  it("creates a PLN offer and lets its seller mark it as sold", async () => {
    const seller = { id: "seller-1", username: "ola", nickname: "Ola", passwordHash: await bcrypt.hash("tajnehaslo", 4) };
    const prisma = {
      user: { findUnique: vi.fn(async () => seller) },
      offer: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...data, id: "offer-1", status: "AVAILABLE", createdAt: new Date("2026-10-12T10:00:00.000Z"), updatedAt: new Date("2026-10-12T10:00:00.000Z"),
          seller: { id: seller.id, nickname: seller.nickname },
        })),
        findUnique: vi.fn(async () => ({ id: "offer-1", sellerId: seller.id, status: "AVAILABLE" })),
        update: vi.fn(async ({ data }: { data: { status?: string } }) => ({
          id: "offer-1", title: "Matematyka 2", description: "Dobry stan, bez notatek.", pricePln: 25.5,
          condition: "GOOD", status: data.status ?? "AVAILABLE", sellerId: seller.id,
          createdAt: new Date("2026-10-12T10:00:00.000Z"), updatedAt: new Date("2026-10-12T10:00:00.000Z"),
          seller: { id: seller.id, nickname: seller.nickname },
        })),
      },
    } as unknown as PrismaClient;
    const agent = request.agent(createApp({ prisma, jwtSecret: "test-secret" }));
    await agent.post("/api/auth/login").send({ username: "ola", password: "tajnehaslo" }).expect(200);

    const created = await agent.post("/api/offers").send({
      title: "Matematyka 2", description: "Dobry stan, bez notatek.", pricePln: 25.5, condition: "GOOD",
    }).expect(201);
    expect(created.body.data).toMatchObject({ id: "offer-1", pricePln: 25.5, status: "AVAILABLE", seller: { nickname: "Ola" } });

    const sold = await agent.patch("/api/offers/offer-1/status").send({ status: "SOLD" }).expect(200);
    expect(sold.body.data.status).toBe("SOLD");
  });
});
