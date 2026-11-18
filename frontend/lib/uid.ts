export function getUid(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem("sf_uid");
    if (!id) {
      id = "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem("sf_uid", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
