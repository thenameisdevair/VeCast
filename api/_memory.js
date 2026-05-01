const store = globalThis.__VECAST_STORE__ ?? {
  decisions: [],
  startedAt: Date.now(),
};

globalThis.__VECAST_STORE__ = store;

export function getStartedAt() {
  return store.startedAt;
}

export function addDecision(decision) {
  store.decisions = [decision, ...store.decisions].slice(0, 50);
}

export function getDecisions() {
  return store.decisions;
}
