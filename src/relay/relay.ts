import { createServer, IncomingMessage, Server } from 'http';
import type { Duplex } from 'stream';
import { randomBytes } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {
  EXTENSION_PATH,
  PLAYWRIGHT_PATH_PREFIX,
  RELAY_HOST,
  relayPortCandidates,
} from '../extension/protocol';
import { authenticateExtension } from './handshake';
import { ExtensionConnection } from './extension-connection';
import { InstanceCatalog } from './instances';
import { PlaywrightSession, SessionEvent } from './playwright-session';
import { DataUrlStore } from './data-urls';
import { pairUrl, servePairPage } from './pair-page';

const EXTENSION_ORIGIN_PREFIX = 'chrome-extension://';
const SESSION_KEY_BYTES = 16;

export interface OpenedSession {
  url: string;
  session: PlaywrightSession;
}

const listenOn = (server: Server, port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const onError = (err: Error): void => reject(err);
    server.once('error', onError);
    server.listen(port, RELAY_HOST, () => {
      server.off('error', onError);
      resolve();
    });
  });

export class Relay {
  readonly instances = new InstanceCatalog();
  private readonly dataUrls = new DataUrlStore(() => `http://${RELAY_HOST}:${this.boundPort}`);
  private readonly http = createServer((req, res) => {
    if (this.dataUrls.serve(req, res) || servePairPage(req, res)) return;
    res.statusCode = 404;
    res.end();
  });
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly sessions = new Map<string, PlaywrightSession>();
  private boundPort = 0;

  constructor(private readonly token: string) {
    this.http.on('upgrade', (req, socket, head) => this.onUpgrade(req, socket, head));
  }

  get port(): number {
    return this.boundPort;
  }

  pairingUrl(label: string): string {
    return pairUrl(`http://${RELAY_HOST}:${this.boundPort}`, label, this.token);
  }

  async listen(): Promise<number> {
    const candidates = relayPortCandidates();
    this.boundPort = await candidates
      .reduce<Promise<number>>(
        (attempt, port) => attempt.catch(() => listenOn(this.http, port).then(() => port)),
        Promise.reject(new Error('no candidates')),
      )
      .catch(() => {
        throw new Error(`No free relay port in ${candidates.join(', ')}`);
      });
    return this.boundPort;
  }

  async openSession(instance: ExtensionConnection, anchorTabId: number): Promise<OpenedSession> {
    const session = new PlaywrightSession(instance, this.dataUrls, anchorTabId);
    await session.prepare();
    const key = randomBytes(SESSION_KEY_BYTES).toString('hex');
    this.sessions.set(key, session);
    console.log(`[relay] playwright session opened on ${instance.label} tab ${anchorTabId}`);
    session.once(SessionEvent.Closed, () => {
      this.sessions.delete(key);
      console.log(`[relay] playwright session closed on ${instance.label}`);
    });
    return { url: `ws://${RELAY_HOST}:${this.boundPort}${PLAYWRIGHT_PATH_PREFIX}${key}`, session };
  }

  close(): void {
    this.sessions.forEach((session) => session.close());
    this.instances.list().forEach((instance) => instance.close());
    this.wss.close();
    this.http.close();
  }

  private onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = req.url ?? '';
    if (url === EXTENSION_PATH) return this.upgradeExtension(req, socket, head);
    if (url.startsWith(PLAYWRIGHT_PATH_PREFIX)) return this.upgradePlaywright(url, req, socket, head);
    socket.destroy();
  }

  private upgradeExtension(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    if (!req.headers.origin?.startsWith(EXTENSION_ORIGIN_PREFIX)) {
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => { this.acceptExtension(ws).catch(() => ws.close()); });
  }

  private upgradePlaywright(url: string, req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const session = this.sessions.get(url.slice(PLAYWRIGHT_PATH_PREFIX.length));
    if (!session) {
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => session.bind(ws));
  }

  private async acceptExtension(ws: WebSocket): Promise<void> {
    const instance = await authenticateExtension(ws, this.token);
    const connection = new ExtensionConnection(ws, instance);
    const worker = new Date(instance.workerStartedAt).toISOString();
    if (!this.instances.add(connection)) {
      console.log(`[relay] duplicate connection rejected: ${connection.label} (worker ${worker})`);
      return;
    }
    console.log(`[relay] extension connected: ${connection.label} (${instance.brand} ${instance.version}, worker ${worker})`);
    ws.once('close', (code, reason) => console.log(`[relay] extension socket closed: ${connection.label} code=${code} ${reason.toString()}`));
  }
}
