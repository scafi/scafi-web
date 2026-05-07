export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export class LocalStorageStore implements KeyValueStore {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage) {}

  get(key: string): string | null {
    return this.storage.getItem(key);
  }

  set(key: string, value: string): void {
    this.storage.setItem(key, value);
  }
}

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}