import { ExtensionEvent, PayloadOf, relayPortCandidates } from '../../src/extension/protocol';
import { DebuggerHub } from './debugger-hub';
import { createHandlers } from './handlers';
import { describeInstance } from './instance-info';
import { ClientState, RelayClient } from './relay-client';
import { ensureProfileId, loadSettings } from './settings';

export interface ConnectionStatus extends ClientState {
  attachedTabs: number;
}

export class Discovery {
  private readonly clients = new Map<number, RelayClient>();
  private probing: Promise<void> | null = null;

  constructor(private readonly hub: DebuggerHub) {}

  probeAll(): Promise<void> {
    if (!this.probing) {
      this.probing = this.probe().finally(() => { this.probing = null; });
    }
    return this.probing;
  }

  status(): ConnectionStatus[] {
    return [...this.clients.values()]
      .sort((a, b) => a.port - b.port)
      .map((client) => ({ ...client.state, attachedTabs: this.hub.tabsHeldBy(client).length }));
  }

  broadcast<E extends ExtensionEvent>(event: E, payload: PayloadOf<E>): void {
    this.clients.forEach((client) => client.sendEvent(event, payload));
  }

  async reset(): Promise<void> {
    this.clients.forEach((client) => client.close());
    this.clients.clear();
    await this.probeAll();
  }

  private async probe(): Promise<void> {
    const settings = await loadSettings();
    const instance = await describeInstance(await ensureProfileId(), settings.label);
    const open = relayPortCandidates().filter((port) => !this.clients.has(port));
    await Promise.all(open.map((port) => this.tryConnect(port, instance)));
  }

  private async tryConnect(port: number, instance: Awaited<ReturnType<typeof describeInstance>>): Promise<void> {
    try {
      const client = await RelayClient.connect(port, instance, (c) => createHandlers(this.hub, c));
      this.clients.set(port, client);
      console.log(`[pwhs] ${new Date().toISOString()} relay ${port}: ${client.authenticated ? 'authenticated' : `locked (${client.lockReason})`}`);
      client.onClose((code, reason) => {
        console.log(`[pwhs] ${new Date().toISOString()} relay ${port} closed code=${code} ${reason}`);
        if (this.clients.get(port) === client) this.clients.delete(port);
        this.hub.releaseAll(client).catch(() => undefined);
      });
    } catch {
      return;
    }
  }
}
