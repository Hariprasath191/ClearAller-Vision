import { config } from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { registerAccountRoutes } from "./routes/account-routes.js";
import { registerProfileRoutes } from "./routes/profile-routes.js";
import { registerAnalysisRoutes } from "./routes/analysis-routes.js";
import { registerSearchRoutes } from "./routes/search-routes.js";
import { registerDashboardRoutes } from "./routes/dashboard-routes.js";
import { registerChatRoutes } from "./routes/chat-routes.js";

config();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(multipart);

app.get("/health", async () => ({ ok: true, service: "clearaller-vision-api" }));

await registerAccountRoutes(app);
await registerProfileRoutes(app);
await registerAnalysisRoutes(app);
await registerSearchRoutes(app);
await registerDashboardRoutes(app);
await registerChatRoutes(app);

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
