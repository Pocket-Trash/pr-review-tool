import { appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const credentials = {
  analysis: ["CHEAPERINFERENCE_API_KEY", "CHEAPER_INFERENCE_API_KEY"],
  publication: ["PR_REVIEW_APP_PRIVATE_KEY", "PR_REVIEW_APP_PRIVATE_KEY"],
};

export const maskCommand = (value) =>
  `::add-mask::${value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}`;

export async function fetchInfisicalCredential(
  kind,
  env,
  fetchImpl = fetch,
  mask = (value) => console.log(maskCommand(value)),
) {
  if (!Object.hasOwn(credentials, kind))
    throw new Error("Invalid credential job");
  const provider = env.REVIEW_PROVIDER || "cheaperinference";
  if (
    kind === "analysis" &&
    !["cheaperinference", "openrouter"].includes(provider)
  )
    throw new Error("Invalid analysis credential provider");
  for (const name of [
    "INFISICAL_GITHUB_IDENTITY_ID",
    "INFISICAL_PROJECT_ID",
    "ACTIONS_ID_TOKEN_REQUEST_URL",
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
    "GITHUB_REPOSITORY_OWNER",
  ])
    if (!env[name]) throw new Error(`Missing ${name}`);
  const domain = new URL(env.INFISICAL_DOMAIN || "https://app.infisical.com");
  const oidcUrl = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  for (const url of [domain, oidcUrl])
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error(
        "Credential endpoints must use HTTPS without URL credentials",
      );
  if (domain.pathname !== "/" || domain.search || domain.hash)
    throw new Error("Infisical domain must be an origin");
  const path = env.INFISICAL_SECRET_PATH || "/tools/github/pr-review-tool";
  if (!path.startsWith("/") || path.split("/").some((part) => part === ".."))
    throw new Error("Invalid Infisical secret path");

  async function json(url, options, label) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new Error(`${label} request failed`);
    }
    if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new Error(`${label} returned invalid JSON`);
    }
  }

  oidcUrl.searchParams.set(
    "audience",
    env.INFISICAL_OIDC_AUDIENCE ||
      `https://github.com/${env.GITHUB_REPOSITORY_OWNER}`,
  );
  const { value: jwt } = await json(
    oidcUrl,
    {
      headers: {
        authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
      },
    },
    "GitHub OIDC",
  );
  if (typeof jwt !== "string" || !jwt)
    throw new Error("Missing GitHub OIDC token");
  mask(jwt);
  const { accessToken } = await json(
    new URL("/api/v1/auth/oidc-auth/login", domain),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identityId: env.INFISICAL_GITHUB_IDENTITY_ID,
        jwt,
      }),
    },
    "Infisical OIDC login",
  );
  if (typeof accessToken !== "string" || !accessToken)
    throw new Error("Missing Infisical access token");
  mask(accessToken);
  const [secretName, name] =
    kind === "analysis" && provider === "openrouter"
      ? ["OPENROUTER_API_KEY", "OPENROUTER_API_KEY"]
      : credentials[kind];
  const secretUrl = new URL(`/api/v4/secrets/${secretName}`, domain);
  secretUrl.search = new URLSearchParams({
    projectId: env.INFISICAL_PROJECT_ID,
    environment: env.INFISICAL_ENVIRONMENT || "preview",
    secretPath: path,
    type: "shared",
    viewSecretValue: "true",
    expandSecretReferences: "false",
    // The configured folder imports service credentials; still fetch one name.
    includeImports: "true",
  }).toString();
  const { secret } = await json(
    secretUrl,
    { headers: { authorization: `Bearer ${accessToken}` } },
    "Infisical credential",
  );
  if (
    secret?.secretKey !== secretName ||
    secret.secretValueHidden ||
    typeof secret.secretValue !== "string" ||
    !secret.secretValue.trim() ||
    secret.secretValue.includes("\0")
  )
    throw new Error("Infisical returned an invalid credential");
  mask(secret.secretValue);
  return { name, value: secret.secretValue };
}

export function credentialEnvironment({ name, value }) {
  let delimiter;
  do delimiter = `pr_review_${randomUUID()}`;
  while (value.split(/\r?\n/).includes(delimiter));
  return `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (!process.env.GITHUB_ENV) throw new Error("Missing GITHUB_ENV");
    const credential = await fetchInfisicalCredential(
      process.argv[2],
      process.env,
    );
    await appendFile(
      process.env.GITHUB_ENV,
      credentialEnvironment(credential),
      {
        mode: 0o600,
      },
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
