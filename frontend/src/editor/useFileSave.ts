import { VaultConflictError, type Plan } from '@plancraft/engine';
import { useEffect, useRef, useState } from 'react';
import { useVault } from '../vault/client.ts';
import { Autosaver, localDraft, type SaveStatus } from './autosave.ts';

// Continuous save of the open vault file (P14.4, A2 M12): every new state of `plan` goes to an
// Autosaver (local draft at once, Vault soon after); leaving the editor saves what is left.
// Also remembers the last opened file, so the Vault can show where you came from.

export const LAST_FILE_KEY = 'plancraft-last-file';

export interface OpenFile {
  id: string;
  /** The revision the editor's plan is based on. */
  rev: number;
  /** The plan came from a recovered draft: save it straight away. */
  recovered: boolean;
}

export function useFileSave(file: OpenFile | null, plan: Plan): SaveStatus {
  const { vault } = useVault();
  const [status, setStatus] = useState<SaveStatus>(file?.recovered ? 'pending' : 'saved');
  // One saver per open file for the life of this editor, not per effect run: React may run
  // effects twice (development) and a second saver would start from an old revision.
  const saver = useRef<{ fileId: string; saver: Autosaver<Plan> } | null>(null);
  const first = useRef(plan);

  useEffect(() => {
    if (!file) return;
    try {
      sessionStorage.setItem(LAST_FILE_KEY, file.id);
    } catch {
      // Only a convenience for the Vault.
    }
    if (saver.current?.fileId !== file.id) {
      const s = new Autosaver<Plan>({
        baseRev: file.rev,
        save: (doc, baseRev) =>
          vault.saveDocument(file.id, doc, { baseRev }).then((f) => f.doc_rev),
        isConflict: (e) => e instanceof VaultConflictError,
        draft: localDraft<Plan>(file.id),
        onStatus: setStatus,
      });
      saver.current = { fileId: file.id, saver: s };
      if (file.recovered) s.change(first.current);
    }
    const s = saver.current.saver;
    const online = () => s.online();
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('online', online);
      // Leaving the editor: save what is left now.
      void s.flush();
    };
  }, [file?.id, file?.rev, file?.recovered, vault]);

  useEffect(() => {
    if (plan !== first.current) saver.current?.saver.change(plan);
  }, [plan]);

  return file ? status : 'saved';
}
