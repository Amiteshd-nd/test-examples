import { useEffect, useRef } from 'react';
import { UI_SCALES, formatUiScale, setUiScale, useUiScale } from '../design/ui-scale.ts';
import { Button, Dialog, Segmented } from './components.tsx';
import { useModalFocus } from './modal.ts';

// Settings (DS-03), shared by the Vault and the editor. For now one choice: the text size (UI
// scale). It applies at once, everywhere in PlanCraft, and is remembered on this computer.

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const scale = useUiScale();
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const labels = UI_SCALES.map(formatUiScale);
  return (
    <div ref={ref}>
      <Dialog
        title="Settings"
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="pc-field">
          <span className="pc-label">Text size</span>
          <Segmented
            label="Text size"
            options={labels}
            value={formatUiScale(scale)}
            onChange={(l) => setUiScale(UI_SCALES[labels.indexOf(l)] ?? 1)}
          />
          <span className="pc-help">
            Makes text, buttons and panels bigger everywhere in PlanCraft, on this computer.
            Drawings keep their exact line weights; room names and areas on the drawing grow too.
          </span>
        </div>
      </Dialog>
    </div>
  );
}
