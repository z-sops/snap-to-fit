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
/** Requests allowed per minute per client. The default is a deliberate protection. */
const rateLimit = Math.max(1, Number(process.env.SNAP_RATE_LIMIT_PER_MINUTE) || 20);
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
    name: "User",    consent: true,
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

/**
 * The only numbers the coach may receive about the user's day: calories in
 * kcal, macros in grams. Anything else a client sends is dropped.
 */
const TOTAL_LIMITS = {
  calories: 20000,
  protein: 2000,
  carbs: 2000,
  fat: 2000,
} as const;
type DailyTotals = { -readonly [K in keyof typeof TOTAL_LIMITS]: number };

/**
 * Every call to the AI provider needs explicit consent from the account
 * holder, and the check happens here, on the server, before anything is sent.
 *
 * The client's own flag is not trusted on its own: a request that does not
 * carry a confirmed `aiConsent: true` never reaches the provider at all, so
 * no profile, conversation, photograph or daily total leaves the service.
 * This covers the whole prompt, not just the daily totals: the totals are
 * reduced to four numbers, but the rest of the prompt still contains the
 * user's profile and their conversation.
 *
 * Local safety answers (emergencies, medication and steroid questions) are
 * produced by this service itself and never leave it, so they are still
 * answered when consent has not been given.
 */
function requireAIConsent(body: { aiConsent?: unknown }) {
  if (body.aiConsent === true) return;
  if (body.aiConsent === false)
    throw new ServiceError(400, "AI consent is required for the connected coach. Turn it on in Settings.");
  if (body.aiConsent === undefined)
    throw new ServiceError(400, "This app version cannot confirm AI consent. Update Snap to Fit to use the AI features.");
  throw new ServiceError(400, "Invalid AI consent value.");
}

/**
 * Validate the daily totals a client sends. Only allowlisted, finite,
 * in-range numbers survive; missing, negative, non-numeric and excessive
 * values are left out rather than passed on.
 */
export function validatedTotals(raw: unknown): Partial<DailyTotals> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Partial<DailyTotals> = {};
  for (const key of Object.keys(TOTAL_LIMITS) as (keyof DailyTotals)[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (value < 0 || value > TOTAL_LIMITS[key]) continue;
    out[key] = Math.round(value * 10) / 10;
  }
  return Object.keys(out).length ? out : undefined;
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
  // Behind the Caddy reverse proxy every request comes from the proxy; use the client IP it forwards.
  const forwarded = process.env.TRUST_PROXY === "1" ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "";
  const ip = forwarded || req.socket.remoteAddress || "local";
  const now = Date.now();
  for (const [k, v] of attempts) if (v.expires < now) attempts.delete(k);
  const entry = attempts.get(ip) || { count: 0, expires: now + 60000 };
  entry.count++;
  attempts.set(ip, entry);
  if (entry.count > rateLimit) {
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
      // A photograph is health data, so it is only sent with confirmed consent.
      requireAIConsent(body);
      await chargeAI();
      const text = await generate(
        [
          {
            text: 'Identify every food in the photo and estimate the portion of each in grams as served (cooked weight). Return only JSON {name,items:[{name,grams}],cookingFat,calories,protein,carbs,fat,fibre,uncertainty}. items: plain generic food names a US nutrition database would use (e.g. "white rice, cooked", "chicken breast, grilled", "naan"), one entry per food. cookingFat: visible or likely added oil/butter/ghee beyond the foods themselves, one of "none","tsp","tbsp","lots". Totals are for the entire visible meal in kcal and grams. uncertainty: one or two sentences on portion size and hidden ingredients (oil, sauces, sugar). If no identifiable food, return name="Unrecognized food", items=[], all numbers=0 and ask for manual entry. Never claim allergen or diabetes safety.',
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
      // Answered by this service, never sent to the provider.
      send(200, { text: immediate });
      return;
    }
    // Nothing reaches the provider without confirmed consent.
    requireAIConsent(body);
    const { profile, targets } = serverTargets(body.profile || {});
    const history = Array.isArray(body.history)
      ? body.history.slice(-8).map((m: { role: string; text: string }) => ({
          role: m.role === "user" ? "user" : "assistant",
          text: String(m.text || "").slice(0, 2000),
        }))
      : [];
    const sanitizeInsulin = (x: unknown) => {
      if (!x || typeof x !== "object") return undefined;
      const v = x as { types?: unknown; recentLow?: unknown; notices?: unknown };
      return {
        types: Array.isArray(v.types) ? v.types.filter((t) => ["long", "rapid", "mixed", "other"].includes(String(t))).slice(0, 6) : [],
        recentLow: !!v.recentLow,
        notices: Array.isArray(v.notices) ? v.notices.map((n) => String(n).slice(0, 300)).slice(0, 5) : [],
      };
    };
    const replyLanguages: Record<string, string> = {
      en: "English (US)",
      es: "Spanish (US). Write the whole answer in natural, simple US Spanish.",
      fr: "French. Write the whole answer in natural, simple French.",
      de: "German. Write the whole answer in natural, simple German (use du).",
      pt: "Brazilian Portuguese. Write the whole answer in natural, simple Brazilian Portuguese.",
    };
    const language: "en" | "es" | "fr" | "de" | "pt" = ["es", "fr", "de", "pt"].includes(body.language) ? body.language : "en";
    // Consent was already confirmed above, so this is the only path to the
    // provider. Today's logged totals are only useful with a target to
    // compare them to: a restricted profile has no targets, so it gets no
    // totals either.
    const todayTotals = targets ? validatedTotals(body.totals) : undefined;
    await chargeAI();
    const text = await generate(
      [
        {
          text: JSON.stringify({
            profile,
            targets,
            todayTotals,
            history,
            insulinSafety: sanitizeInsulin(body.insulinSafety),
            question: body.question,
            replyLanguage: replyLanguages[language],
          }),
        },
      ],
      policy,
    );
    // Defense in depth only, not proof of clinical correctness.
    if (
      /(stop|skip|increase|decrease|taper|wean|reduce|suspend|dej|salt|aument|dismin|reduc|baj|arr[eê]t|augment|diminu|absetz|erh[öo]h|verringer|reduzier|pare|parar|interromp).{0,45}(insulin|ozempic|wegovy|mounjaro|injection|inyecci|injeç|injekt|spritze|semaglutid|tirzepatid)|(insulin|injection|inyecci|injeç|injekt|spritze).{0,45}(\d+\s*(mg|units|unidades|unités|einheiten)|take a break|descans|pause)/i.test(
        text,
      )
    ) {
      send(200, {
        text: {
          en: "Medication changes need your prescriber’s advice. I can help with logs and general education.",
          es: "Los cambios de medicamento necesitan el consejo de tu médico. Puedo ayudarte con tus registros y con educación general.",
          fr: "Tout changement de médicament doit être décidé avec votre médecin. Je peux vous aider avec votre suivi et des informations générales.",
          de: "Änderungen an Medikamenten brauchen den Rat deiner Ärztin oder deines Arztes. Ich helfe dir gern bei deinen Einträgen und mit allgemeinen Infos.",
          pt: "Mudanças de medicamento precisam da orientação do seu médico. Posso ajudar com seus registros e com informações gerais.",
        }[language],
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
