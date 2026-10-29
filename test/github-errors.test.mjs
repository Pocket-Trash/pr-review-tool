import assert from "node:assert/strict";
import test from "node:test";
import { githubRequestError } from "../src/events.mjs";

test("GitHub write errors retain safe permission diagnostics, never arbitrary response content", async () => {
  const response = new Response(
    JSON.stringify({
      message: "Resource not accessible by integration",
      errors: [{ token: "fixture-sensitive-value" }],
    }),
    {
      status: 403,
      headers: {
        "x-accepted-github-permissions": "issues=write; pull_requests=write",
        "x-github-request-id": "AB12:1234:FFFF",
      },
    },
  );
  const error = await githubRequestError(response, "GitHub visual admission");
  assert.match(error.message, /failed: 403/);
  assert.match(error.message, /Resource not accessible by integration/);
  assert.match(error.message, /issues=write; pull_requests=write/);
  assert.match(error.message, /AB12:1234:FFFF/);
  assert.doesNotMatch(error.message, /fixture-sensitive-value/);
  for (const body of [
    "not JSON",
    JSON.stringify({ message: "fixture-secret" }),
    "null",
  ]) {
    const unsafe = new Response(body, {
      status: 403,
      headers: {
        "x-accepted-github-permissions": "fixture-secret",
        "x-github-request-id": "fixture-secret",
      },
    });
    assert.equal(
      (await githubRequestError(unsafe, "GitHub visual admission")).message,
      "GitHub visual admission failed: 403",
    );
  }
});
