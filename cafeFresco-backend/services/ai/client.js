// The only gateway to OpenAI (A2, A6, A8, A12): timeout, one retry, daily token budget, usage counters,
// and an offline mock with the same interface so tests never need the key or cost money.
const { ai } = require('../../config/env');
const AiUsage = require('../../models/aiUsage');
const { now } = require('../stats');
const mock = require('./mock');

class AiError extends Error {
    // code: disabled | timeout | rate_limited | budget | upstream | moderation
    constructor(code, message) {
        super(message || code);
        this.name = 'AiError';
        this.code = code;
    }
}

let sdk = null;
const openai = () => {
    if (!sdk) {
        const OpenAI = require('openai');
        sdk = new (OpenAI.default || OpenAI)({ apiKey: ai().apiKey, maxRetries: 0 });
    }
    return sdk;
};

// mock (test) usage is counted under its own key, so it never touches the real budget or cost figures
const today = () => `${ai().mock ? 'mock:' : ''}${now().format('YYYY-MM-DD')}`;

const status = () => (ai().mock ? 'mock' : ai().apiKey ? 'enabled' : 'disabled');

async function usedToday() {
    const row = await AiUsage.findOne({ day: today() }).lean();
    return (row?.tokensIn || 0) + (row?.tokensOut || 0);
}

// The dashboard may set a lower daily budget (Assistant settings); it can never exceed AI_DAILY_TOKEN_BUDGET
async function dailyBudget() {
    const cap = ai().dailyBudget;
    try {
        const set = (await require('../settings').getSettings()).chatbot?.dailyTokenBudget;
        return Number.isFinite(set) && set >= 0 ? Math.min(set, cap) : cap;
    } catch {
        return cap;
    }
}

async function assertAvailable() {
    if (status() === 'disabled') throw new AiError('disabled', 'AI is not configured');
    if ((await usedToday()) >= (await dailyBudget())) throw new AiError('budget', 'Daily AI budget reached');
}

const record = (inc) => AiUsage.updateOne({ day: today() }, { $inc: inc }, { upsert: true }).catch(() => {});

const toAiError = (err) => {
    if (err instanceof AiError) return err;
    if (err?.name === 'AbortError' || /aborted|timed? ?out/i.test(err?.message || '')) return new AiError('timeout', 'The AI service took too long');
    if (err?.status === 429) return new AiError('rate_limited', 'The AI service is busy');
    return new AiError('upstream', 'The AI service is unavailable');
};

const retryable = (err) => err?.status === 429 || (err?.status >= 500 && err?.status < 600);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs fn(signal) with the timeout; one retry on 429/5xx with jitter. `outer` lets the caller abort (client left).
async function withRetry(fn, outer) {
    for (let attempt = 0; ; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ai().timeoutMs);
        const onOuter = () => ctrl.abort();
        outer?.addEventListener('abort', onOuter);
        try {
            return await fn(ctrl.signal);
        } catch (err) {
            if (attempt === 0 && retryable(err) && !outer?.aborted) {
                await sleep(400 + Math.random() * 600);
                continue;
            }
            throw toAiError(err);
        } finally {
            clearTimeout(timer);
            outer?.removeEventListener('abort', onOuter);
        }
    }
}

/**
 * Streaming chat completion with tools.
 * onDelta(text) receives answer text as it arrives. Resolves to
 * { content, toolCalls:[{id,name,arguments}], usage:{in,out} }.
 */
async function chat({ messages, tools, maxTokens = 500, onDelta, signal, temperature = 0.3 }) {
    await assertAvailable();
    const result = ai().mock
        ? await mock.chat({ messages, tools, onDelta })
        : await withRetry(async (abortSignal) => {
              const stream = await openai().chat.completions.create(
                  {
                      model: ai().model,
                      messages,
                      ...(tools?.length ? { tools, parallel_tool_calls: true } : {}),
                      max_tokens: maxTokens,
                      temperature,
                      stream: true,
                      stream_options: { include_usage: true },
                  },
                  { signal: abortSignal }
              );
              let content = '';
              const calls = [];
              let usage = { in: 0, out: 0 };
              for await (const chunk of stream) {
                  if (chunk.usage) usage = { in: chunk.usage.prompt_tokens || 0, out: chunk.usage.completion_tokens || 0 };
                  const delta = chunk.choices?.[0]?.delta;
                  if (!delta) continue;
                  if (delta.content) {
                      content += delta.content;
                      onDelta?.(delta.content);
                  }
                  for (const tc of delta.tool_calls || []) {
                      const slot = (calls[tc.index] = calls[tc.index] || { id: '', name: '', arguments: '' });
                      if (tc.id) slot.id = tc.id;
                      if (tc.function?.name) slot.name += tc.function.name;
                      if (tc.function?.arguments) slot.arguments += tc.function.arguments;
                  }
              }
              return { content, toolCalls: calls.filter(Boolean), usage };
          }, signal);
    await record({ tokensIn: result.usage.in, tokensOut: result.usage.out, calls: 1 });
    return result;
}

// Embeddings for an array of texts → array of vectors (same order)
async function embed(texts) {
    if (!texts.length) return [];
    await assertAvailable();
    if (ai().mock) {
        await record({ embedCalls: 1 });
        return texts.map(mock.embed);
    }
    const res = await withRetry((abortSignal) => openai().embeddings.create({ model: ai().embedModel, input: texts }, { signal: abortSignal }));
    await record({ tokensIn: res.usage?.prompt_tokens || 0, embedCalls: 1 });
    return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// true when the text should be refused; failures of the moderation service never block a customer
async function flagged(text) {
    if (status() !== 'enabled') return ai().mock ? mock.flagged(text) : false;
    try {
        const res = await withRetry((abortSignal) => openai().moderations.create({ model: ai().moderationModel, input: text }, { signal: abortSignal }));
        return Boolean(res.results?.[0]?.flagged);
    } catch {
        return false;
    }
}

module.exports = { AiError, chat, embed, flagged, status, usedToday, dailyBudget, _withRetry: withRetry };
