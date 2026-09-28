import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const PAGE_FILE = new URL("../src/pages/panel/categorias/index.tsx", import.meta.url);

function findElement(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  for (const child of node.props?.children ?? []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

async function loadPage({ supabase, fetchImpl, stateValues = [] }) {
  const source = await readFile(PAGE_FILE, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: "categorias.tsx",
  }).outputText;
  const effects = [];
  const setters = [];
  const stateUpdates = [];
  let stateIndex = 0;
  const react = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) {
      const index = stateIndex;
      const value = index < stateValues.length ? stateValues[index] : initial;
      stateIndex += 1;
      const setter = (nextValue) => stateUpdates.push({ index, nextValue });
      setters.push(setter);
      return [value, setter];
    },
    useRef(value) { return { current: value }; },
    useCallback(callback) { return callback; },
    useEffect(effect) { effects.push(effect); },
  };
  const originalLoad = Module._load;
  const originalFetch = globalThis.fetch;
  Module._load = function (id, parent, isMain) {
    if (id === "react") return { __esModule: true, default: react, ...react };
    if (id === "../../../components/layout/AdminLayout") return { __esModule: true, default: ({ children }) => children };
    if (id === "../../../context/AuthContext") return { useAuth: () => ({ dbUser: { empresa_id: "empresa-a" }, loading: false }) };
    if (id === "../../../lib/supabaseClient") return { supabase };
    return originalLoad.call(this, id, parent, isMain);
  };
  globalThis.fetch = fetchImpl;
  try {
    const loaded = new Module(PAGE_FILE.pathname);
    loaded.filename = PAGE_FILE.pathname;
    loaded.paths = Module._nodeModulePaths(process.cwd());
    loaded._compile(compiled, PAGE_FILE.pathname);
    const tree = loaded.exports.default({});
    return {
      tree,
      effects,
      setters,
      stateUpdates,
      restore() { globalThis.fetch = originalFetch; },
    };
  } catch (error) {
    globalThis.fetch = originalFetch;
    throw error;
  } finally {
    Module._load = originalLoad;
  }
}

function categoryQuery() {
  return {
    select() { return this; },
    eq() { return this; },
    order() { return Promise.resolve({ data: [], error: null }); },
  };
}

test("listing uses the authenticated canonical endpoint without a browser category SELECT", async () => {
  const fetchCalls = [];
  const supabaseCalls = [];
  const page = await loadPage({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: "token-a" } }, error: null }) },
      from(table) { supabaseCalls.push(table); return categoryQuery(); },
    },
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return { ok: true, json: async () => ({ items: [] }) };
    },
  });
  try {
    await page.effects[0]();
    assert.deepEqual(fetchCalls, [["/api/panel/categorias", { method: "GET", headers: { Authorization: "Bearer token-a" } }]]);
    assert.deepEqual(supabaseCalls, []);
  } finally {
    page.restore();
  }
});

test("failed API listings do not fall back to direct category reads", async () => {
  const fetchCalls = [];
  const supabaseCalls = [];
  const page = await loadPage({
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: "token-a" } }, error: null }) },
      from(table) { supabaseCalls.push(table); return categoryQuery(); },
    },
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return { ok: false, status: 500, text: async () => "failure" };
    },
  });
  try {
    await page.effects[0]();
    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(supabaseCalls, []);
  } finally {
    page.restore();
  }
});

test("successful mutations retain listing refresh through the canonical request", async () => {
  const fetchCalls = [];
  const page = await loadPage({
    stateValues: [[], false, false, null, "Nueva", "nueva", "", undefined, null],
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: "token-a" } }, error: null }) },
      from() {
        return { insert: async () => ({ error: null }) };
      },
    },
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return { ok: true, json: async () => ({ items: [] }) };
    },
  });
  try {
    const form = findElement(page.tree, (element) => element.type === "form");
    assert.ok(form);
    await form.props.onSubmit({ preventDefault() {} });
    assert.deepEqual(fetchCalls, [["/api/panel/categorias", { method: "GET", headers: { Authorization: "Bearer token-a" } }]]);
  } finally {
    page.restore();
  }
});

test("newer listing requests prevent an older session response from replacing the list", async () => {
  let resolveFirstSession;
  const firstSession = new Promise((resolve) => { resolveFirstSession = resolve; });
  let sessionCalls = 0;
  const page = await loadPage({
    supabase: {
      auth: {
        getSession: () => {
          sessionCalls += 1;
          return sessionCalls === 1
            ? firstSession
            : Promise.resolve({ data: { session: { access_token: "token-new" } }, error: null });
        },
      },
      from() { throw new Error("listing must not read categoria directly"); },
    },
    fetchImpl: async (_url, request) => ({
      ok: true,
      json: async () => ({ items: [{ id: request.headers.Authorization, nombre: "Nueva", slug: "nueva", descripcion: null, orden: null }] }),
    }),
  });
  try {
    page.effects[0]();
    page.effects[0]();
    await new Promise((resolve) => setImmediate(resolve));
    resolveFirstSession({ data: { session: { access_token: "token-old" } }, error: null });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(
      page.stateUpdates.filter((update) => update.index === 0).map((update) => update.nextValue),
      [[{ id: "Bearer token-new", nombre: "Nueva", slug: "nueva", descripcion: null, orden: null }]],
    );
  } finally {
    page.restore();
  }
});
