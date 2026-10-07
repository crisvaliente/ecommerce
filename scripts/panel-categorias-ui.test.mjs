import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const PAGE_FILE = new URL("../src/pages/panel/categorias/index.tsx", import.meta.url);

const CATEGORIA = { id: "cat-1", nombre: "Remeras", slug: "remeras", descripcion: null, orden: null };
const ERROR_MSG_STATE = 8;

function findElement(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
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
    page.effects[0]();
    await new Promise((resolve) => setImmediate(resolve));
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
    page.effects[0]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(supabaseCalls, []);
  } finally {
    page.restore();
  }
});

async function loadWritePage({ stateValues, writeResponse = { ok: true, status: 201, json: async () => ({ item: CATEGORIA }) } }) {
  const fetchCalls = [];
  const page = await loadPage({
    stateValues,
    supabase: {
      auth: { getSession: async () => ({ data: { session: { access_token: "token-a" } }, error: null }) },
      from() { throw new Error("categoria must not be written directly"); },
    },
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return args[1].method === "GET" ? { ok: true, json: async () => ({ items: [] }) } : writeResponse;
    },
  });
  return { page, fetchCalls };
}

const LISTING_REQUEST = ["/api/panel/categorias", { method: "GET", headers: { Authorization: "Bearer token-a" } }];
const JSON_HEADERS = { Authorization: "Bearer token-a", "Content-Type": "application/json" };

async function submitForm(page) {
  const form = findElement(page.tree, (element) => element.type === "form");
  assert.ok(form);
  await form.props.onSubmit({ preventDefault() {} });
}

test("creating posts to the canonical endpoint without tenant input, then refreshes the listing", async () => {
  const { page, fetchCalls } = await loadWritePage({
    stateValues: [[], false, false, null, " Nueva ", "nueva", "", undefined, null],
  });
  try {
    await submitForm(page);
    assert.deepEqual(fetchCalls, [
      ["/api/panel/categorias", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ nombre: "Nueva", slug: "nueva", descripcion: null, orden: null }),
      }],
      LISTING_REQUEST,
    ]);
  } finally {
    page.restore();
  }
});

test("editing patches the selected category through the canonical endpoint", async () => {
  const { page, fetchCalls } = await loadWritePage({
    stateValues: [[CATEGORIA], false, false, "cat-1", "Remeras", "remeras", "Algodón", 2, null],
    writeResponse: { ok: true, status: 200, json: async () => ({ item: CATEGORIA }) },
  });
  try {
    await submitForm(page);
    assert.deepEqual(fetchCalls, [
      ["/api/panel/categorias?id=cat-1", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ nombre: "Remeras", slug: "remeras", descripcion: "Algodón", orden: 2 }),
      }],
      LISTING_REQUEST,
    ]);
  } finally {
    page.restore();
  }
});

test("deleting uses the canonical endpoint after confirmation", async () => {
  const originalConfirm = globalThis.confirm;
  globalThis.confirm = () => true;
  const { page, fetchCalls } = await loadWritePage({
    stateValues: [[CATEGORIA], false, false, null, "", "", "", undefined, null],
    writeResponse: { ok: true, status: 204 },
  });
  try {
    const button = findElement(page.tree, (element) => element.type === "button" && element.props.children.includes("Eliminar"));
    assert.ok(button);
    await button.props.onClick();
    assert.deepEqual(fetchCalls, [
      ["/api/panel/categorias?id=cat-1", { method: "DELETE", headers: { Authorization: "Bearer token-a" } }],
      LISTING_REQUEST,
    ]);
  } finally {
    globalThis.confirm = originalConfirm;
    page.restore();
  }
});

test("write conflicts show a specific message and skip the listing refresh", async (t) => {
  const cases = [
    ["categoria_duplicada", "Ya existe una categoría con ese nombre."],
    ["internal_error", "No se pudo guardar la categoría."],
  ];
  for (const [error, message] of cases) {
    await t.test(error, async () => {
      const { page, fetchCalls } = await loadWritePage({
        stateValues: [[], false, false, null, "Nueva", "nueva", "", undefined, null],
        writeResponse: { ok: false, status: error === "internal_error" ? 500 : 409, json: async () => ({ error }) },
      });
      try {
        await submitForm(page);
        assert.equal(fetchCalls.length, 1);
        assert.equal(page.stateUpdates.filter((update) => update.index === ERROR_MSG_STATE).at(-1).nextValue, message);
      } finally {
        page.restore();
      }
    });
  }
});

test("deleting a category in use explains the conflict", async () => {
  const originalConfirm = globalThis.confirm;
  globalThis.confirm = () => true;
  const { page } = await loadWritePage({
    stateValues: [[CATEGORIA], false, false, null, "", "", "", undefined, null],
    writeResponse: { ok: false, status: 409, json: async () => ({ error: "categoria_en_uso" }) },
  });
  try {
    const button = findElement(page.tree, (element) => element.type === "button" && element.props.children.includes("Eliminar"));
    await button.props.onClick();
    assert.equal(
      page.stateUpdates.filter((update) => update.index === ERROR_MSG_STATE).at(-1).nextValue,
      "No se puede eliminar: hay productos que usan esta categoría.",
    );
  } finally {
    globalThis.confirm = originalConfirm;
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

test("delete buttons are disabled while a write is in progress", async () => {
  const { page } = await loadWritePage({
    stateValues: [[CATEGORIA], false, true, null, "", "", "", undefined, null],
  });
  try {
    const button = findElement(page.tree, (element) => element.type === "button" && element.props.children.includes("Eliminar"));
    assert.equal(button.props.disabled, true);
  } finally {
    page.restore();
  }
});
