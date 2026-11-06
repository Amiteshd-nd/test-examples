import { describe, expect, it } from 'vitest';
import { isOpen } from './panels.ts';
import { editorReducer, initialUi, type EditorUi } from './state.ts';

const open = (ui: EditorUi) => [
  isOpen(ui.panels, 'left'),
  isOpen(ui.panels, 'right'),
  isOpen(ui.panels, 'chat'),
];

describe('editor shell state', () => {
  it('opens, switches and closes the side panels like tabs', () => {
    let ui = editorReducer(initialUi(), { type: 'toggleLeft' }); // close the open Rooms panel
    ui = editorReducer(ui, { type: 'toggleLeft', tab: 'layers' });
    expect([open(ui)[0], ui.leftTab]).toEqual([true, 'layers']);
    ui = editorReducer(ui, { type: 'toggleLeft', tab: 'rooms' }); // another tab: switch
    expect([open(ui)[0], ui.leftTab]).toEqual([true, 'rooms']);
    ui = editorReducer(ui, { type: 'toggleLeft', tab: 'rooms' }); // the open tab: close
    expect(open(ui)[0]).toBe(false);
    ui = editorReducer(ui, { type: 'toggleRight', tab: 'issues' });
    expect([open(ui)[1], ui.rightTab]).toEqual([true, 'issues']);
    ui = editorReducer(ui, { type: 'toggleRight' });
    expect(open(ui)[1]).toBe(false);
  });

  it('starts with panels closed on narrow screens, and closes overlays when the window narrows', () => {
    expect(open(initialUi('m', true))).toEqual([false, false, false]);
    let ui = editorReducer(initialUi(), { type: 'toggleChat' });
    expect(open(ui)).toEqual([true, true, true]);
    ui = editorReducer(ui, { type: 'compact', compact: true });
    expect(open(ui)).toEqual([false, false, false]);
    ui = editorReducer(ui, { type: 'compact', compact: false }); // the docked layout returns
    expect(open(ui)).toEqual([true, true, true]);
  });

  it('keeps one panel at a time on narrow screens', () => {
    let ui = editorReducer(initialUi('m', true), { type: 'toggleChat' });
    expect(open(ui)).toEqual([false, false, true]);
    ui = editorReducer(ui, { type: 'toggleLeft', tab: 'rooms' });
    expect(open(ui)).toEqual([true, false, false]);
  });

  it('hides and shows all panels in focus mode', () => {
    let ui = editorReducer(initialUi(), { type: 'focusMode' });
    expect(open(ui)).toEqual([false, false, false]);
    ui = editorReducer(ui, { type: 'setPanel', side: 'right', open: true });
    expect(open(ui)).toEqual([false, true, false]);
    ui = editorReducer(editorReducer(ui, { type: 'focusMode' }), { type: 'focusMode' });
    expect(open(ui)).toEqual([false, true, false]);
  });

  it('never opens a hidden panel on selection', () => {
    let ui = editorReducer(initialUi(), { type: 'toggleRight', tab: 'metrics' }); // switch
    ui = editorReducer(ui, { type: 'toggleRight', tab: 'metrics' }); // close
    ui = editorReducer(ui, { type: 'select', pick: { kind: 'room', id: 'R1' } });
    expect([open(ui)[1], ui.rightTab]).toEqual([false, 'metrics']);
  });

  it('selects objects, shows their properties, and toggles snaps and layers', () => {
    let ui = editorReducer(initialUi(), { type: 'toggleRight', tab: 'metrics' });
    ui = editorReducer(ui, { type: 'select', pick: { kind: 'wall', id: 'W1' } });
    expect([ui.selected, ui.rightTab]).toEqual([{ kind: 'wall', id: 'W1' }, 'properties']);
    ui = editorReducer(ui, { type: 'toggleSnap', snap: 'grid' });
    expect(ui.snaps).not.toContain('grid');
    ui = editorReducer(ui, { type: 'toggleLayer', layer: 'labels' });
    expect(ui.hidden).toEqual(['labels']);
    ui = editorReducer(ui, { type: 'panelWidth', side: 'left', width: 330 });
    expect(ui.panels.width.left).toBe(330);
  });
});
