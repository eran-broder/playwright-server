import type { WebSocket, RawData } from 'ws';
import {
  EventPayloads,
  ExtensionApi,
  ExtensionEvent,
  ExtensionMethod,
  ExtensionToRelay,
  InstanceInfo,
  MessageType,
  ParamsOf,
  PayloadOf,
  ResponseMessage,
  ResultOf,
} from '../extension/protocol';
import { parseJson, sendJson } from './ws-utils';
import type { Authentication } from './handshake';
import { profileShortOf } from '../extension/pair-code';

const CALL_TIMEOUT_MS = 30_000;
const LIVENESS_INTERVAL_MS = 15_000;
const REJECT_CLOSE_CODE = 4000;

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };
type EventHandler<E extends ExtensionEvent> = (payload: PayloadOf<E>) => void;
type AnyHandler = (payload: never) => void;

export class ExtensionConnection {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly handlers = new Map<ExtensionEvent, Set<AnyHandler>>();
  private readonly closeHandlers = new Set<() => void>();
  private readonly liveness: ReturnType<typeof setInterval>;
  private awaitingPong = false;

  constructor(
    private readonly ws: WebSocket,
    readonly instance: InstanceInfo,
    readonly auth: Authentication,
  ) {
    ws.on('message', (data) => this.onMessage(data));
    ws.on('pong', () => { this.awaitingPong = false; });
    ws.on('close', () => this.handleClose());
    this.liveness = setInterval(() => this.checkLiveness(), LIVENESS_INTERVAL_MS);
  }

  get label(): string {
    return this.instance.label || `${this.instance.brand.toLowerCase()}-${this.shortId.toLowerCase()}`;
  }

  get shortId(): string {
    return profileShortOf(this.instance.id);
  }

  get authenticated(): boolean {
    return this.auth.authenticated;
  }

  async call<M extends ExtensionMethod>(method: M, params: ParamsOf<M>): Promise<ResultOf<M>> {
    if (!this.authenticated) throw new Error(`Profile ${this.label} is locked (${this.auth.lockReason})`);
    const id = this.nextId++;
    const raw = await new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Extension call ${method} timed out`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      sendJson(this.ws, { type: MessageType.Request, id, method, params });
    });
    return ExtensionApi[method].result.parse(raw) as ResultOf<M>;
  }

  on<E extends ExtensionEvent>(event: E, handler: EventHandler<E>): () => void {
    const set = this.handlers.get(event) ?? new Set<AnyHandler>();
    set.add(handler as AnyHandler);
    this.handlers.set(event, set);
    return () => set.delete(handler as AnyHandler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.add(handler);
  }

  close(): void {
    this.ws.close();
  }

  reject(reason: string): void {
    this.ws.close(REJECT_CLOSE_CODE, reason);
  }

  private checkLiveness(): void {
    if (this.awaitingPong) {
      this.ws.terminate();
      return;
    }
    this.awaitingPong = true;
    this.ws.ping();
  }

  private onMessage(data: RawData): void {
    const parsed = ExtensionToRelay.safeParse(parseJson(data));
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.type === MessageType.Ping) return sendJson(this.ws, { type: MessageType.Pong });
    if (message.type === MessageType.Response) return this.settle(message);
    this.dispatch(message.event, message.payload);
  }

  private settle(message: ResponseMessage): void {
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error !== undefined) pending.reject(new Error(message.error));
    else pending.resolve(message.result);
  }

  private dispatch(event: ExtensionEvent, rawPayload: unknown): void {
    const payload = EventPayloads[event].safeParse(rawPayload);
    if (!payload.success) return;
    this.handlers.get(event)?.forEach((handler) => (handler as (p: unknown) => void)(payload.data));
  }

  private handleClose(): void {
    clearInterval(this.liveness);
    this.pending.forEach((pending) => pending.reject(new Error('Extension disconnected')));
    this.pending.clear();
    this.closeHandlers.forEach((handler) => handler());
  }
}
