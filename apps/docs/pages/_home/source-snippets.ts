export interface SourceSnippet {
  id: string;
  label: string;
  icon: string;
  lang: string;
  installCommand: string;
  code: string;
}

export const defaultSourceId = "tanstack-store";

/** Hero subset (docs sources also list pinia → redux before custom). */
export const sourceSnippets: SourceSnippet[] = [
  {
    id: "tanstack-store",
    label: "TanStack Store",
    icon: "/brands/tanstack.svg",
    lang: "ts",
    installCommand: "bun add @stainless-code/persist @tanstack/store",
    code: `import { Store } from "@tanstack/store";
import { createJSONStorage } from "@stainless-code/persist";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";

const store = new Store({ theme: "light" });
persistStore(store, {
  name: "app:prefs:v1",
  storage: createJSONStorage(() => localStorage),
});`,
  },
  {
    id: "zustand",
    label: "Zustand",
    icon: "/brands/zustand.png",
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
    label: "Jotai",
    icon: "/brands/jotai.png",
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
    label: "Valtio",
    icon: "/brands/valtio.svg",
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
    label: "MobX",
    icon: "/brands/mobx.svg",
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
    getState: () => myStore.getState(),
    setState: (updater) => myStore.setState(updater),
    subscribe: (listener) => ({
      unsubscribe: myStore.subscribe(() => listener()),
    }),
  },
  {
    name: "app:prefs:v1",
    storage: createJSONStorage(() => localStorage),
  },
);`,
  },
];
