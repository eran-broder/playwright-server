import { ExtensionMethod } from '../../src/extension/protocol';
import { DebuggerHub } from './debugger-hub';
import type { RelayClient, RequestHandlers } from './relay-client';
import { activateTab, catalog, closeTab, createTab, setWindowBounds, windowForTab } from './tabs';

export const createHandlers = (hub: DebuggerHub, client: RelayClient): RequestHandlers => ({
  [ExtensionMethod.Catalog]: () => catalog(),
  [ExtensionMethod.Attach]: ({ tabId }) => hub.attach(client, tabId),
  [ExtensionMethod.Detach]: async ({ tabId }) => {
    await hub.detach(client, tabId);
    return {};
  },
  [ExtensionMethod.Cdp]: ({ tabId, sessionId, method, params }) => hub.send(tabId, sessionId, method, params),
  [ExtensionMethod.CreateTab]: (params) => createTab(params),
  [ExtensionMethod.CloseTab]: async ({ tabId }) => {
    await closeTab(tabId);
    return {};
  },
  [ExtensionMethod.ActivateTab]: async ({ tabId }) => {
    await activateTab(tabId);
    return {};
  },
  [ExtensionMethod.WindowForTab]: ({ tabId }) => windowForTab(tabId),
  [ExtensionMethod.SetWindowBounds]: async (params) => {
    await setWindowBounds(params);
    return {};
  },
});
