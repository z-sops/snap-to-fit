import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { emptyState, type State } from "../core/model";
import { loadState, saveState, getSession } from "./storage";
interface Store {
  state: State;
  ready: boolean;
  error: string;
  namespace: string;
  switchAccount: (id: string) => Promise<void>;
  update: (f: (s: State) => State) => Promise<void>;
}
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(emptyState);
  const current = useRef(state);
  const queue = useRef(Promise.resolve());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [namespace, setNamespace] = useState("guest");
  const ns = useRef("guest");
  useEffect(() => {
    let active = true;
    getSession()
      .then(async (session) => {
        ns.current = session?.userId || "guest";
        setNamespace(ns.current);
        return loadState(ns.current);
      })
      .then((s) => {
        if (active) {
          current.current = s;
          setState(s);
          setReady(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const switchAccount = (id: string) => {
    const task = queue.current.then(async () => {
      const loaded = await loadState(id);
      ns.current = id;
      setNamespace(id);
      current.current = loaded;
      setState(loaded);
    });
    queue.current = task.catch(() => {});
    return task;
  };
  const update = (f: (s: State) => State) => {
    const owner = namespace;
    const task = queue.current.then(async () => {
      if (ns.current !== owner)
        throw new Error("Account changed while saving. Please retry.");
      const next = f(current.current);
      await saveState(next, ns.current);
      current.current = next;
      setState(next);
    });
    queue.current = task.catch(() => {});
    return task;
  };
  return (
    <Context.Provider
      value={{ state, ready, error, update, namespace, switchAccount }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing app store.");
  return value;
}
