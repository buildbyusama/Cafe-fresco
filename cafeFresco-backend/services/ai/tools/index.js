// Tool registry for the assistant (A1, A3): OpenAI schemas, argument validation, safe outputs.
// handler(args, ctx) → { data, cards? }. ctx = { userId|null, anonId, sessionId, userName, reqId }.
const tools = [...require('./menu'), ...require('./store'), ...require('./account'), ...require('./escalate')];
const byName = new Map(tools.map((t) => [t.name, t]));

const MAX_OUTPUT = 1500; // characters of JSON the model sees per tool call
const FORBIDDEN = /^(email|phone|password|resetPasswordToken|passwordChangedAt|userId|anonId|__v|stack|embedding|embeddingHash|idempotencyKey|stripePaymentIntentId|shippingAddress)$/;

// OpenAI tool definitions
const schemas = () => tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

// Minimal JSON-schema check for the shapes we use (object/string/number/integer/array/enum/min/max/required/additionalProperties)
function validate(schema, value, path = 'args') {
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return `${path} must be an object`;
        for (const k of schema.required || []) if (value[k] === undefined) return `${path}.${k} is required`;
        for (const [k, v] of Object.entries(value)) {
            if (!schema.properties?.[k]) {
                if (schema.additionalProperties === false) return `${path}.${k} is not allowed`;
                continue;
            }
            const err = validate(schema.properties[k], v, `${path}.${k}`);
            if (err) return err;
        }
        return null;
    }
    if (schema.type === 'string') {
        if (typeof value !== 'string') return `${path} must be text`;
        if (value.length > (schema.maxLength || 500)) return `${path} is too long`;
        if (schema.enum && !schema.enum.includes(value)) return `${path} must be one of ${schema.enum.join(', ')}`;
        return null;
    }
    if (schema.type === 'number' || schema.type === 'integer') {
        if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value))) return `${path} must be a ${schema.type}`;
        if (schema.minimum !== undefined && value < schema.minimum) return `${path} must be at least ${schema.minimum}`;
        if (schema.maximum !== undefined && value > schema.maximum) return `${path} must be at most ${schema.maximum}`;
        return null;
    }
    if (schema.type === 'array') {
        if (!Array.isArray(value)) return `${path} must be a list`;
        if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${path} has too many items`;
        for (const [i, v] of value.entries()) {
            const err = validate(schema.items, v, `${path}[${i}]`);
            if (err) return err;
        }
        return null;
    }
    return null;
}

// Drop forbidden keys anywhere in the output (defence in depth: handlers already pick safe fields)
function sanitize(value) {
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.fromEntries(Object.entries(value).filter(([k]) => !FORBIDDEN.test(k)).map(([k, v]) => [k, sanitize(v)]));
    }
    return value;
}

// Shrink lists until the JSON fits MAX_OUTPUT
function fit(data) {
    let json = JSON.stringify(data);
    const copy = JSON.parse(json);
    for (const key of ['items', 'orders', 'lines', 'categories', 'entries']) {
        while (json.length > MAX_OUTPUT && Array.isArray(copy[key]) && copy[key].length > 1) {
            copy[key].pop();
            copy.truncated = true;
            json = JSON.stringify(copy);
        }
    }
    return json.length > MAX_OUTPUT ? JSON.stringify({ ...copy, note: 'Result shortened' }).slice(0, MAX_OUTPUT) : json;
}

/**
 * Run one tool call from the model. Never throws: errors become a short message the model can relay.
 * → { name, content (JSON string for the model), cards, error? }
 */
async function run(name, rawArgs, ctx) {
    const tool = byName.get(name);
    if (!tool) return { name, content: JSON.stringify({ error: 'unknown_tool' }), cards: [], error: 'unknown_tool' };
    let args;
    try {
        args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs || {};
    } catch {
        return { name, content: JSON.stringify({ error: 'bad_arguments', message: 'Arguments were not valid JSON' }), cards: [], error: 'bad_arguments' };
    }
    const problem = validate(tool.parameters, args);
    if (problem) return { name, args, content: JSON.stringify({ error: 'bad_arguments', message: problem }), cards: [], error: 'bad_arguments' };
    try {
        const { data, cards = [] } = await tool.handler(args, ctx);
        return { name, args, content: fit(sanitize(data)), cards, data: sanitize(data) };
    } catch (err) {
        console.error(`Tool ${name} failed:`, err);
        return { name, args, content: JSON.stringify({ error: 'tool_failed', message: 'That lookup failed. Apologise and suggest trying again.' }), cards: [], error: 'tool_failed' };
    }
}

module.exports = { schemas, run, validate, names: () => [...byName.keys()], MAX_OUTPUT };
