import { ExtensionEvent, PayloadOf, relayPortCandidates } from '../../src/extension/protocol';
import { DebuggerHub } from './debugger-hub';
import { createHandlers } from './handlers';
import { describeInstance } from './instance-info';
import { RelayClient } from './relay-client';
import { ensureInstanceId, loadSettings } from './settings';

export interface ConnectionStatus {
  port: number;
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
    return [...this.clients.keys()].sort((a, b) => a - b).map((port) => ({ port }));
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
    if (!settings.token) return;
    const instance = await describeInstance(await ensureInstanceId(), settings.label);
    const open = relayPortCandidates().filter((port) => !this.clients.has(port));
    await Promise.all(open.map((port) => this.tryConnect(port, settings.token, instance)));
  }

  private async tryConnect(port: number, token: string, instance: Awaited<ReturnType<typeof describeInstance>>): Promise<void> {
    try {
      const client = await RelayClient.connect(port, token, instance, (c) => createHandlers(this.hub, c));
      this.clients.set(port, client);
      console.log(`[pwhs] ${new Date().toISOString()} connected to relay ${port}`);
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
