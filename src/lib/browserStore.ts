/** Small, failure-safe wrappers around localStorage (private windows can throw). */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the page still works, it just won't remember */
  }
}

const MY_CASES = "wm:my-cases";

/** Cases uploaded from this browser, newest first. */
export function myCaseIds(): string[] {
  return typeof window === "undefined" ? [] : readJson<string[]>(MY_CASES, []);
}

export function rememberCase(id: string) {
  writeJson(MY_CASES, [id, ...myCaseIds().filter((x) => x !== id)].slice(0, 50));
}

export function forgetCase(id: string) {
  writeJson(MY_CASES, myCaseIds().filter((x) => x !== id));
}
