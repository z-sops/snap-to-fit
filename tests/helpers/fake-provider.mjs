// Test-only preload for the server child process.
//
// It intercepts the AI provider call so no paid provider is ever contacted,
// and records the exact request the server built, so a test can inspect what
// the model would actually have been sent. Everything else is passed through
// untouched.
const realFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input && input.url) || "";
  if (!url.includes("generativelanguage.googleapis.com")) return realFetch(input, init);
  const body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
  process.stdout.write(`__PROVIDER_REQUEST__${JSON.stringify({ url, body })}\n`);
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Here is how your day adds up against your targets." }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
