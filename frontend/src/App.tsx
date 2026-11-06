import { useMemo, useState } from 'react';
import { useRoute } from './app/route.ts';
import { Editor, type EditorSource } from './editor/Editor.tsx';
import './editor/editor.css';
import { VaultContext, createBrowserVault, type VaultHandle } from './vault/client.ts';
import { Dashboard } from './vault/Dashboard.tsx';
import './vault/dashboard.css';
import './vault/vault.css';

// The app (P14.3): the Vault is the first page; a file or library plan opens in the editor.
// One Vault for the whole app; `revision` makes open views read again after a change.

export function App() {
  const route = useRoute();
  const vault = useMemo(createBrowserVault, []);
  const [revision, setRevision] = useState(0);
  const handle = useMemo<VaultHandle>(
    () => ({
      vault,
      revision,
      change: async (fn) => {
        try {
          return await fn(vault);
        } finally {
          setRevision((r) => r + 1);
        }
      },
    }),
    [vault, revision],
  );
  const source: EditorSource | null =
    route.page === 'file'
      ? { kind: 'file', id: route.id }
      : route.page === 'library-plan'
        ? { kind: 'library', id: route.id }
        : null;
  return (
    <VaultContext.Provider value={handle}>
      {source ? (
        <Editor key={`${source.kind}:${source.id}`} source={source} />
      ) : (
        <Dashboard route={route} />
      )}
    </VaultContext.Provider>
  );
}
