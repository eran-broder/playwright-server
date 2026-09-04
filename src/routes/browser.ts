import { Router } from 'express';
import type { Services } from '../services';
import { asyncHandler } from './async-handler';
import { BrowserStartBody } from '../request-schemas';
import { ExtensionMethod } from '../extension/protocol';
import type { Relay } from '../relay/relay';
import type { ExtensionConnection } from '../relay/extension-connection';

const requireRelay = (s: Services): Relay => {
  if (!s.relay) throw new Error('Server is not in extension mode. Start it with --extension');
  return s.relay;
};

const windowsOf = async (instance: ExtensionConnection) =>
  instance.authenticated ? (await instance.call(ExtensionMethod.Catalog, {})).windows : [];

const describeProfile = async (instance: ExtensionConnection) => ({
  id: instance.instance.id,
  shortId: instance.shortId,
  label: instance.label,
  brand: instance.instance.brand,
  version: instance.instance.version,
  authenticated: instance.authenticated,
  lockReason: instance.auth.lockReason ?? null,
  windows: await windowsOf(instance),
});

export const browserRoutes = (s: Services): Router => {
  const r = Router();

  const restartWith = (message: string) =>
    asyncHandler(async (req, res) => {
      const body = BrowserStartBody.parse(req.body ?? {});
      await s.browserManager.restart(body);
      res.json({ success: true, message, ...s.browserManager.getStatus() });
    });

  r.post('/browser/start', restartWith('Browser started'));
  r.post('/browser/restart', restartWith('Browser restarted'));

  r.post('/browser/stop', asyncHandler(async (_req, res) => {
    await s.browserManager.stop();
    res.json({ success: true, message: 'Browser stopped' });
  }));

  r.get('/profiles', asyncHandler(async (_req, res) => {
    const relay = requireRelay(s);
    const profiles = await Promise.all(relay.instances.list().map(describeProfile));
    res.json({ success: true, relayPort: relay.port, profiles });
  }));

  return r;
};
