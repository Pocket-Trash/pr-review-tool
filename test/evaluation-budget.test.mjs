import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetTotal,
  startEvaluationProxy,
} from "../src/evaluation-budget.mjs";

const model = {
  id: "model",
  contextLength: 100000,
  inputPerMillionUsd: 1,
  outputPerMillionUsd: 2,
};
async function harness(fetchImpl, budgetUsd = 1) {
  const ledger = { budgetUsd, requests: [] };
  let checkpoints = 0;
  const proxy = await startEvaluationProxy({
    apiKey: "real-secret",
    models: [model],
    ledger,
    checkpoint: async () => {
      checkpoints++;
    },
    fetchImpl,
  });
  proxy.session = "session-1";
  const request = (changes = {}) =>
    fetch(`${proxy.baseURL}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${proxy.token}` },
      body: JSON.stringify({
        model: "model",
        messages: [],
        max_tokens: 1000,
        ...changes,
      }),
    });
  return { proxy, ledger, request, checkpoints: () => checkpoints };
}
test("request proxy reserves durably, caps price/output, and accounts actual cost", async () => {
  const h = await harness(async (url, options) => {
    assert.ok(h.checkpoints() >= 1);
    assert.equal(options.headers.authorization, "Bearer real-secret");
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 1000);
    assert.deepEqual(body.provider.max_price, { prompt: 1, completion: 2 });
    return new Response(
      JSON.stringify({ id: "generation", usage: { cost: 0.01 } }),
      { headers: { "content-type": "application/json" } },
    );
  });
  try {
    assert.equal((await h.request()).status, 200);
    assert.equal(budgetTotal(h.ledger.requests), 0.01);
    assert.equal(h.ledger.requests[0].generationId, "generation");
  } finally {
    await h.proxy.close();
  }
});
test("budget denies upstream requests and never releases unknown/interrupted spend", async () => {
  let calls = 0;
  const h = await harness(async () => {
    calls++;
    throw new Error("secret must not leak");
  }, 0.11);
  try {
    const failure = await h.request();
    assert.equal(failure.status, 502);
    assert.doesNotMatch(await failure.text(), /secret must/);
    assert.ok(budgetTotal(h.ledger.requests) > 0.1);
    assert.equal((await h.request()).status, 402);
    assert.equal(calls, 1);
  } finally {
    await h.proxy.close();
  }
});
test("streamed usage is accounted and unsupported models/modalities cannot call upstream", async () => {
  let calls = 0;
  const h = await harness(async () => {
    calls++;
    return new Response(
      'data: {"id":"gen","choices":[],"usage":{"cost":0.02}}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } },
    );
  });
  try {
    assert.equal((await h.request({ model: "unapproved" })).status, 403);
    assert.equal(
      (await h.request({ messages: [{ content: [{ type: "image_url" }] }] }))
        .status,
      403,
    );
    const response = await h.request({ stream: true });
    assert.match(await response.text(), /DONE/);
    assert.equal(budgetTotal(h.ledger.requests), 0.02);
    assert.equal(calls, 1);
  } finally {
    await h.proxy.close();
  }
});

test("missing billing metadata stops further requests with the full reservation retained", async () => {
  const h = await harness(async () => new Response('{"choices":[]}'));
  try {
    await (await h.request()).text();
    assert.equal(h.proxy.blocked, true);
    assert.equal(h.ledger.requests[0].status, "unmetered");
    assert.ok(budgetTotal(h.ledger.requests) > 0.1);
    assert.equal((await h.request()).status, 402);
  } finally {
    await h.proxy.close();
  }
});

test("SSE DONE ends the request even if the upstream leaves its connection open", async () => {
  let cancelled = false;
  const h = await harness(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"id":"gen-done","usage":{"cost":0.03}}\n\ndata: [DONE]\n\n',
              ),
            );
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  try {
    await Promise.race([
      h.request({ stream: true }).then((response) => response.text()),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(Error("DONE did not finish")), 2000),
      ),
    ]);
    assert.equal(cancelled, true);
    assert.equal(budgetTotal(h.ledger.requests), 0.03);
    assert.equal(h.ledger.requests[0].generationId, "gen-done");
  } finally {
    await h.proxy.close();
  }
});

test("concurrent requests cannot share a reservation and shutdown preserves uncertain billing", async () => {
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const h = await harness(async (_url, { signal }) => {
    started();
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(Error("cancelled")), {
        once: true,
      }),
    );
  }, 0.15);
  const client = h
    .request()
    .then((response) => response.text())
    .catch(() => {});
  await ready;
  assert.equal((await h.request()).status, 402);
  await h.proxy.close();
  await client;
  assert.equal(h.ledger.requests.length, 1);
  assert.equal(h.ledger.requests[0].status, "interrupted");
  assert.ok(budgetTotal(h.ledger.requests) > 0.1);
  assert.throws(
    () => budgetTotal([{ costUsd: -1 }]),
    /Invalid request accounting/,
  );
});
