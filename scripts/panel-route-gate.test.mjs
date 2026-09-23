import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");

const APP_FILE = new URL("../src/pages/_app.tsx", import.meta.url).pathname;
const HOME_FILE = new URL("../src/pages/panel/index.tsx", import.meta.url).pathname;
const GATE_FILE = new URL("../src/components/layout/PanelRouteGate.tsx", import.meta.url).pathname;
const CAPABILITIES_FILE = new URL("../src/lib/panelRouteCapabilities.ts", import.meta.url).pathname;

const validAuth = {
  loading: false,
  sessionUser: { id: "auth-user" },
  dbUser: {
    id: "profile-user",
    supabase_uid: "auth-user",
    rol: "staff",
    empresa_id: "empresa-a",
  },
};

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

function withModuleLoader({ auth = validAuth, pathname = "/panel" }, load) {
  const originalLoad = Module._load;
  const originalTs = Module._extensions[".ts"];
  const originalTsx = Module._extensions[".tsx"];
  const originalCss = Module._extensions[".css"];
  const React = require("react");
  const router = { pathname, replace() {} };
  function Head({ children }) { return React.createElement(React.Fragment, null, children); }
  function Header() { return React.createElement("header", { "data-public-header": true }); }
  function Footer() { return React.createElement("footer", { "data-public-footer": true }); }
  function CartProvider({ children }) { return children; }
  function AuthProvider({ children }) { return children; }
  function AdminLayout({ children }) {
    return React.createElement("section", { "data-admin-layout": true }, children);
  }

  Module._extensions[".ts"] = loadSource;
  Module._extensions[".tsx"] = loadSource;
  Module._extensions[".css"] = (module) => { module.exports = {}; };
  Module._load = function (id, parent, isMain) {
    if (id === "next/router") return { useRouter: () => router };
    if (id === "next/head") return Head;
    if (id.includes("components/common/Header")) return Header;
    if (id.includes("components/common/Footer")) return Footer;
    if (id.includes("components/ui/CartContext")) return { CartProvider };
    if (id.includes("context/AuthContext")) return { AuthProvider, useAuth: () => auth };
    if (id.includes("config/instance")) {
      return { instanceConfig: { store: { name: "Test store", description: "", assets: { favicon: "/favicon.ico" } } } };
    }
    if (id.includes("components/layout/AdminLayout")) return AdminLayout;
    return originalLoad.call(this, id, parent, isMain);
  };

  try {
    for (const filename of [APP_FILE, HOME_FILE, GATE_FILE, CAPABILITIES_FILE]) delete require.cache[filename];
    return load({ React, router });
  } finally {
    Module._load = originalLoad;
    Module._extensions[".ts"] = originalTs;
    Module._extensions[".tsx"] = originalTsx;
    Module._extensions[".css"] = originalCss;
  }
}

function renderApp(options, Component) {
  return withModuleLoader(options, ({ React }) => {
    const { renderToStaticMarkup } = require("react-dom/server");
    const MyApp = require(APP_FILE).default;
    return renderToStaticMarkup(React.createElement(MyApp, { Component, pageProps: {} }));
  });
}

function renderHome(options) {
  return withModuleLoader(options, ({ React }) => {
    const { renderToStaticMarkup } = require("react-dom/server");
    const PanelHomePage = require(HOME_FILE).default;
    return renderToStaticMarkup(React.createElement(PanelHomePage));
  });
}

test("does not invoke a denied panel page before its nested layout", () => {
  let calls = 0;
  const ProtectedPage = () => {
    calls += 1;
    return require("react").createElement("div", { "data-protected-page": true }, "protected");
  };

  const markup = renderApp({ auth: { ...validAuth, dbUser: { ...validAuth.dbUser, rol: "cliente" } } }, ProtectedPage);

  assert.equal(calls, 0);
  assert.doesNotMatch(markup, /data-protected-page/);
});

test("admits staff to the actual panel home component", () => {
  const markup = renderHome({ auth: validAuth });

  assert.match(markup, /Panel administrativo/);
  assert.match(markup, /data-admin-layout/);
});

function decision(input) {
  return withModuleLoader({}, () => require(CAPABILITIES_FILE).decidePanelAdmission(input));
}

function authFor(role, overrides = {}) {
  return {
    ...validAuth,
    ...overrides,
    dbUser: { ...validAuth.dbUser, rol: role, ...(overrides.dbUser ?? {}) },
  };
}

test("uses the exact pathname capability matrix through the actual app gate", async (t) => {
  const routes = [
    ["/panel", true],
    ["/panel/payments", false],
    ["/panel/productos", true],
    ["/panel/productos/nuevo", true],
    ["/panel/productos/[id]", true],
    ["/panel/categorias", true],
    ["/panel/pedidos", true],
    ["/panel/pedidos/[id]", true],
  ];
  const roles = [
    ["admin", () => true],
    ["staff", (staffAllowed) => staffAllowed],
    ["cliente", () => false],
    ["unknown-role", () => false],
  ];

  for (const [pathname, staffAllowed] of routes) {
    for (const [role, permits] of roles) {
      await t.test(`${role} ${pathname}`, () => {
        let calls = 0;
        const Page = () => {
          calls += 1;
          return require("react").createElement("div", { "data-protected-page": true });
        };
        const markup = renderApp({ pathname, auth: authFor(role) }, Page);
        assert.equal(calls, permits(staffAllowed) ? 1 : 0);
        assert.equal(markup.includes("data-protected-page"), permits(staffAllowed));
      });
    }
  }
});

test("fails closed for unknown and inherited route names", () => {
  const capabilityForPathname = withModuleLoader({}, () => require(CAPABILITIES_FILE).panelCapabilityForPathname);
  for (const pathname of ["/panel/productos/ProductForm", "/panel/unknown", "__proto__", "constructor"]) {
    assert.equal(capabilityForPathname(pathname), null, pathname);
    assert.deepEqual(decision({ ...validAuth, pathname }), {
      kind: "redirect",
      destination: "/auth/no-autorizado",
    });
  }
});

test("keeps loading and malformed observed auth state from mounting panel children", async (t) => {
  const cases = [
    ["loading", { ...validAuth, loading: true }, "loading"],
    ["anonymous", { ...validAuth, sessionUser: null }, "/auth/login"],
    ["missing profile", { ...validAuth, dbUser: null }, "/auth/no-autorizado"],
    ["profile UID mismatch", authFor("staff", { dbUser: { supabase_uid: "other" } }), "/auth/no-autorizado"],
    ["missing company", authFor("staff", { dbUser: { empresa_id: null } }), "/auth/registroempresa"],
    ["numeric session UID", { ...validAuth, sessionUser: { id: 3 } }, "/auth/no-autorizado"],
    ["inherited session UID", { ...validAuth, sessionUser: Object.create({ id: "auth-user" }) }, "/auth/no-autorizado"],
    ["blank profile UID", authFor("staff", { dbUser: { supabase_uid: " " } }), "/auth/no-autorizado"],
    ["numeric company", authFor("staff", { dbUser: { empresa_id: 3 } }), "/auth/no-autorizado"],
  ];

  for (const [name, auth, expected] of cases) {
    await t.test(name, () => {
      let calls = 0;
      const Page = () => {
        calls += 1;
        return require("react").createElement("div", { "data-protected-page": true });
      };
      const markup = renderApp({ pathname: "/panel", auth }, Page);
      const result = decision({ ...auth, pathname: "/panel" });
      assert.equal(calls, 0);
      assert.doesNotMatch(markup, /data-protected-page/);
      assert.equal(result.kind === "loading" ? result.kind : result.destination, expected);
    });
  }
});

test("keeps public routes outside the panel gate", () => {
  let calls = 0;
  const PublicPage = () => {
    calls += 1;
    return require("react").createElement("div", { "data-public-page": true });
  };

  const markup = renderApp({ pathname: "/productos", auth: authFor("cliente") }, PublicPage);

  assert.equal(calls, 1);
  assert.match(markup, /data-public-page/);
  assert.match(markup, /data-public-header/);
  assert.match(markup, /data-public-footer/);
});
