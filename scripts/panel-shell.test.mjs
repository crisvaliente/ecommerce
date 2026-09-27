import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

const ADMIN_LAYOUT_FILE = new URL("../src/components/layout/AdminLayout.tsx", import.meta.url).pathname;
const SIDEBAR_FILE = new URL("../src/components/layout/panel/Sidebar.tsx", import.meta.url).pathname;
const CAPABILITIES_FILE = new URL("../src/lib/panelRouteCapabilities.ts", import.meta.url).pathname;

const validUser = (role = "staff") => ({
  loading: false,
  sessionUser: { id: "auth-user", email: "auth@example.com" },
  dbUser: {
    supabase_uid: "auth-user",
    nombre: "Auth User",
    rol: role,
    empresa_id: "empresa-a",
  },
});

function loadSource(module, filename) {
  const source = require("node:fs").readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(compiled, filename);
}

function withModuleLoader({ auth, pathname = "/panel", effects = null }, load) {
  const originalLoad = Module._load;
  const originalTs = Module._extensions[".ts"];
  const originalTsx = Module._extensions[".tsx"];
  const React = require("react");
  const reactForComponent = effects ? {
    ...React,
    useEffect(effect) { effects.push(effect); },
  } : React;
  const router = {
    pathname,
    replacements: [],
    replace(destination) { this.replacements.push(destination); },
  };

  Module._extensions[".ts"] = loadSource;
  Module._extensions[".tsx"] = loadSource;
  Module._load = function (id, parent, isMain) {
    if (id === "react") return reactForComponent;
    if (id === "next/router") return { useRouter: () => router };
    if (id === "next/link") return function Link({ href, children, ...props }) {
      return React.createElement("a", { href, ...props }, children);
    };
    if (id.includes("context/AuthContext")) return { useAuth: () => auth };
    if (id.includes("config/instance")) return { instanceConfig: { store: { name: "Test store" } } };
    if (id.includes("panel/Navbar")) return function Navbar() {
      return React.createElement("header", { "data-navbar": true });
    };
    return originalLoad.call(this, id, parent, isMain);
  };

  try {
    for (const filename of [ADMIN_LAYOUT_FILE, SIDEBAR_FILE, CAPABILITIES_FILE]) {
      delete require.cache[filename];
    }
    return load({ React, router });
  } finally {
    Module._load = originalLoad;
    Module._extensions[".ts"] = originalTs;
    Module._extensions[".tsx"] = originalTsx;
  }
}

function renderLayout(options) {
  return withModuleLoader(options, ({ React }) => {
    const { renderToStaticMarkup } = require("react-dom/server");
    const AdminLayout = require(ADMIN_LAYOUT_FILE).default;
    return renderToStaticMarkup(React.createElement(AdminLayout, null, "Protected child"));
  });
}

function renderSidebar(options) {
  return withModuleLoader(options, ({ React }) => {
    const { renderToStaticMarkup } = require("react-dom/server");
    const Sidebar = require(SIDEBAR_FILE).default;
    return renderToStaticMarkup(React.createElement(Sidebar));
  });
}

function renderLayoutWithManualEffects(options) {
  const effects = [];
  const result = withModuleLoader({ ...options, effects }, ({ React, router }) => {
    const { renderToStaticMarkup } = require("react-dom/server");
    const AdminLayout = require(ADMIN_LAYOUT_FILE).default;
    return {
      markup: renderToStaticMarkup(React.createElement(AdminLayout, null, "Protected child")),
      router,
    };
  });
  return { ...result, effects };
}

function sidebarLinksAndDecisions(auth) {
  return withModuleLoader({ auth }, ({ React }) => {
    const { renderToStaticMarkup } = require("react-dom/server");
    const Sidebar = require(SIDEBAR_FILE).default;
    const { decidePanelAdmission } = require(CAPABILITIES_FILE);
    const visible = links(renderToStaticMarkup(React.createElement(Sidebar)));
    return { decidePanelAdmission, visible };
  });
}

function links(markup) {
  return [...markup.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

test("withholds the protected layout for denied admissions", () => {
  const cases = [
    { name: "cliente", auth: validUser("cliente") },
    { name: "mismatched identity", auth: { ...validUser(), dbUser: { ...validUser().dbUser, supabase_uid: "other-user" } } },
    { name: "malformed identity", auth: { ...validUser(), sessionUser: {} } },
    { name: "missing company", auth: { ...validUser(), dbUser: { ...validUser().dbUser, empresa_id: null } } },
    { name: "loading", auth: { ...validUser(), loading: true } },
  ];

  for (const scenario of cases) {
    const markup = renderLayout({ auth: scenario.auth });
    assert.doesNotMatch(markup, /Protected child/, scenario.name);
    assert.doesNotMatch(markup, /data-navbar/, scenario.name);
  }
});

test("denies an unknown layout route instead of rendering panel content", () => {
  const markup = renderLayout({ auth: validUser(), pathname: "/panel/unknown" });
  assert.doesNotMatch(markup, /Protected child/);
});

test("redirects only after the rendered layout's manually executed effect", () => {
  const cases = [
    { auth: { ...validUser(), sessionUser: null }, destination: "/auth/login" },
    { auth: validUser("cliente"), destination: "/auth/no-autorizado" },
    { auth: { ...validUser(), dbUser: { ...validUser().dbUser, empresa_id: null } }, destination: "/auth/registroempresa" },
    { auth: validUser(), pathname: "/panel/unknown", destination: "/auth/no-autorizado" },
  ];

  for (const scenario of cases) {
    const result = renderLayoutWithManualEffects(scenario);
    assert.equal(result.effects.length, 1);
    assert.deepEqual(result.router.replacements, []);
    result.effects[0]();
    assert.deepEqual(result.router.replacements, [scenario.destination]);
  }
});

test("renders sidebar links only when their canonical admission allows them", () => {
  assert.deepEqual(links(renderSidebar({ auth: validUser("admin") })), [
    "/panel",
    "/panel/productos",
    "/panel/categorias",
    "/panel/pedidos",
    "/panel/payments",
  ]);
  assert.deepEqual(links(renderSidebar({ auth: validUser("staff") })), [
    "/panel",
    "/panel/productos",
    "/panel/categorias",
    "/panel/pedidos",
  ]);

  for (const auth of [
    validUser("cliente"),
    { ...validUser(), loading: true },
    { ...validUser(), dbUser: { ...validUser().dbUser, supabase_uid: "other-user" } },
    { ...validUser(), dbUser: { ...validUser().dbUser, empresa_id: "" } },
  ]) {
    assert.deepEqual(links(renderSidebar({ auth })), []);
  }
});

test("sidebar visibility matches the real admission decision for every link", () => {
  for (const role of ["admin", "staff", "cliente"]) {
    const auth = validUser(role);
    const { decidePanelAdmission, visible } = sidebarLinksAndDecisions(auth);
    for (const href of ["/panel", "/panel/productos", "/panel/categorias", "/panel/pedidos", "/panel/payments"]) {
      const decision = decidePanelAdmission({ ...auth, pathname: href });
      assert.equal(visible.includes(href), decision.kind === "allow", `${role} ${href}`);
    }
  }
});
