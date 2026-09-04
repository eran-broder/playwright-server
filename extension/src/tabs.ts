import { z } from 'zod';
import {
  Catalog,
  ExtensionMethod,
  ParamsOf,
  ResultOf,
  TabInfo,
  WindowInfo,
  WindowState,
} from '../../src/extension/protocol';

const toTabInfo = (tab: chrome.tabs.Tab): TabInfo | null =>
  tab.id === undefined || tab.windowId === undefined
    ? null
    : {
        id: tab.id,
        windowId: tab.windowId,
        index: tab.index,
        active: tab.active,
        url: tab.url ?? '',
        title: tab.title ?? '',
      };

const isPresent = <T>(value: T | null): value is T => value !== null;

const toWindowInfo = (window: chrome.windows.Window): WindowInfo | null =>
  window.id === undefined
    ? null
    : {
        id: window.id,
        focused: window.focused,
        incognito: window.incognito,
        tabs: (window.tabs ?? []).map(toTabInfo).filter(isPresent),
      };

const requireTabInfo = (tab: chrome.tabs.Tab): TabInfo => {
  const info = toTabInfo(tab);
  if (!info) throw new Error('Tab has no id');
  return info;
};

export const catalog = async (): Promise<Catalog> => {
  const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  return { windows: windows.map(toWindowInfo).filter(isPresent) };
};

export const createTab = async ({ url, openerTabId }: ParamsOf<ExtensionMethod.CreateTab>): Promise<ResultOf<ExtensionMethod.CreateTab>> => {
  const tab = await chrome.tabs.create({ url, openerTabId, active: true });
  return { tab: requireTabInfo(tab) };
};

export const closeTab = (tabId: number): Promise<void> => chrome.tabs.remove(tabId);

export const activateTab = async (tabId: number): Promise<void> => {
  const tab = await chrome.tabs.update(tabId, { active: true });
  if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
};

const toWindowState = (state: string | undefined): WindowState | undefined => {
  const parsed = z.enum(WindowState).safeParse(state);
  return parsed.success ? parsed.data : undefined;
};

export const windowForTab = async (tabId: number): Promise<ResultOf<ExtensionMethod.WindowForTab>> => {
  const tab = await chrome.tabs.get(tabId);
  const window = await chrome.windows.get(tab.windowId);
  if (window.id === undefined) throw new Error('Window has no id');
  return {
    windowId: window.id,
    bounds: {
      left: window.left,
      top: window.top,
      width: window.width,
      height: window.height,
      windowState: toWindowState(window.state),
    },
  };
};

export const setWindowBounds = async ({ windowId, bounds }: ParamsOf<ExtensionMethod.SetWindowBounds>): Promise<void> => {
  const { windowState, ...rect } = bounds;
  await chrome.windows.update(windowId, { ...rect, ...(windowState ? { state: windowState } : {}) });
};
