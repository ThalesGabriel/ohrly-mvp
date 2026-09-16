const BASE_KEY = "ohrly:private:v1";
const SCOPE_KEY = "ohrly:private:scope:v1";

export type PrivateEpisodeUpdate = {
  id: string;
  text: string;
};

export type PrivateAccountData = {
  externalId: string;
  name: string;
  owner?: string;
  attributes: Record<string, string>;
  source?: string;
  importedAt?: string;
};

type PrivateStore = {
  episodeAliases: Record<string, string>;
  episodeNotes: Record<string, string>;
  interventionObjectives: Record<string, string>;
  updateTexts: Record<string, string>;
  accountData: Record<string, PrivateAccountData>;
};

const empty: PrivateStore = {
  episodeAliases: {},
  episodeNotes: {},
  interventionObjectives: {},
  updateTexts: {},
  accountData: {},
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


export function setAccountPrivateData(id: string, value: PrivateAccountData) {
  const store = load();
  store.accountData[id] = {
    ...value,
    externalId: value.externalId.trim(),
    name: value.name.trim(),
    owner: value.owner?.trim() || undefined,
  };
  save(store);
}

export function getAccountPrivateData(id: string): PrivateAccountData {
  const value = load().accountData[id];
  return value || { externalId: "", name: `Conta ${id.slice(0, 6).toUpperCase()}`, attributes: {} };
}

export function findAccountIdByExternalId(externalId: string) {
  const needle = externalId.trim();
  if (!needle) return null;
  const entries = Object.entries(load().accountData);
  return entries.find(([, value]) => value.externalId === needle)?.[0] ?? null;
}

export function getAllAccountPrivateData(): Record<string, PrivateAccountData> {
  return load().accountData;
}
