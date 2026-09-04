import { EventEmitter } from 'events';
import { ExtensionConnection } from './extension-connection';

enum CatalogEvent {
  Changed = 'changed',
}

export enum RejectReason {
  Duplicate = 'duplicate',
}

export enum ResolveFailure {
  NoneConnected = 'none-connected',
  NotFound = 'not-found',
  Locked = 'locked',
  Ambiguous = 'ambiguous',
}

export class ResolveError extends Error {
  constructor(readonly failure: ResolveFailure, message: string) {
    super(message);
  }
}

const RETRIABLE = new Set([ResolveFailure.NoneConnected, ResolveFailure.NotFound]);

const isRetriable = (err: unknown): boolean =>
  err instanceof ResolveError && RETRIABLE.has(err.failure);

const describe = (instances: ExtensionConnection[]): string =>
  instances
    .map((i) => `  ${i.label}    ${i.instance.brand} ${i.instance.version}  id=${i.shortId}  ${i.authenticated ? 'ready' : `locked (${i.auth.lockReason})`}`)
    .join('\n');

const LOCKED_HINT = 'Mint a pair code in the extension popup and start with: pwhs up --extension --pair <code>';

const sameWorker = (a: ExtensionConnection, b: ExtensionConnection): boolean =>
  a.instance.workerStartedAt === b.instance.workerStartedAt;

const matches = (instance: ExtensionConnection, needle: string): boolean =>
  instance.label === needle || instance.instance.id === needle || instance.shortId === needle.toUpperCase();

export class InstanceCatalog extends EventEmitter {
  private readonly byId = new Map<string, ExtensionConnection>();

  add(connection: ExtensionConnection): boolean {
    const existing = this.byId.get(connection.instance.id);
    if (existing && sameWorker(existing, connection) && existing.authenticated === connection.authenticated) {
      connection.reject(RejectReason.Duplicate);
      return false;
    }
    existing?.close();
    this.byId.set(connection.instance.id, connection);
    connection.onClose(() => this.remove(connection));
    this.emit(CatalogEvent.Changed);
    return true;
  }

  list(): ExtensionConnection[] {
    return [...this.byId.values()];
  }

  ready(): ExtensionConnection[] {
    return this.list().filter((i) => i.authenticated);
  }

  resolve(needle?: string): ExtensionConnection {
    const all = this.list();
    if (all.length === 0) {
      throw new ResolveError(ResolveFailure.NoneConnected, 'No browser extension is connected');
    }
    const matched = needle === undefined ? all : all.filter((i) => matches(i, needle));
    const ready = matched.filter((i) => i.authenticated);
    if (ready.length === 1) return ready[0];
    if (ready.length > 1) {
      throw new ResolveError(ResolveFailure.Ambiguous, `Multiple profiles match. Pass profile=<label|id>:\n${describe(ready)}`);
    }
    if (matched.length > 0) {
      throw new ResolveError(ResolveFailure.Locked, `Profile ${needle ?? matched[0].label} is connected but locked. ${LOCKED_HINT}\n${describe(matched)}`);
    }
    throw new ResolveError(
      ResolveFailure.NotFound,
      `Profile "${needle}" is not connected. Open that profile and click the pwhs extension icon. Connected:\n${describe(all)}`,
    );
  }

  waitFor(needle: string | undefined, timeoutMs: number): Promise<ExtensionConnection> {
    return new Promise((resolve, reject) => {
      const settle = (): boolean => {
        try {
          resolve(this.resolve(needle));
          return true;
        } catch (err) {
          if (isRetriable(err)) return false;
          reject(err);
          return true;
        }
      };
      const finish = (): void => {
        clearTimeout(timer);
        this.off(CatalogEvent.Changed, onChange);
      };
      const onChange = (): void => { if (settle()) finish(); };
      const timer = setTimeout(() => {
        finish();
        settle() || reject(new Error(`Timed out waiting for extension profile ${needle ?? '(any)'}`));
      }, timeoutMs);
      if (settle()) finish();
      else this.on(CatalogEvent.Changed, onChange);
    });
  }

  private remove(connection: ExtensionConnection): void {
    if (this.byId.get(connection.instance.id) !== connection) return;
    this.byId.delete(connection.instance.id);
    this.emit(CatalogEvent.Changed);
  }
}
