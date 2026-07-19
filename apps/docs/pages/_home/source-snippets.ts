export interface SourceSnippet {
  id: string;
  label: string;
  icon: string;
  lang: string;
  installCommand: string;
  code: string;
}

/** Order: tanstack-store → zustand → jotai → valtio → mobx → custom */
export const sourceSnippets: SourceSnippet[] = [
  {
    id: "tanstack-store",
    label: "TanStack Store",
    icon: "database",
    lang: "ts",
    installCommand:
      "bun add @stainless-code/persist @tanstack/store idb-keyval seroval",
    code: `import { Store } from "@tanstack/store";
import { createSerovalStorage } from "@stainless-code/persist/codecs/seroval";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";
import { toHydrationSignal } from "@stainless-code/persist";

const store = new Store({ theme: "light" });
const persist = persistStore(store, {
  name: "app:prefs:v1",
  storage: createSerovalStorage(() => localStorage),
});
export const prefsHydration = toHydrationSignal(persist);`,
  },
  {
    id: "zustand",
    label: "zustand",
    icon: "boxes",
    lang: "ts",
    installCommand: "bun add @stainless-code/persist zustand",
    code: `import { create } from "zustand";
import { createJSONStorage } from "@stainless-code/persist";
import { persistStore } from "@stainless-code/persist/sources/zustand";

const usePrefs = create(() => ({ theme: "light" as const }));
persistStore(usePrefs, {
  name: "app:prefs:v1",
  storage: createJSONStorage(() => localStorage),
});`,
  },
  {
    id: "jotai",
    label: "jotai",
    icon: "atom",
    lang: "ts",
    installCommand: "bun add @stainless-code/persist jotai",
    code: `import { atom, createStore } from "jotai";
import { createJSONStorage } from "@stainless-code/persist";
import { persistAtom } from "@stainless-code/persist/sources/jotai";

const store = createStore();
const themeAtom = atom<"light" | "dark">("light");
persistAtom(store, themeAtom, {
  name: "app:theme:v1",
  storage: createJSONStorage(() => localStorage),
});`,
  },
  {
    id: "valtio",
    label: "valtio",
    icon: "activity",
    lang: "ts",
    installCommand: "bun add @stainless-code/persist valtio",
    code: `import { proxy } from "valtio";
import { createJSONStorage } from "@stainless-code/persist";
import { persistProxy } from "@stainless-code/persist/sources/valtio";

const prefs = proxy({ theme: "light" as const });
persistProxy(prefs, {
  name: "app:prefs:v1",
  storage: createJSONStorage(() => localStorage),
});`,
  },
  {
    id: "mobx",
    label: "mobx",
    icon: "network",
    lang: "ts",
    installCommand: "bun add @stainless-code/persist mobx",
    code: `import { observable } from "mobx";
import { createJSONStorage } from "@stainless-code/persist";
import { persistObservable } from "@stainless-code/persist/sources/mobx";

const prefs = observable.object({ theme: "light" as const });
persistObservable(prefs, {
  name: "app:prefs:v1",
  storage: createJSONStorage(() => localStorage),
});`,
  },
  {
    id: "custom",
    label: "Any source",
    icon: "code",
    lang: "ts",
    installCommand: "bun add @stainless-code/persist",
    code: `import { createJSONStorage, persistSource } from "@stainless-code/persist";

persistSource(
  {
    getState: () => myStore.get(),
    setState: (next) => myStore.set(next),
    subscribe: (listener) => myStore.subscribe(listener),
  },
  {
    name: "app:prefs:v1",
    storage: createJSONStorage(() => localStorage),
  },
);`,
  },
];
