import { randomBytes } from "node:crypto";
export interface CGMReading {
  id: string;
  at: string;
  value: number | null;
  unit: "mg/dL" | "mmol/L";
  trend: string | null;
  status: "high" | "low" | null;
  source: string;
}
export function normalizeDexcom(
  records: unknown[],
  sandbox: boolean,
): CGMReading[] {
  return records
    .flatMap((record) => {
      const r = record as Record<string, unknown>;
      const at = String(r.systemTime || "");
      const stamp = /Z$|[+-]\d\d:\d\d$/.test(at) ? at : at + "Z";
      if (
        !r.recordId ||
        !Number.isFinite(new Date(stamp).getTime()) ||
        !["mg/dL", "mmol/L"].includes(String(r.unit))
      )
        return [];
      const status: CGMReading["status"] =
        r.status === "low" || r.value === 39
          ? "low"
          : r.status === "high" || r.value === 401
            ? "high"
            : null;
      const value =
        typeof r.value === "number" && Number.isFinite(r.value) && !status
          ? r.value
          : null;
      if (!status && (value === null || value <= 0)) return [];
      return [
        {
          id: `dexcom-${sandbox ? "sandbox" : "production"}-${r.recordId}`,
          at: stamp,
          value,
          unit: r.unit as CGMReading["unit"],
          trend: typeof r.trend === "string" ? r.trend : null,
          status,
          source: sandbox
            ? "Dexcom sandbox (simulated)"
            : "Dexcom historical API",
        },
      ];
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}
export function createDexcom(
  env: Record<string, string | undefined> = process.env,
  fetcher: typeof fetch = fetch,
  storage?: {
    load: () => { access: string; refresh: string; expires: number } | null;
    save: (
      v: { access: string; refresh: string; expires: number } | null,
    ) => void;
  },
) {
  const region = env.DEXCOM_REGION || "sandbox";
  const hosts: Record<string, string> = {
    sandbox: "https://sandbox-api.dexcom.com",
    us: "https://api.dexcom.com",
    eu: "https://api.dexcom.eu",
    jp: "https://api.dexcom.jp",
  };
  const host = hosts[region];
  const id = env.DEXCOM_CLIENT_ID || "";
  const secret = env.DEXCOM_CLIENT_SECRET || "";
  const redirect = env.DEXCOM_REDIRECT_URI || "";
  const configured = !!(host && id && secret && /^https:\/\//.test(redirect));
  let credentials: { access: string; refresh: string; expires: number } | null =
    storage?.load() || null;
  const states = new Map<string, number>();
  let generation = 0;
  let work = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T>) => {
    const task = work.then(fn);
    work = task.then(
      () => {},
      () => {},
    );
    return task;
  };
  async function exchange(params: Record<string, string>) {
    const response = await fetcher(`${host}/v3/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id,
        client_secret: secret,
        ...params,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error("Dexcom authorization failed. Reconnect your account.");
    const result = await response.json();
    if (
      typeof result.access_token !== "string" ||
      typeof result.refresh_token !== "string" ||
      !Number.isFinite(result.expires_in)
    )
      throw new Error("Invalid Dexcom token response.");
    return {
      access: result.access_token,
      refresh: result.refresh_token,
      expires: Date.now() + result.expires_in * 1000,
    };
  }
  return {
    status() {
      return {
        configured,
        connected: !!credentials,
        region,
        sandbox: region === "sandbox",
        note:
          region === "sandbox"
            ? "Sandbox is simulated data."
            : "Historical API. Mobile data may be delayed by 1 hour in the US and 3 hours outside the US. Do not use for current safety decisions.",
      };
    },
    start() {
      if (!configured)
        throw new Error(
          "Dexcom is not configured. Developer credentials and an approved HTTPS callback are required.",
        );
      for (const [s, t] of states) if (t < Date.now()) states.delete(s);
      if (states.size > 20) states.clear();
      const state = randomBytes(32).toString("hex");
      states.set(state, Date.now() + 600000);
      const url = new URL(`${host}/v3/oauth2/login`);
      url.search = new URLSearchParams({
        client_id: id,
        redirect_uri: redirect,
        response_type: "code",
        scope: "offline_access",
        state,
      }).toString();
      return { url: url.toString() };
    },
    async callback(state: string, code: string) {
      const expires = states.get(state);
      states.delete(state);
      if (!expires || expires < Date.now())
        throw new Error("Invalid or expired authorization state.");
      if (!code || code.length > 2000)
        throw new Error("Dexcom authorization was not completed.");
      const expected = generation;
      const next = await exchange({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirect,
      });
      if (expected !== generation) throw new Error("Connection was cancelled.");
      credentials = next;
      storage?.save(next);
    },
    disconnect() {
      generation++;
      states.clear();
      credentials = null;
      storage?.save(null);
      return {
        connected: false,
        note: "App session disconnected. Revoke authorization in your Dexcom account to remove provider access.",
      };
    },
    sync() {
      return exclusive(async () => {
        if (!credentials) throw new Error("Connect your Dexcom account first.");
        const expected = generation;
        if (credentials.expires <= Date.now() + 60000) {
          const next = await exchange({
            grant_type: "refresh_token",
            refresh_token: credentials.refresh,
          });
          if (expected !== generation)
            throw new Error("Connection was cancelled.");
          credentials = next;
          storage?.save(next);
        }
        const url = new URL(`${host}/v3/users/self/egvs`);
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 3600000);
        url.search = new URLSearchParams({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }).toString();
        const response = await fetcher(url, {
          headers: { Authorization: `Bearer ${credentials.access}` },
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok)
          throw new Error(
            "Dexcom data could not sync. Reconnect if access has been revoked.",
          );
        const result = await response.json();
        if (expected !== generation)
          throw new Error("Connection was cancelled.");
        if (!Array.isArray(result.records))
          throw new Error("Invalid Dexcom data response.");
        return {
          readings: normalizeDexcom(result.records, region === "sandbox"),
          syncedAt: new Date().toISOString(),
          ...this.status(),
        };
      });
    },
  };
}
