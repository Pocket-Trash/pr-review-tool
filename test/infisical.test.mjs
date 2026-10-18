import assert from "node:assert/strict";
import test from "node:test";
import {
  credentialEnvironment,
  fetchInfisicalCredential,
  maskCommand,
} from "../src/infisical.mjs";

const env = {
  INFISICAL_GITHUB_IDENTITY_ID: "identity",
  INFISICAL_PROJECT_ID: "project",
  ACTIONS_ID_TOKEN_REQUEST_URL:
    "https://oidc.actions.githubusercontent.com/token?existing=1",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "github-request-token",
  GITHUB_REPOSITORY_OWNER: "Pocket-Trash",
};
const reply = (value) => ({ ok: true, json: async () => value });

function harness(secretName, value = "credential-value") {
  const requests = [];
  const masks = [];
  const fetch = async (url, options) => {
    requests.push({ url: new URL(url), options });
    if (requests.length === 1) return reply({ value: "github-jwt" });
    if (requests.length === 2) return reply({ accessToken: "infisical-token" });
    return reply({
      secret: {
        secretKey: secretName,
        secretPath: "/tools/github/pr-review-tool",
        secretValue: value,
        secretValueHidden: false,
      },
    });
  };
  return { requests, masks, fetch, mask: (value) => masks.push(value) };
}

for (const [kind, source, target] of [
  ["analysis", "CHEAPERINFERENCE_API_KEY", "CHEAPER_INFERENCE_API_KEY"],
  ["publication", "PR_REVIEW_APP_PRIVATE_KEY", "PR_REVIEW_APP_PRIVATE_KEY"],
])
  test(`${kind} exchanges OIDC and fetches only its exact credential`, async () => {
    const h = harness(source);
    assert.deepEqual(
      await fetchInfisicalCredential(kind, env, h.fetch, h.mask),
      {
        name: target,
        value: "credential-value",
      },
    );
    assert.equal(h.requests.length, 3);
    const [oidc, login, secret] = h.requests;
    assert.equal(oidc.url.searchParams.get("existing"), "1");
    assert.equal(
      oidc.url.searchParams.get("audience"),
      "https://github.com/Pocket-Trash",
    );
    assert.equal(
      login.url.href,
      "https://app.infisical.com/api/v1/auth/oidc-auth/login",
    );
    assert.deepEqual(JSON.parse(login.options.body), {
      identityId: "identity",
      jwt: "github-jwt",
    });
    assert.equal(secret.url.pathname, `/api/v4/secrets/${source}`);
    assert.equal(secret.url.searchParams.get("projectId"), "project");
    assert.equal(secret.url.searchParams.get("environment"), "preview");
    assert.equal(
      secret.url.searchParams.get("secretPath"),
      "/tools/github/pr-review-tool",
    );
    assert.equal(secret.url.searchParams.get("includeImports"), "true");
    assert.equal(
      secret.url.searchParams.get("expandSecretReferences"),
      "false",
    );
    assert.equal(
      secret.options.headers.authorization,
      "Bearer infisical-token",
    );
    for (const { options } of h.requests) {
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
    }
    assert.deepEqual(h.masks, [
      "github-jwt",
      "infisical-token",
      "credential-value",
    ]);
  });

test("an exact-name imported credential can retain its source path", async () => {
  const h = harness("CHEAPERINFERENCE_API_KEY");
  const fetch = async (...args) => {
    const response = await h.fetch(...args);
    const body = await response.json();
    if (body.secret) body.secret.secretPath = "/services/cheaper-inference";
    return reply(body);
  };
  assert.deepEqual(
    await fetchInfisicalCredential("analysis", env, fetch, h.mask),
    {
      name: "CHEAPER_INFERENCE_API_KEY",
      value: "credential-value",
    },
  );
  assert.equal(h.requests.length, 3);
});

test("invalid mode, bootstrap configuration, and unsafe origins fail before requests", async () => {
  for (const [kind, changes] of [
    ["other", {}],
    ["analysis", { INFISICAL_PROJECT_ID: "" }],
    ["analysis", { INFISICAL_DOMAIN: "http://app.infisical.com" }],
    ["analysis", { INFISICAL_DOMAIN: "https://user:pass@app.infisical.com" }],
    ["analysis", { INFISICAL_DOMAIN: "https://app.infisical.com/path" }],
    ["analysis", { INFISICAL_SECRET_PATH: "/tools/../other" }],
  ]) {
    const h = harness("CHEAPERINFERENCE_API_KEY");
    await assert.rejects(
      fetchInfisicalCredential(kind, { ...env, ...changes }, h.fetch, h.mask),
    );
    assert.equal(h.requests.length, 0);
  }
});

test("authentication and secret failures cannot expose response bodies or fall back", async () => {
  for (const failureAt of [1, 2, 3]) {
    const h = harness("CHEAPERINFERENCE_API_KEY");
    let calls = 0;
    const fetch = (...args) => {
      calls += 1;
      if (calls === failureAt)
        return {
          ok: false,
          status: 403,
          json: async () => ({ secretValue: "must-not-leak" }),
        };
      return h.fetch(...args);
    };
    await assert.rejects(
      fetchInfisicalCredential("analysis", env, fetch, h.mask),
      /HTTP 403/,
    );
    assert.equal(calls, failureAt);
  }
  await assert.rejects(
    fetchInfisicalCredential(
      "analysis",
      env,
      () => {
        throw Error("secret-in-network-error");
      },
      () => {},
    ),
    (error) => error.message === "GitHub OIDC request failed",
  );
});

test("missing tokens and mismatched, hidden, or empty secrets are rejected", async () => {
  for (const responses of [
    [{}, {}, {}],
    [{ value: "jwt" }, {}, {}],
    [
      { value: "jwt" },
      { accessToken: "token" },
      { secret: { secretKey: "WRONG" } },
    ],
    [
      { value: "jwt" },
      { accessToken: "token" },
      {
        secret: {
          secretKey: "CHEAPERINFERENCE_API_KEY",
          secretValue: "\0",
        },
      },
    ],
    [
      { value: "jwt" },
      { accessToken: "token" },
      {
        secret: {
          secretKey: "CHEAPERINFERENCE_API_KEY",
          secretPath: "/tools/github/pr-review-tool",
          secretValue: "",
        },
      },
    ],
    [
      { value: "jwt" },
      { accessToken: "token" },
      {
        secret: {
          secretKey: "CHEAPERINFERENCE_API_KEY",
          secretPath: "/tools/github/pr-review-tool",
          secretValue: "hidden",
          secretValueHidden: true,
        },
      },
    ],
  ]) {
    await assert.rejects(
      fetchInfisicalCredential(
        "analysis",
        env,
        async () => reply(responses.shift()),
        () => {},
      ),
    );
  }
});

test("PEM newlines are masked and exported without environment-command injection", () => {
  const value =
    "-----BEGIN PRIVATE KEY-----\r\nline%data\nOTHER=value\n-----END PRIVATE KEY-----\n";
  assert.equal(maskCommand(value).includes("\n"), false);
  assert.match(maskCommand(value), /%0D%0Aline%25data/);
  const output = credentialEnvironment({
    name: "PR_REVIEW_APP_PRIVATE_KEY",
    value,
  });
  const [header] = output.split("\n");
  const delimiter = header.split("<<")[1];
  assert.equal(output, `${header}\n${value}\n${delimiter}\n`);
  assert.match(delimiter, /^pr_review_[a-f0-9-]+$/);
});
