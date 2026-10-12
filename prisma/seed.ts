import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo seed is disabled in production.");
}

const prisma = new PrismaClient();

async function main() {
  const demoSeller = await prisma.user.upsert({
    where: { username: "ola_demo" },
    update: {},
    create: {
      username: "ola_demo",
      nickname: "Ola",
      passwordHash: await bcrypt.hash("kiermasz2026", 12),
    },
  });
  const demoBuyer = await prisma.user.upsert({
    where: { username: "mateusz_demo" },
    update: {},
    create: {
      username: "mateusz_demo",
      nickname: "Mateusz",
      passwordHash: await bcrypt.hash("kiermasz2026", 12),
    },
  });

  const offers = [
    { id: "demo-matematyka-2", title: "Matematyka 2. Zakres podstawowy", description: "Kilka notatek ołówkiem. Jest też zbiór zadań.", pricePln: 28, condition: "GOOD" as const, sellerId: demoSeller.id },
    { id: "demo-biologia", title: "Biologia na czasie 1", description: "Wydanie 2024, bez podkreśleń. Lekkie ślady na okładce.", pricePln: 34.5, condition: "VERY_GOOD" as const, sellerId: demoBuyer.id },
    { id: "demo-polski", title: "Oblicza epok. Język polski 3", description: "Używana jeden semestr, stan dobry.", pricePln: 19, condition: "VERY_GOOD" as const, sellerId: demoSeller.id },
    { id: "demo-geografia", title: "Oblicza geografii 2", description: "Strony kompletne. Na okładce drobne otarcie.", pricePln: 16, condition: "ACCEPTABLE" as const, sellerId: demoBuyer.id },
    { id: "demo-historia", title: "Historia. Poznać przeszłość 1", description: "Jak nowa, bez wpisów.", pricePln: 31, condition: "NEW" as const, sellerId: demoSeller.id },
  ];

  for (const offer of offers) {
    await prisma.offer.upsert({ where: { id: offer.id }, update: offer, create: offer });
  }
  console.log(`Seed complete: ${offers.length} offers for demo users.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
