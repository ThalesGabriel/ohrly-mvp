const BASE_KEY = "ohrly:private:v1";
const SCOPE_KEY = "ohrly:private:scope:v1";

export type PrivateEpisodeUpdate = {
  id: string;
  text: string;
};

type PrivateStore = {
  episodeAliases: Record<string, string>;
  episodeNotes: Record<string, string>;
  interventionObjectives: Record<string, string>;
  updateTexts: Record<string, string>;
};

const empty: PrivateStore = {
  episodeAliases: {},
  episodeNotes: {},
  interventionObjectives: {},
  updateTexts: {},
};

function currentScope() {
  if (typeof window === "undefined") return "local";
  return window.localStorage.getItem(SCOPE_KEY) || "local";
}

function storageKey() {
  return `${BASE_KEY}:${currentScope()}`;
}

export function setPrivateStorageScope(scope: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCOPE_KEY, scope || "signed-out");
}

function load(): PrivateStore {
  if (typeof window === "undefined") return { ...empty };
  try {
    const key = storageKey();
    let raw = window.localStorage.getItem(key);

    // Preserve the pre-auth local-mode data only in local development.
    if (!raw && currentScope() === "local") {
      const legacy = window.localStorage.getItem(BASE_KEY);
      if (legacy) {
        window.localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }

    return raw ? { ...empty, ...JSON.parse(raw) } : { ...empty };
  } catch {
    return { ...empty };
  }
}

function save(store: PrivateStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(), JSON.stringify(store));
}

export function setEpisodeAlias(id: string, value: string) {
  const store = load();
  store.episodeAliases[id] = value.trim();
  save(store);
}

export function getEpisodeAlias(id: string) {
  const value = load().episodeAliases[id];
  return value || `Caso ${id.slice(0, 6).toUpperCase()}`;
}

export function setEpisodeNote(id: string, value: string) {
  const store = load();
  store.episodeNotes[id] = value;
  save(store);
}

export function getEpisodeNote(id: string) {
  return load().episodeNotes[id] || "";
}

export function setInterventionObjective(id: string, value: string) {
  const store = load();
  store.interventionObjectives[id] = value;
  save(store);
}

export function getInterventionObjective(id: string) {
  return load().interventionObjectives[id] || "";
}

export function setEpisodeUpdateText(id: string, value: string) {
  const store = load();
  store.updateTexts[id] = value;
  save(store);
}

export function getEpisodeUpdateText(id: string) {
  return load().updateTexts[id] || "";
}
