import { findGyms } from "./gyms.ts";
import { join } from "node:path";
import { AccountDatabase, ServiceError } from "./database.ts";
import { validatedBackup } from "./validate-state.ts";
import { subscription } from "./subscriptions.ts";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { nutritionTargets } from "../src/core/nutrition.ts";
import {
  newProfile,
  type Profile,
  validateProfile,
} from "../src/core/model.ts";
import { createDexcom } from "./dexcom.ts";
import { policy, checkQuestion, validatePhotoResult } from "./policy.mjs";
const token = process.env.SNAP_API_TOKEN || "";
const key = process.env.GEMINI_API_KEY || "";
if (process.env.NODE_ENV === "production" && !process.env.DATA_ENCRYPTION_KEY)
  throw new Error("Production requires a persistent DATA_ENCRYPTION_KEY.");
const db = new AccountDatabase(
  process.env.DATABASE_PATH ||
    join(process.cwd(), "server/data/accounts.sqlite"),
  process.env.DATA_ENCRYPTION_KEY,
);
const developmentPairing =
  process.env.ALLOW_DEV_PAIRING === "1" &&
  process.env.NODE_ENV !== "production" &&
  token.length >= 24;
const dexcomClients = new Map<string, ReturnType<typeof createDexcom>>();
const oauthOwners = new Map<string, { id: string; expires: number }>();
function cgm(id: string) {
  let client = dexcomClients.get(id);
  if (!client) {
    client = createDexcom(
      process.env,
      fetch,
      id === "development"
        ? undefined
        : {
            load: () => db.getProvider(id),
            save: (v) => db.setProvider(id, v),
          },
    );
    dexcomClients.set(id, client);
  }
  return client;
}
const attempts = new Map<string, { count: number; expires: number }>();
function permitted(auth: string) {
  const expected = Buffer.from(`Bearer ${token}`);
  const got = Buffer.from(auth);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
async function generate(parts: unknown[], system: string, json = false) {
  if (!key)
    throw new Error(
      "AI provider is not configured. Set GEMINI_API_KEY on the server.",
    );
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!/^[a-zA-Z0-9._-]+$/.test(model))
    throw new Error("Invalid model configuration.");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1400,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!response.ok)
    throw new Error("AI provider unavailable. Please retry later.");
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts
    ?.filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text || "")
    .join("");
  if (!text) throw new Error("The AI provider returned no usable answer.");
  return text.slice(0, 10000);
}
function serverTargets(profile: Partial<Profile>) {
  // Ignore caller-supplied target numbers and whitelist profile fields.
  const p: Profile = {
    ...newProfile,
    name: "User",
    consent: true,
    age: Number(profile.age),
    sex: profile.sex === "male" ? "male" : "female",
    height: Number(profile.height),
    weight: Number(profile.weight),
    targetWeight: Number(profile.targetWeight),
    goal: ["lose", "gain", "maintain"].includes(profile.goal || "")
      ? profile.goal!
      : "maintain",
    activity: [1.2, 1.375, 1.55, 1.725].includes(Number(profile.activity))
      ? profile.activity!
      : 1.2,
    experience:
      profile.experience === "experienced" ? "experienced" : "beginner",
    days: profile.days ?? newProfile.days,
    workoutDays: profile.workoutDays,
    conditions: Array.isArray(profile.conditions) ? profile.conditions : [],
    insulin: !!profile.insulin,
    medicines: String(profile.medicines || "").slice(0, 2000),
    allergies: String(profile.allergies || "").slice(0, 1000),
    diet: String(profile.diet || "").slice(0, 1000),
    country: profile.country,
    cuisine: profile.cuisine,
    dietType: profile.dietType,
    allergyFoods: profile.allergyFoods,
    familiarFoods: String(profile.familiarFoods || "").slice(0, 1000),
    injuries: String(profile.injuries || "").slice(0, 1000),
  };
  const accepted = [
    "type1",
    "type2",
    "hypertension",
    "heart",
    "kidney",
    "pregnant",
    "eating-disorder",
  ];
  if (p.conditions.some((c) => !accepted.includes(c)))
    throw new Error("Invalid health context.");
  validateProfile(p);
  const targets = nutritionTargets(p);
  return { profile: p, targets: targets.restricted ? null : targets };
}
export const server = createServer(async (req, res) => {
  const cors = process.env.WEB_ORIGIN;
  const origin = req.headers.origin;
  if (cors && origin === cors) {
    res.setHeader("Access-Control-Allow-Origin", cors);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const send = (status: number, body: unknown) => {
    res.writeHead(status);
    res.end(JSON.stringify(body));
  };
  const route = new URL(req.url || "/", "http://local");
  if (route.pathname === "/cgm/dexcom/callback" && req.method === "GET") {
    try {
      const state = route.searchParams.get("state") || "";
      const owner = oauthOwners.get(state);
      oauthOwners.delete(state);
      if (!owner || owner.expires < Date.now())
        throw new Error("Expired connection.");
      await cgm(owner.id).callback(
        route.searchParams.get("state") || "",
        route.searchParams.get("code") || "",
      );
      send(200, {
        message:
          "Dexcom authorization completed. Return to Snap to Fit and tap Sync historical readings.",
      });
    } catch {
      send(400, {
        error:
          "Dexcom authorization failed or was cancelled. Return to the app and reconnect.",
      });
    }
    return;
  }
  if (req.method === "OPTIONS") {
    if (!cors || origin !== cors) {
      send(403, { error: "Origin not allowed." });
      return;
    }
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/health" && req.method === "GET") {
    send(200, { status: "ok", aiConfigured: !!key });
    return;
  }
  if (
    req.method !== "POST" ||
    ![
      "/gyms/search",
      "/auth/register",
      "/auth/login",
      "/auth/refresh",
      "/auth/recover",
      "/auth/logout",
      "/auth/delete",
      "/backup/get",
      "/backup/put",
      "/subscription/status",
      "/chat",
      "/food",
      "/cgm/status",
      "/cgm/dexcom/start",
      "/cgm/dexcom/sync",
      "/cgm/dexcom/disconnect",
    ].includes(req.url || "")
  ) {
    send(404, { error: "Not found." });
    return;
  }
  const publicRoute = [
    "/gyms/search",
    "/auth/register",
    "/auth/login",
    "/auth/refresh",
    "/auth/recover",
  ].includes(req.url || "");
  let user: { id: string; username: string } | undefined;
  if (!publicRoute) {
    try {
      if (developmentPairing && permitted(req.headers.authorization || ""))
        user = { id: "development", username: "development" };
      else
        user = db.authenticate(
          (req.headers.authorization || "").replace(/^Bearer /, ""),
        );
    } catch {
      send(401, { error: "Sign in to access this service." });
      return;
    }
  }
  const ip = req.socket.remoteAddress || "local";
  const now = Date.now();
  for (const [k, v] of attempts) if (v.expires < now) attempts.delete(k);
  const entry = attempts.get(ip) || { count: 0, expires: now + 60000 };
  entry.count++;
  attempts.set(ip, entry);
  if (entry.count > 20) {
    send(429, { error: "Too many requests. Try again in a minute." });
    return;
  }
  try {
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        send(413, { error: "Request is too large." });
        return;
      }
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    if (req.url === "/gyms/search") {
      send(200, await findGyms(body, process.env.GOOGLE_PLACES_API_KEY || ""));
      return;
    }
    const access = (req.headers.authorization || "").replace(/^Bearer /, "");
    if (req.url === "/auth/register") {
      send(201, await db.register(body.username, body.password));
      return;
    }
    if (req.url === "/auth/login") {
      send(200, await db.login(body.username, body.password));
      return;
    }
    if (req.url === "/auth/recover") {
      send(
        200,
        await db.recover(body.username, body.recoveryCode, body.password),
      );
      return;
    }
    if (req.url === "/auth/refresh") {
      if (typeof body.refreshToken !== "string")
        throw new ServiceError(400, "Refresh token is required.");
      send(200, db.refresh(body.refreshToken));
      return;
    }
    if (req.url === "/auth/logout") {
      db.logout(access);
      send(200, { signedOut: true });
      return;
    }
    if (req.url === "/auth/delete") {
      if (!user || user.id === "development")
        throw new ServiceError(400, "Sign in to delete an account.");
      await db.remove(user.id, String(body.password || ""));
      cgm(user.id).disconnect();
      dexcomClients.delete(user.id);
      for (const [key, value] of oauthOwners)
        if (value.id === user.id) oauthOwners.delete(key);
      send(200, { deleted: true });
      return;
    }
    if (req.url === "/backup/get") {
      if (user!.id === "development")
        throw new ServiceError(400, "Sign in to use private backups.");
      send(200, db.readBackup(user!.id));
      return;
    }
    if (req.url === "/backup/put") {
      if (user!.id === "development")
        throw new ServiceError(400, "Sign in to use private backups.");
      if (!Number.isInteger(body.revision) || body.revision < 0)
        throw new ServiceError(400, "Invalid backup revision.");
      send(
        200,
        db.saveBackup(user!.id, validatedBackup(body.state), body.revision),
      );
      return;
    }
    if (req.url === "/subscription/status") {
      send(
        200,
        user!.id === "development"
          ? { configured: false, pro: false }
          : await subscription(user!.id),
      );
      return;
    }
    const dexcom = cgm(user!.id);
    if (req.url === "/cgm/status") {
      send(200, {
        dexcom: dexcom.status(),
        libre: {
          configured: false,
          note: "Abbott-authorized partner integration is not configured.",
        },
      });
      return;
    }
    if (req.url === "/cgm/dexcom/start") {
      const result = dexcom.start();
      const state = new URL(result.url).searchParams.get("state")!;
      for (const [k, v] of oauthOwners)
        if (v.expires < Date.now()) oauthOwners.delete(k);
      oauthOwners.set(state, { id: user!.id, expires: Date.now() + 600000 });
      send(200, result);
      return;
    }
    if (req.url === "/cgm/dexcom/sync") {
      send(200, await dexcom.sync());
      return;
    }
    if (req.url === "/cgm/dexcom/disconnect") {
      send(200, dexcom.disconnect());
      return;
    }

    const chargeAI = async () => {
      if (!key) throw new ServiceError(503, "AI provider is not configured.");
      if (user!.id !== "development") {
        const tier = await subscription(user!.id);
        const limit = Number(
          tier.pro
            ? process.env.PRO_AI_DAILY_LIMIT || "50"
            : process.env.FREE_AI_DAILY_LIMIT || "5",
        );
        db.useAI(user!.id, Number.isFinite(limit) ? limit : 5);
      }
    };
    if (req.url === "/food") {
      if (
        body.mimeType !== "image/jpeg" ||
        typeof body.image !== "string" ||
        !body.image.length ||
        !/^[a-zA-Z0-9+/]+={0,2}$/.test(body.image)
      )
        throw new Error("Provide a JPEG food photo.");
      await chargeAI();
      const text = await generate(
        [
          {
            text: 'Estimate the entire visible meal, not per 100 g. Return only JSON {name,calories,protein,carbs,fat,fibre,uncertainty}. Grams for macros, kcal for energy. Explain portion uncertainty and hidden ingredients. If no identifiable food, return name="Unrecognized food", all numbers=0 and ask for manual entry. Never claim allergen or diabetes safety.',
          },
          { inlineData: { mimeType: "image/jpeg", data: body.image } },
        ],
        policy,
        true,
      );
      send(200, validatePhotoResult(JSON.parse(text)));
      return;
    }
    if (
      typeof body.question !== "string" ||
      !body.question.trim() ||
      body.question.length > 2000
    )
      throw new Error("Question must contain 1–2000 characters.");
    const immediate = checkQuestion(body.question);
    if (immediate) {
      send(200, { text: immediate });
      return;
    }
    const { profile, targets } = serverTargets(body.profile || {});
    const history = Array.isArray(body.history)
      ? body.history.slice(-8).map((m: { role: string; text: string }) => ({
          role: m.role === "user" ? "user" : "assistant",
          text: String(m.text || "").slice(0, 2000),
        }))
      : [];
    await chargeAI();
    const text = await generate(
      [
        {
          text: JSON.stringify({
            profile,
            targets,
            history,
            question: body.question,
          }),
        },
      ],
      policy,
    );
    // Defense in depth only, not proof of clinical correctness.
    if (
      /(stop|skip|increase|decrease|taper|wean|reduce).{0,45}(insulin|ozempic|wegovy|mounjaro|injection|semaglutide|tirzepatide)|(insulin|injection).{0,45}(\d+\s*(mg|units)|take a break)/i.test(
        text,
      )
    ) {
      send(200, {
        text: "Medication changes need your prescriber’s advice. I can help with logs and general education.",
      });
      return;
    }
    send(200, { text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    send(
      e instanceof ServiceError
        ? e.status
        : message.includes("provider") || message.includes("configured")
          ? 503
          : 400,
      {
        error: message.includes("JSON")
          ? "Could not read the request or food estimate."
          : message,
      },
    );
  }
});
server.on("close", () => db.close());
server.listen(
  Number(process.env.PORT || 8787),
  process.env.HOST || "127.0.0.1",
  () => console.log("Snap to Fit account and AI service ready."),
);
