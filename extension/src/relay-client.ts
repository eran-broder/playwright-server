import {
  ExtensionApi,
  ExtensionEvent,
  ExtensionMethod,
  InstanceInfo,
  KEEPALIVE_INTERVAL_MS,
  LockReason,
  MessageType,
  ParamsOf,
  PayloadOf,
  RelayToExtension,
  RequestMessage,
  ResultOf,
  extensionEndpoint,
} from '../../src/extension/protocol';
import { HandshakeOutcome, authenticateWithServer } from './handshake';

const CONNECT_TIMEOUT_MS = 1_500;

export type RequestHandlers = {
  [M in ExtensionMethod]: (params: ParamsOf<M>) => Promise<ResultOf<M>>;
};

export type HandlerFactory = (client: RelayClient) => RequestHandlers;

export interface ClientState {
  port: number;
  authenticated: boolean;
  lockReason?: LockReason;
}

const openSocket = (url: string): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Connect timeout: ${url}`));
    }, CONNECT_TIMEOUT_MS);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(ws); });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`Connect failed: ${url}`)); });
  });

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export class RelayClient {
  private readonly handlers: RequestHandlers;
  private readonly closeHandlers = new Set<(code: number, reason: string) => void>();
  private readonly keepalive: ReturnType<typeof setInterval>;

  static async connect(
    port: number,
    instance: InstanceInfo,
    handlerFactory: HandlerFactory,
  ): Promise<RelayClient> {
    const ws = await openSocket(extensionEndpoint(port));
    const result = await authenticateWithServer(ws, instance);
    return new RelayClient(ws, port, result.outcome === HandshakeOutcome.Authenticated, result.reason, handlerFactory);
  }

  private constructor(
    private readonly ws: WebSocket,
    readonly port: number,
    readonly authenticated: boolean,
    readonly lockReason: LockReason | undefined,
    handlerFactory: HandlerFactory,
  ) {
    this.handlers = handlerFactory(this);
    ws.addEventListener('message', (event) => this.onMessage(event));
    ws.addEventListener('close', (event) => this.handleClose(event.code, event.reason));
    this.keepalive = setInterval(() => this.send({ type: MessageType.Ping }), KEEPALIVE_INTERVAL_MS);
  }

  get state(): ClientState {
    return { port: this.port, authenticated: this.authenticated, lockReason: this.lockReason };
  }

  sendEvent<E extends ExtensionEvent>(event: E, payload: PayloadOf<E>): void {
    if (this.authenticated) this.send({ type: MessageType.Event, event, payload });
  }

  onClose(handler: (code: number, reason: string) => void): void {
    this.closeHandlers.add(handler);
  }

  close(): void {
    this.ws.close();
  }

  private send(message: unknown): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  private onMessage(event: MessageEvent): void {
    const parsed = RelayToExtension.safeParse(JSON.parse(String(event.data)));
    if (!parsed.success) return;
    if (parsed.data.type === MessageType.Request) this.handleRequest(parsed.data);
  }

  private async handleRequest(request: RequestMessage): Promise<void> {
    if (!this.authenticated) {
      this.send({ type: MessageType.Response, id: request.id, error: 'Not authenticated' });
      return;
    }
    try {
      const params = ExtensionApi[request.method].params.parse(request.params ?? {});
      const handler = this.handlers[request.method] as (p: unknown) => Promise<unknown>;
      const result = await handler(params);
      this.send({ type: MessageType.Response, id: request.id, result });
    } catch (err) {
      this.send({ type: MessageType.Response, id: request.id, error: errorMessage(err) });
    }
  }

  private handleClose(code: number, reason: string): void {
    clearInterval(this.keepalive);
    this.closeHandlers.forEach((handler) => handler(code, reason));
  }
}
