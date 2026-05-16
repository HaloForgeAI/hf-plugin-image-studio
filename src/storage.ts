import type { ImageStudioTask, StudioParams, StudioSettings } from "./types";

export const DEFAULT_SETTINGS: StudioSettings = {
  defaultModel: "gpt-image-1",
  defaultSize: "1024x1024",
  gatewayMode: "auto",
  customBaseUrl: "",
  customApiKey: "",
  clearPromptAfterSubmit: true,
  persistHistory: true,
};

export const DEFAULT_PARAMS: StudioParams = {
  model: DEFAULT_SETTINGS.defaultModel,
  size: DEFAULT_SETTINGS.defaultSize,
  quality: "auto",
  count: 1,
  format: "png",
  moderation: "auto",
  compression: null,
};

const DB_NAME = "haloforge-image-studio";
const DB_VERSION = 1;
const TASKS_STORE = "tasks";
const TASKS_KEY = "hfis.tasks.v1";
const SETTINGS_KEY = "hfis.settings.v1";
const MAX_TASKS = 120;

let dbPromise: Promise<IDBDatabase> | null = null;

export async function loadStoredTasks(): Promise<ImageStudioTask[]> {
  const indexedTasks = await getAllTasksFromDb();
  if (indexedTasks.length > 0) return indexedTasks.filter(isTaskLike).sort(sortTasks).slice(0, MAX_TASKS);

  const legacyTasks = loadLegacyLocalStorageTasks();
  if (legacyTasks.length > 0) {
    await saveStoredTasks(legacyTasks);
    clearLegacyLocalStorageTasks();
  }
  return legacyTasks;
}

export async function saveStoredTasks(tasks: ImageStudioTask[]) {
  const normalized = tasks.slice(0, MAX_TASKS);
  try {
    await replaceTasksInDb(normalized);
  } catch {
    saveLegacyLocalStorageTasks(normalized);
  }
}

export async function clearStoredTasks() {
  try {
    await clearTasksInDb();
  } catch {
    // IndexedDB can be unavailable in restricted contexts.
  }
  clearLegacyLocalStorageTasks();
}

export function loadStoredSettings(): StudioSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: StudioSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage can be unavailable in restricted contexts.
  }
}

export function createDefaultParams(settings: StudioSettings): StudioParams {
  return {
    ...DEFAULT_PARAMS,
    model: settings.defaultModel || DEFAULT_PARAMS.model,
    size: settings.defaultSize || DEFAULT_PARAMS.size,
  };
}

function normalizeSettings(value: Partial<StudioSettings>): StudioSettings {
  return {
    defaultModel: typeof value.defaultModel === "string" && value.defaultModel.trim()
      ? value.defaultModel.trim()
      : DEFAULT_SETTINGS.defaultModel,
    defaultSize: typeof value.defaultSize === "string" && value.defaultSize.trim()
      ? value.defaultSize.trim()
      : DEFAULT_SETTINGS.defaultSize,
    gatewayMode: value.gatewayMode === "enterprise" || value.gatewayMode === "custom"
      ? value.gatewayMode
      : DEFAULT_SETTINGS.gatewayMode,
    customBaseUrl: typeof value.customBaseUrl === "string" ? value.customBaseUrl.trim() : DEFAULT_SETTINGS.customBaseUrl,
    customApiKey: typeof value.customApiKey === "string" ? value.customApiKey : DEFAULT_SETTINGS.customApiKey,
    clearPromptAfterSubmit: value.clearPromptAfterSubmit ?? DEFAULT_SETTINGS.clearPromptAfterSubmit,
    persistHistory: value.persistHistory ?? DEFAULT_SETTINGS.persistHistory,
  };
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TASKS_STORE)) {
        const store = db.createObjectStore(TASKS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open Image Studio database"));
  });
  return dbPromise;
}

async function getAllTasksFromDb(): Promise<ImageStudioTask[]> {
  if (!("indexedDB" in window)) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(TASKS_STORE, "readonly").objectStore(TASKS_STORE).getAll();
    request.onsuccess = () => resolve((request.result as ImageStudioTask[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Failed to load Image Studio tasks"));
  });
}

async function replaceTasksInDb(tasks: ImageStudioTask[]) {
  if (!("indexedDB" in window)) throw new Error("IndexedDB is unavailable.");
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(TASKS_STORE, "readwrite");
    const store = transaction.objectStore(TASKS_STORE);
    store.clear();
    for (const task of tasks) store.put(task);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to save Image Studio tasks"));
  });
}

async function clearTasksInDb() {
  if (!("indexedDB" in window)) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(TASKS_STORE, "readwrite").objectStore(TASKS_STORE).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Failed to clear Image Studio tasks"));
  });
}

function loadLegacyLocalStorageTasks(): ImageStudioTask[] {
  try {
    const raw = window.localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTaskLike).sort(sortTasks).slice(0, MAX_TASKS);
  } catch {
    return [];
  }
}

function saveLegacyLocalStorageTasks(tasks: ImageStudioTask[]) {
  try {
    window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks.slice(0, MAX_TASKS)));
  } catch {
    // Best effort only. Large generated base64 histories can exceed browser quota.
  }
}

function clearLegacyLocalStorageTasks() {
  try {
    window.localStorage.removeItem(TASKS_KEY);
  } catch {
    // localStorage can be unavailable in restricted contexts.
  }
}

function sortTasks(a: ImageStudioTask, b: ImageStudioTask): number {
  return b.createdAt - a.createdAt;
}

function isTaskLike(value: unknown): value is ImageStudioTask {
  if (!value || typeof value !== "object") return false;
  const task = value as Partial<ImageStudioTask>;
  return typeof task.id === "string" &&
    typeof task.prompt === "string" &&
    typeof task.status === "string" &&
    typeof task.createdAt === "number" &&
    Array.isArray(task.outputs);
}
