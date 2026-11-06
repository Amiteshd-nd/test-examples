import { Vault, formatUlid } from '@plancraft/engine';
import { createContext, useContext, useEffect, useState } from 'react';
import { HttpVaultStorage } from './http-storage.ts';

// The browser's Vault (P14.3): the engine's Vault on HTTP storage, with ULIDs from the browser's
// random source and the browser's clock (A2 M2). One local user and workspace until accounts
// arrive (P10.1). `revision` goes up after every change so open views read again.

export const LOCAL_USER = { id: 'local', name: 'You' };

export function createBrowserVault(): Vault {
  return new Vault({
    storage: new HttpVaultStorage(),
    ids: { next: () => formatUlid(Date.now(), crypto.getRandomValues(new Uint8Array(10))) },
    clock: { now: () => new Date().toISOString() },
    user: { id: LOCAL_USER.id },
    workspace: { id: 'local', name: 'My workspace' },
  });
}

export interface VaultHandle {
  vault: Vault;
  revision: number;
  /** Runs a change, then makes every view read again. Errors come back as a sentence. */
  change: <T>(fn: (v: Vault) => Promise<T>) => Promise<T>;
}

export const VaultContext = createContext<VaultHandle | null>(null);

export function useVault(): VaultHandle {
  const handle = useContext(VaultContext);
  if (!handle) throw new Error('useVault needs a VaultContext');
  return handle;
}

/** Reads something from the vault, again whenever the vault changes or `deps` do. */
export function useVaultQuery<T>(
  read: (v: Vault) => Promise<T>,
  deps: readonly unknown[],
): { data: T | undefined; error: string | null } {
  const { vault, revision } = useVault();
  const [state, setState] = useState<{ data: T | undefined; error: string | null }>({
    data: undefined,
    error: null,
  });
  useEffect(() => {
    let live = true;
    read(vault).then(
      (data) => live && setState({ data, error: null }),
      (e: unknown) => live && setState((s) => ({ data: s.data, error: (e as Error).message })),
    );
    return () => {
      live = false;
    };
  }, [vault, revision, ...deps]);
  return state;
}
