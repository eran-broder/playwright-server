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
    .map((i) => `  ${i.label}    ${i.instance.brand} ${i.instance.version}  id=${i.instance.id}`)
    .join('\n');

const sameWorker = (a: ExtensionConnection, b: ExtensionConnection): boolean =>
  a.instance.workerStartedAt === b.instance.workerStartedAt;

export class InstanceCatalog extends EventEmitter {
  private readonly byId = new Map<string, ExtensionConnection>();

  add(connection: ExtensionConnection): boolean {
    const existing = this.byId.get(connection.instance.id);
    if (existing && sameWorker(existing, connection)) {
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

  find(label: string): ExtensionConnection[] {
    return this.list().filter((i) => i.label === label || i.instance.id === label);
  }

  resolve(label?: string): ExtensionConnection {
    const all = this.list();
    if (all.length === 0) {
      throw new ResolveError(ResolveFailure.NoneConnected, 'No browser extension is connected');
    }
    if (label === undefined) {
      if (all.length === 1) return all[0];
      throw new ResolveError(ResolveFailure.Ambiguous, `Multiple profiles connected. Pass profile=<label>:\n${describe(all)}`);
    }
    const matched = this.find(label);
    if (matched.length === 1) return matched[0];
    if (matched.length > 1) {
      throw new ResolveError(ResolveFailure.Ambiguous, `Multiple profiles share the label "${label}". Use the id instead:\n${describe(matched)}`);
    }
    throw new ResolveError(
      ResolveFailure.NotFound,
      `Profile "${label}" is not connected. Open that profile and click the pwhs extension icon. Connected:\n${describe(all)}`,
    );
  }

  waitFor(label: string | undefined, timeoutMs: number): Promise<ExtensionConnection> {
    return new Promise((resolve, reject) => {
      const settle = (): boolean => {
        try {
          resolve(this.resolve(label));
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
        settle() || reject(new Error(`Timed out waiting for extension profile ${label ?? '(any)'}`));
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
