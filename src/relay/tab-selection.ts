import type { Catalog, TabInfo, WindowInfo } from '../extension/protocol';

export interface TabSelection {
  window?: number;
  tab?: number;
}

const allTabs = (catalog: Catalog): TabInfo[] => catalog.windows.flatMap((w) => w.tabs);

const describeWindows = (catalog: Catalog): string =>
  catalog.windows.map((w) => `  window ${w.id}${w.focused ? ' (focused)' : ''}: ${w.tabs.length} tab(s)`).join('\n');

const pickWindow = (catalog: Catalog, windowId?: number): WindowInfo | undefined => {
  if (windowId === undefined) return catalog.windows.find((w) => w.focused) ?? catalog.windows[0];
  const found = catalog.windows.find((w) => w.id === windowId);
  if (!found) throw new Error(`Window ${windowId} not found. Available:\n${describeWindows(catalog)}`);
  return found;
};

export const pickInitialTab = (catalog: Catalog, selection: TabSelection): TabInfo | undefined => {
  if (selection.tab !== undefined) {
    const found = allTabs(catalog).find((t) => t.id === selection.tab);
    if (!found) throw new Error(`Tab ${selection.tab} not found in any window`);
    return found;
  }
  const window = pickWindow(catalog, selection.window);
  if (!window) return undefined;
  return window.tabs.find((t) => t.active) ?? window.tabs[0];
};

export const flattenTabs = (catalog: Catalog): TabInfo[] => allTabs(catalog);
