/**
 * Native authentication — email/password + Google OAuth, backed by MongoDB.
 *
 * Replaces the previous Manus-hosted OAuth. Sessions are still plain JWTs
 * (signed with JWT_SECRET) stored in an httpOnly cookie, so the rest of the
 * app (sdk.verifySession / authenticateRequest) is unchanged.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createLocalUser,
  getUserByEmail,
  touchUserSignIn,
  upsertOAuthUser,
} from "../mongoDb";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

// ─── Password hashing (Node crypto scrypt — no native deps) ─────────────────

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const derived = scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, "hex");
  if (hashBuf.length !== derived.length) return false;
  return timingSafeEqual(hashBuf, derived);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function publicUser(user: any) {
  if (!user) return null;
  const { passwordHash, _id, ...rest } = user;
  return rest;
}

async function setSessionCookie(req: Request, res: Response, openId: string, name: string) {
  const token = await sdk.createSessionToken(openId, { name, expiresInMs: ONE_YEAR_MS });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getRequestBaseUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim()
    || req.protocol
    || "https";
  const host = req.get("host");
  return `${proto}://${host}`;
}

const GOOGLE_STATE_COOKIE = "g_oauth_state";

// ─── Routes ─────────────────────────────────────────────────────────────────

export function registerAuthRoutes(app: Express) {
  // Which login methods are available (drives the frontend UI).
  app.get("/api/auth/providers", (_req, res) => {
    res.json({
      password: true,
      google: Boolean(ENV.googleClientId && ENV.googleClientSecret),
    });
  });

  // ── Email / password ──────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body ?? {};
      if (!isValidEmail(email)) {
        res.status(400).json({ error: "A valid email is required" });
        return;
      }
      if (typeof password !== "string" || password.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
        return;
      }
      const existing = await getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "An account with this email already exists" });
        return;
      }
      const user = await createLocalUser({
        name: typeof name === "string" ? name : null,
        email,
        passwordHash: hashPassword(password),
      });
      await setSessionCookie(req, res, user.openId, user.name || "");
      res.json({ user: publicUser(user) });
    } catch (error) {
      console.error("[Auth] register failed", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};
      if (!isValidEmail(email) || typeof password !== "string") {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }
      const user = await getUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      await touchUserSignIn(user.openId);
      await setSessionCookie(req, res, user.openId, user.name || "");
      res.json({ user: publicUser(user) });
    } catch (error) {
      console.error("[Auth] login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // ── Google OAuth ──────────────────────────────────────────────────────────

  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      res.status(503).json({ error: "Google sign-in is not configured" });
      return;
    }
    const state = randomBytes(16).toString("hex");
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(GOOGLE_STATE_COOKIE, state, { ...cookieOptions, maxAge: 10 * 60 * 1000 });

    const redirectUri = `${getRequestBaseUrl(req)}/api/auth/google/callback`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    res.redirect(url.toString());
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : undefined;
      const state = typeof req.query.state === "string" ? req.query.state : undefined;
      const cookieState = (req.headers.cookie || "")
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${GOOGLE_STATE_COOKIE}=`))
        ?.split("=")[1];

      if (!code || !state || !cookieState || state !== cookieState) {
        res.status(400).send("Invalid OAuth state");
        return;
      }

      const redirectUri = `${getRequestBaseUrl(req)}/api/auth/google/callback`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) {
        console.error("[Auth] Google token exchange failed", await tokenRes.text());
        res.status(502).send("Google token exchange failed");
        return;
      }
      const tokens = (await tokenRes.json()) as { access_token?: string };
      if (!tokens.access_token) {
        res.status(502).send("Google did not return an access token");
        return;
      }

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      if (!profileRes.ok) {
        res.status(502).send("Failed to fetch Google profile");
        return;
      }
      const profile = (await profileRes.json()) as {
        id?: string;
        email?: string;
        name?: string;
      };
      if (!profile.id) {
        res.status(502).send("Google profile missing id");
        return;
      }

      const user = await upsertOAuthUser({
        provider: "google",
        providerUserId: profile.id,
        name: profile.name ?? null,
        email: profile.email ?? null,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie(GOOGLE_STATE_COOKIE, { ...cookieOptions, maxAge: -1 });
      await setSessionCookie(req, res, user.openId, user.name || "");
      res.redirect(302, ENV.frontendUrl || "/");
    } catch (error) {
      console.error("[Auth] Google callback failed", error);
      res.status(500).send("Google sign-in failed");
    }
  });
}
