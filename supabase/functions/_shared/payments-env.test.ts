import { requireRequestStripeEnv, resolveRequestStripeEnv } from "./payments-env.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const requestFrom = (origin: string) =>
  new Request("https://example.com", { headers: { Origin: origin } });

Deno.test("native app origins use live payments", () => {
  assertEquals(resolveRequestStripeEnv(requestFrom("capacitor://localhost")), {
    env: "live",
    origin: "capacitor://localhost",
    source: "live origin pattern",
  });
  assertEquals(resolveRequestStripeEnv(requestFrom("https://localhost")), {
    env: "live",
    origin: "https://localhost",
    source: "live origin pattern",
  });
});

Deno.test("local development origins use sandbox payments", () => {
  for (const origin of ["http://localhost:8080", "https://localhost:8080"]) {
    assertEquals(resolveRequestStripeEnv(requestFrom(origin)), {
      env: "sandbox",
      origin,
      source: "sandbox origin pattern",
    });
  }
});

Deno.test("a sandbox declaration from the Android app is rejected", async () => {
  const result = requireRequestStripeEnv(
    requestFrom("https://localhost"),
    "create-task-checkout",
    "sandbox",
  );
  if (!("response" in result)) throw new Error("Expected a mode mismatch response");
  assertEquals(result.response.status, 409);
  assertEquals((await result.response.json()).code, "payments_mode_mismatch");
});
