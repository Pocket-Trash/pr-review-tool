import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

export function budgetTotal(requests) {
  return requests.reduce((total, request) => {
    const cost = request.costUsd ?? request.reservedUsd;
    if (!Number.isFinite(cost) || cost < 0)
      throw new TypeError("Invalid request accounting");
    return total + cost;
  }, 0);
}

// Only this loopback proxy holds the real key; OpenCode receives a random token.
export async function startEvaluationProxy({
  apiKey,
  models,
  ledger,
  checkpoint,
  fetchImpl = fetch,
}) {
  const token = randomUUID();
  const control = {
    session: null,
    blocked: ledger.requests.some(
      (request) =>
        ["in-progress", "interrupted", "unmetered"].includes(request.status) ||
        request.boundExceeded,
    ),
  };
  const shutdown = new AbortController();
  const pending = new Set();
  let writes = Promise.resolve();
  const save = () => (writes = writes.then(checkpoint));
  const handle = async (request, response) => {
    let entry;
    const cancelled = new AbortController();
    response.once("close", () => {
      if (!response.writableEnded) cancelled.abort();
    });
    const fail = (status, message) => {
      if (response.headersSent) response.end();
      else {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(
          JSON.stringify({ error: { message, type: "evaluation_guard" } }),
        );
      }
    };
    try {
      if (
        request.method !== "POST" ||
        request.url !== "/api/v1/chat/completions" ||
        request.headers.authorization !== `Bearer ${token}`
      )
        return fail(403, "Unsupported evaluation request");
      let raw = "";
      for await (const chunk of request) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 8 * 1024 * 1024)
          return fail(413, "Evaluation request exceeds input limit");
      }
      const body = JSON.parse(raw);
      const model = models.find((model) => model.id === body.model);
      if (
        !model ||
        !control.session ||
        (body.n !== undefined && body.n !== 1) ||
        body.messages?.some(
          (message) =>
            Array.isArray(message.content) &&
            message.content.some(
              (part) => !["text", "reasoning"].includes(part.type),
            ),
        )
      )
        return fail(403, "Unsupported evaluation model or modality");
      const outputTokens = Math.min(
        32768,
        model.maxOutputTokens ||
          body.max_tokens ||
          body.max_completion_tokens ||
          32768,
      );
      if (!Number.isInteger(outputTokens) || outputTokens < 1)
        return fail(400, "Invalid output limit");
      // Reserve full model context at uncached price plus capped output, not a guessed prompt size.
      const reservedUsd =
        ((model.contextLength * model.inputPerMillionUsd +
          outputTokens * model.outputPerMillionUsd) /
          1e6) *
        1.01;
      if (
        control.blocked ||
        budgetTotal(ledger.requests) + reservedUsd > ledger.budgetUsd
      ) {
        control.blocked = true;
        return fail(402, "Evaluation stopped at the approved budget");
      }
      entry = {
        id: randomUUID(),
        session: control.session,
        model: model.id,
        status: "in-progress",
        reservedUsd,
        maxOutputTokens: outputTokens,
      };
      ledger.requests.push(entry);
      await save();
      const upstream = await fetchImpl(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.any([
            AbortSignal.timeout(15 * 60 * 1000),
            shutdown.signal,
            cancelled.signal,
          ]),
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ...body,
            max_tokens: outputTokens,
            max_completion_tokens: undefined,
            models: undefined,
            route: undefined,
            plugins: [],
            provider: {
              sort: "price",
              max_price: {
                prompt: model.inputPerMillionUsd,
                completion: model.outputPerMillionUsd,
              },
              require_parameters: true,
            },
            usage: { include: true },
            ...(body.stream ? { stream_options: { include_usage: true } } : {}),
          }),
        },
      );
      if (!upstream.ok) {
        entry.status = "error";
        entry.httpStatus = upstream.status;
        await save();
        return fail(upstream.status, `OpenRouter HTTP ${upstream.status}`);
      }
      response.writeHead(200, {
        "content-type":
          upstream.headers.get("content-type") || "text/event-stream",
      });
      let text = "";
      let finalChunk;
      for await (const chunk of upstream.body) {
        text += Buffer.from(chunk).toString();
        if (!entry.generationId && body.stream) {
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (typeof payload.id === "string") {
                entry.generationId = payload.id;
                await save();
                break;
              }
            } catch {
              /* The first event can span network chunks. */
            }
          }
        }
        if (body.stream && /^data:\s*\[DONE\]\s*$/m.test(text)) {
          finalChunk = chunk;
          break;
        }
        response.write(chunk);
      }
      const payloads = body.stream
        ? text
            .split("\n")
            .filter(
              (line) => line.startsWith("data: ") && !line.includes("[DONE]"),
            )
            .flatMap((line) => {
              try {
                return [JSON.parse(line.slice(6))];
              } catch {
                return [];
              }
            })
        : [JSON.parse(text)];
      const usage = payloads.findLast((payload) => payload.usage)?.usage;
      const cost = usage?.cost;
      entry.status = "complete";
      if (typeof cost === "number" && Number.isFinite(cost) && cost >= 0) {
        entry.costUsd = cost;
        if (cost > reservedUsd) {
          control.blocked = true;
          entry.boundExceeded = true;
        }
      } else {
        entry.status = "unmetered";
        control.blocked = true;
      }
      entry.generationId = payloads.find((payload) => payload.id)?.id;
      entry.usage = usage;
      await save();
      if (finalChunk) response.write(finalChunk);
      response.end();
    } catch {
      if (entry) {
        entry.status = "interrupted";
        control.blocked = true;
        try {
          await save();
        } catch {
          /* Keep the durable reservation. */
        }
      }
      fail(502, "Evaluation request failed; reservation retained");
    }
  };
  const server = createServer((request, response) => {
    const task = handle(request, response);
    pending.add(task);
    task.finally(() => pending.delete(task)).catch(() => {});
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    ...control,
    get blocked() {
      return control.blocked;
    },
    set session(value) {
      control.session = value;
    },
    token,
    baseURL: `http://127.0.0.1:${server.address().port}/api/v1`,
    close: async () => {
      control.blocked = true;
      shutdown.abort();
      const closing = new Promise((resolve) => server.close(resolve));
      server.closeAllConnections();
      await Promise.allSettled([...pending]);
      await closing;
      await writes;
    },
  };
}
