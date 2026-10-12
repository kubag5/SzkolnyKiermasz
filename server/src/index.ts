import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./prisma";

const port = Number(process.env.PORT ?? 3001);
const app = createApp({ prisma });

const server = app.listen(port, () => {
  console.log(`Szkolny kiermasz API działa na http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
