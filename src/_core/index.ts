import "dotenv/config";
import { webcrypto as _webcrypto } from "node:crypto";

// jose v6 signs/verifies JWTs via the WebCrypto API, accessed through the
// global `crypto`. Node 18 does not expose `crypto` globally (only Node 20+),
// so polyfill it to keep auth working regardless of the runtime Node version.
if (!(globalThis as unknown as { crypto?: unknown }).crypto) {
  (globalThis as unknown as { crypto: unknown }).crypto = _webcrypto;
}

import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors, { type CorsOptions } from "cors";
import { registerAuthRoutes } from "./auth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { connectMongo } from "./mongo";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function getAllowedOrigins() {
  const configuredOrigins = [ENV.frontendUrl, ENV.corsOrigin]
    .flatMap(value => value.split(","))
    .map(value => value.trim())
    .filter(Boolean);

  return Array.from(
    new Set([
      ...configuredOrigins,
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ])
  );
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const allowedOrigins = getAllowedOrigins();
  const corsOptions: CorsOptions = {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  };

  app.set("trust proxy", 1);
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (_req, res) => {
    const storageMode = ENV.mongoUrl ? "mongo-foundation" : (ENV.databaseUrl ? "mysql-legacy" : "unconfigured");
    res.json({
      ok: true,
      service: "corehr-web-backend",
      storageMode,
      database: ENV.databaseUrl ? "configured" : "missing",
      mongo: ENV.mongoUrl ? "configured" : "disabled",
    });
  });

  await connectMongo().catch(error => {
    console.error("[MongoDB] Connection failed", error);
  });

  registerStorageProxy(app);
  registerAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
