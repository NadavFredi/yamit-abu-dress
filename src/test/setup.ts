import "@testing-library/jest-dom/vitest";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function installStorage(name: "localStorage" | "sessionStorage") {
  const current = globalThis.window?.[name] ?? globalThis[name];
  if (current && typeof current.setItem === "function") return;

  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: storage,
  });
  if (globalThis.window) {
    Object.defineProperty(globalThis.window, name, {
      configurable: true,
      value: storage,
    });
  }
}

installStorage("localStorage");
installStorage("sessionStorage");

if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
