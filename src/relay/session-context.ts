import type { ExtensionConnection } from './extension-connection';
import type { SessionTable, TabRecord } from './session-table';
import type { CdpOutbound } from './cdp-messages';
import type { TargetInfo } from '../extension/protocol';
import type { DataUrlStore } from './data-urls';

export const DEFAULT_BROWSER_CONTEXT = 'pwhs-default-context';
export const BROWSER_TARGET_ID = 'pwhs-browser';

export interface SessionContext {
  readonly ext: ExtensionConnection;
  readonly table: SessionTable;
  readonly dataUrls: DataUrlStore;
  readonly anchorTabId: number;
  send(message: CdpOutbound): void;
  attachTab(tabId: number, extra?: Partial<TargetInfo>): Promise<TabRecord>;
  detachTab(tabId: number): Promise<void>;
  enableAutoAttach(): void;
  close(): void;
}
