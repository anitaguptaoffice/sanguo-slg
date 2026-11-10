import { expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { runExplicitRegistrationScenario } from "./explicitRegistration.browser.mjs";

it.each(["pageerror", "console", "response"])("never exposes raw %s or filled-field errors", async event => {
  const secret = "disposable-test-credential";
  const artifactDir = await mkdtemp(`${tmpdir()}/register-redaction-`);
  const control: any = {
    on(type: string, handler: (value: any) => void) {
      if (type !== event) return;
      if (type === "pageerror") handler(new Error(secret));
      if (type === "console") handler({ type: () => "error", text: () => secret });
      if (type === "response") handler({ status: () => 500, url: () => `https://host/${secret}` });
    },
    off() {}, locator: () => control, routeWebSocket: async () => {},
    goto: async () => { throw new Error(`fill('${secret}') failed`); },
    viewportSize: () => ({ width: 1280, height: 720 }),
  };
  try {
    const error = await runExplicitRegistrationScenario({ page: control, artifactDir, accounts: {}, fresh: { login: secret, password: secret }, freshInterrupted: {} }).catch((error: Error) => error);
    expect(error.message).toBe("Registration scenario failed at form; inspect sanitized evidence.");
    const report = await readFile(`${artifactDir}/explicit-registration.json`, "utf8");
    expect(report).not.toContain(secret);
    expect(JSON.parse(report).failures).toEqual([{ label: "form", category: event === "response" ? "http" : event, ...(event === "response" ? { status: 500 } : {}) }]);
  } finally { await rm(artifactDir, { recursive: true, force: true }); }
});
