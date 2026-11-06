import { useEffect, useRef, type RefObject } from 'react';

/**
 * A modal's keyboard focus (skill §6, WCAG 2.4.3): Tab stays inside it, and when it closes,
 * focus returns to what had it before (e.g. the button that opened it).
 */
export function useModalFocus(ref: RefObject<HTMLElement | null>) {
  // Taken on the first render, before an `autoFocus` field inside the modal takes focus.
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const before = opener.current;
    const el = ref.current;
    // Only real Tab stops: the other options of a radio group or tab list are tabIndex -1.
    const focusables = () =>
      [
        ...(el?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, a[href], [tabindex]',
        ) ?? []),
      ].filter((e) => e.tabIndex >= 0);
    if (el && !el.contains(document.activeElement)) focusables()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0]!;
      const last = f.at(-1)!;
      if (
        e.shiftKey &&
        (document.activeElement === first || !el.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || !el.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', trap, true);
    return () => {
      window.removeEventListener('keydown', trap, true);
      if (before && document.contains(before)) before.focus();
    };
  }, [ref]);
}
