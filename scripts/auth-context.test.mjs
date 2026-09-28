import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
const AUTH_CONTEXT_FILE = new URL("../src/context/AuthContext.tsx", import.meta.url).pathname;

function deferred() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function createHarness() {
  const states = [];
  const refs = [];
  const effects = [];
  let hookIndex = 0;
  let latestValue;
  let authListener;
  const activeSubscriptions = new Set();
  let nextSubscriptionId = 0;
  const sessions = [];
  const profiles = [];
  const signOuts = [];
  const queriedUids = [];
  const inserts = [];

  const react = {
    createContext() {
      return { Provider: Symbol("AuthContext.Provider") };
    },
    useContext() { return undefined; },
    useState(initial) {
      const index = hookIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef(initial) {
      const index = hookIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useCallback(callback) { hookIndex++; return callback; },
    useMemo(factory) { hookIndex++; return factory(); },
    useEffect(effect) {
      const index = hookIndex++;
      if (!effects[index]) effects[index] = { effect, cleanup: undefined, ran: false };
    },
  };
  const supabase = {
    auth: {
      getSession() { return sessions.shift().promise; },
      onAuthStateChange(listener) {
        authListener = listener;
        const id = nextSubscriptionId++;
        activeSubscriptions.add(id);
        return {
          data: {
            subscription: {
              unsubscribe() { activeSubscriptions.delete(id); },
            },
          },
        };
      },
      signOut() { return signOuts.shift()?.promise ?? Promise.resolve({ error: null }); },
    },
    from() {
      return {
        select() { return this; },
        eq(_field, uid) { queriedUids.push(uid); return this; },
        maybeSingle() { return profiles.shift().promise; },
        insert(value) { inserts.push(value); return this; },
        single() { return profiles.shift().promise; },
      };
    },
  };
  const originalLoad = Module._load;
  const originalTsx = Module._extensions[".tsx"];
  Module._extensions[".tsx"] = (module, filename) => {
    const source = require("node:fs").readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
  Module._load = function (id, parent, isMain) {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (id.includes("lib/supabaseClient")) return { supabase };
    return originalLoad.call(this, id, parent, isMain);
  };
  delete require.cache[AUTH_CONTEXT_FILE];
  const { AuthProvider } = require(AUTH_CONTEXT_FILE);
  Module._load = originalLoad;
  Module._extensions[".tsx"] = originalTsx;

  function render() {
    hookIndex = 0;
    const tree = AuthProvider({ children: null });
    latestValue = tree.props.value;
    for (const entry of effects) {
      if (entry && !entry.ran) {
        entry.ran = true;
        entry.cleanup = entry.effect();
      }
    }
    return latestValue;
  }

  return {
    sessions,
    profiles,
    signOuts,
    queriedUids,
    inserts,
    render,
    replayEffects() {
      effects.forEach((entry) => {
        entry?.cleanup?.();
        entry.cleanup = entry?.effect();
      });
    },
    unmount() { effects.forEach((entry) => entry?.cleanup?.()); },
    authEvent(session) { authListener("TOKEN_REFRESHED", session); },
    get activeSubscriptionCount() { return activeSubscriptions.size; },
    get value() { return latestValue; },
    get state() { return { loading: states[0], sessionUser: states[1], dbUser: states[2] }; },
  };
}

const user = (id) => ({ id, email: `${id}@example.com`, user_metadata: {} });
const session = (id) => ({ data: { session: { user: user(id) } }, error: null });
const profile = (id) => ({ data: { id: `profile-${id}`, supabase_uid: id, nombre: null, correo: null, rol: "cliente", empresa_id: null }, error: null });
const settled = (value) => ({ promise: Promise.resolve(value) });
const flush = () => new Promise((resolve) => setImmediate(resolve));

// This simulated callback-order proof is not real React/browser scheduling or StrictMode integration.
test("effect replay keeps one subscription and finishes its replacement load", async () => {
  const harness = createHarness();
  const staleSession = deferred();
  const staleProfile = settled(profile("account-stale"));
  const currentSession = deferred();
  const currentProfile = deferred();
  harness.sessions.push(staleSession, currentSession);
  harness.profiles.push(currentProfile);

  harness.render();
  harness.replayEffects();
  assert.equal(harness.activeSubscriptionCount, 1);

  currentSession.resolve(session("account-current"));
  await currentSession.promise;
  currentProfile.resolve(profile("account-current"));
  await currentProfile.promise;
  await flush();
  harness.render();
  assert.equal(harness.value.dbUser.supabase_uid, "account-current");
  assert.equal(harness.value.loading, false);

  harness.profiles.push(staleProfile);
  staleSession.resolve(session("account-stale"));
  await staleSession.promise;
  await flush();
  harness.render();
  assert.equal(harness.value.sessionUser.id, "account-current");
  assert.equal(harness.value.dbUser.supabase_uid, "account-current");
  assert.equal(harness.value.loading, false);
  assert.equal(harness.activeSubscriptionCount, 1);

  harness.unmount();
  assert.equal(harness.activeSubscriptionCount, 0);
});

test("a stale missing-profile result after replay cannot clear the current account", async () => {
  const harness = createHarness();
  const staleSession = deferred();
  const staleProfile = deferred();
  const currentSession = deferred();
  const currentProfile = deferred();
  harness.sessions.push(staleSession, currentSession);
  harness.profiles.push(staleProfile, currentProfile);

  harness.render();
  staleSession.resolve(session("account-stale"));
  await staleSession.promise;
  await flush();

  harness.replayEffects();
  currentSession.resolve(session("account-current"));
  await currentSession.promise;
  currentProfile.resolve(profile("account-current"));
  await currentProfile.promise;
  staleProfile.resolve({ data: null, error: null });
  await staleProfile.promise;
  await flush();
  harness.render();

  assert.equal(harness.inserts.length, 0);
  assert.equal(harness.value.dbUser.supabase_uid, "account-current");
  assert.equal(harness.value.loading, false);
});

test("an older getSession result cannot replace a newer authenticated account", async () => {
  const harness = createHarness();
  const first = deferred();
  const second = deferred();
  const secondProfile = deferred();
  const firstProfile = deferred();
  harness.sessions.push(first, second);
  harness.profiles.push(secondProfile);

  harness.render();
  harness.authEvent({ user: user("account-b") });
  second.resolve(session("account-b"));
  await second.promise;
  secondProfile.resolve(profile("account-b"));
  await secondProfile.promise;
  harness.render();
  assert.equal(harness.value.sessionUser.id, "account-b");

  harness.profiles.push(firstProfile);
  first.resolve(session("account-a"));
  await first.promise;
  harness.render();
  assert.equal(harness.value.sessionUser.id, "account-b");
});

test("an old profile completion leaves the current load pending", async () => {
  const harness = createHarness();
  const firstSession = deferred();
  const firstProfile = deferred();
  const secondSession = deferred();
  const secondProfile = deferred();
  harness.sessions.push(firstSession, secondSession);
  harness.profiles.push(firstProfile, secondProfile);

  harness.render();
  firstSession.resolve(session("account-a"));
  await firstSession.promise;
  harness.authEvent({ user: user("account-b") });
  secondSession.resolve(session("account-b"));
  await secondSession.promise;
  firstProfile.resolve(profile("account-a"));
  await firstProfile.promise;
  harness.render();
  assert.equal(harness.value.sessionUser.id, "account-b");
  assert.equal(harness.value.loading, true);

  secondProfile.resolve(profile("account-b"));
  await secondProfile.promise;
  harness.render();
  assert.equal(harness.value.dbUser.supabase_uid, "account-b");
  assert.equal(harness.value.loading, false);
});

test("logout invalidates pending work and cannot clear a newer account", async () => {
  const harness = createHarness();
  const sessionA = deferred();
  const profileA = deferred();
  const signOut = deferred();
  const sessionB = deferred();
  const profileB = deferred();
  harness.sessions.push(sessionA, sessionB);
  harness.profiles.push(profileA, profileB);
  harness.signOuts.push(signOut);

  harness.render();
  sessionA.resolve(session("account-a"));
  await sessionA.promise;
  const pendingSignOut = harness.value.signOut();
  harness.render();
  assert.deepEqual(harness.value, { ...harness.value, sessionUser: null, dbUser: null, loading: false });

  harness.authEvent({ user: user("account-b") });
  sessionB.resolve(session("account-b"));
  await sessionB.promise;
  profileB.resolve(profile("account-b"));
  await profileB.promise;
  harness.render();
  signOut.resolve({ error: null });
  await pendingSignOut;
  harness.render();
  assert.equal(harness.value.sessionUser.id, "account-b");
  assert.equal(harness.value.dbUser.supabase_uid, "account-b");

  profileA.resolve(profile("account-a"));
  await profileA.promise;
  await flush();
  harness.render();
  assert.equal(harness.value.sessionUser.id, "account-b");
  assert.equal(harness.value.dbUser.supabase_uid, "account-b");
  assert.equal(harness.value.loading, false);
});

const lookupError = { data: null, error: { message: "lookup failed" } };

async function withConsole(method, run) {
  const original = console[method];
  const calls = [];
  console[method] = (...args) => { calls.push(args); };
  try {
    await run(calls);
  } finally {
    console[method] = original;
  }
}

const withConsoleErrors = (run) => withConsole("error", run);

async function loadSingleAccount(lookups) {
  const harness = createHarness();
  harness.sessions.push(settled(session("account-c")));
  harness.profiles.push(...lookups.map(settled));
  harness.render();
  await flush();
  harness.render();
  return harness;
}

// The auth trigger owns provisioning; the browser only reads its own profile.
test("a missing profile is looked up once, never retried, never written from the browser, and warned", async () => {
  await withConsole("warn", async (warnings) => {
    // Extra queued lookups let a retrying/provisioning implementation proceed and fail on assertions.
    const harness = await loadSingleAccount([{ data: null, error: null }, { data: null, error: null }, profile("account-c")]);
    assert.deepEqual(harness.inserts, []);
    assert.deepEqual(harness.queriedUids, ["account-c"]);
    assert.equal(harness.value.sessionUser.id, "account-c");
    assert.equal(harness.value.dbUser, null);
    assert.equal(harness.value.loading, false);
    assert.equal(warnings.length, 1);
  });
});

test("a transient lookup error is retried once and publishes the recovered profile", async () => {
  await withConsoleErrors(async (errors) => {
    const harness = await loadSingleAccount([lookupError, profile("account-c")]);
    assert.deepEqual(harness.inserts, []);
    assert.deepEqual(harness.queriedUids, ["account-c", "account-c"]);
    assert.equal(harness.value.dbUser.supabase_uid, "account-c");
    assert.equal(harness.value.loading, false);
    assert.equal(errors.length, 1);
  });
});

test("a repeated lookup error stops after one retry and publishes no profile", async () => {
  await withConsoleErrors(async (errors) => {
    const harness = await loadSingleAccount([lookupError, lookupError, profile("account-c")]);
    assert.deepEqual(harness.inserts, []);
    assert.deepEqual(harness.queriedUids, ["account-c", "account-c"]);
    assert.equal(harness.value.sessionUser.id, "account-c");
    assert.equal(harness.value.dbUser, null);
    assert.equal(harness.value.loading, false);
    assert.equal(errors.length, 2);
  });
});

test("a retry superseded by a newer account cannot publish its profile", async () => {
  await withConsoleErrors(async () => {
    const harness = createHarness();
    const firstSession = deferred();
    const retryLookup = deferred();
    const secondSession = deferred();
    const secondProfile = deferred();
    harness.sessions.push(firstSession, secondSession);
    harness.profiles.push(settled(lookupError), retryLookup, secondProfile);

    harness.render();
    firstSession.resolve(session("account-a"));
    await firstSession.promise;
    await flush();
    assert.deepEqual(harness.queriedUids, ["account-a", "account-a"]);

    harness.authEvent({ user: user("account-b") });
    secondSession.resolve(session("account-b"));
    await secondSession.promise;
    secondProfile.resolve(profile("account-b"));
    await secondProfile.promise;
    retryLookup.resolve(profile("account-a"));
    await retryLookup.promise;
    await flush();
    harness.render();

    assert.equal(harness.value.sessionUser.id, "account-b");
    assert.equal(harness.value.dbUser.supabase_uid, "account-b");
    assert.equal(harness.value.loading, false);
  });
});

async function startPendingRetry(harness) {
  const retryLookup = deferred();
  harness.sessions.push(settled(session("account-a")));
  harness.profiles.push(settled(lookupError), retryLookup);
  harness.render();
  await flush();
  assert.deepEqual(harness.queriedUids, ["account-a", "account-a"]);
  return retryLookup;
}

test("a retry pending during logout cannot publish its profile", async () => {
  await withConsoleErrors(async () => {
    const harness = createHarness();
    const retryLookup = await startPendingRetry(harness);

    await harness.value.signOut();
    retryLookup.resolve(profile("account-a"));
    await retryLookup.promise;
    await flush();
    harness.render();

    assert.equal(harness.value.sessionUser, null);
    assert.equal(harness.value.dbUser, null);
    assert.equal(harness.value.loading, false);
  });
});

test("a retry pending during unmount cannot publish its profile", async () => {
  await withConsoleErrors(async () => {
    const harness = createHarness();
    const retryLookup = await startPendingRetry(harness);

    harness.unmount();
    retryLookup.resolve(profile("account-a"));
    await retryLookup.promise;
    await flush();

    assert.equal(harness.state.dbUser, null);
    assert.equal(harness.state.loading, true);
  });
});

test("anonymous sessions and returned getSession errors clear both users", async () => {
  const harness = createHarness();
  harness.sessions.push(settled({ data: { session: null }, error: { message: "expired" } }));

  harness.render();
  await flush();
  harness.render();
  assert.equal(harness.value.sessionUser, null);
  assert.equal(harness.value.dbUser, null);
  assert.equal(harness.value.loading, false);
});

test("a refresh superseded by an auth event cannot publish after the event", async () => {
  const harness = createHarness();
  const initial = deferred();
  const refresh = deferred();
  const event = deferred();
  const eventProfile = deferred();
  harness.sessions.push(initial, refresh, event);
  harness.profiles.push(eventProfile);

  harness.render();
  initial.resolve({ data: { session: null }, error: null });
  await initial.promise;
  const pendingRefresh = harness.value.refresh();
  harness.authEvent({ user: user("account-b") });
  event.resolve(session("account-b"));
  await event.promise;
  eventProfile.resolve(profile("account-b"));
  await eventProfile.promise;
  refresh.resolve(session("account-a"));
  await pendingRefresh;
  harness.render();
  assert.equal(harness.value.sessionUser.id, "account-b");
  assert.equal(harness.value.dbUser.supabase_uid, "account-b");
});

test("unmount prevents pending session work from publishing state", async () => {
  const harness = createHarness();
  const pendingSession = deferred();
  harness.sessions.push(pendingSession);

  harness.render();
  harness.unmount();
  pendingSession.resolve(session("account-a"));
  await pendingSession.promise;
  await flush();
  assert.deepEqual(harness.state, { loading: true, sessionUser: null, dbUser: null });
});
