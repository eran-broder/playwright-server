import { Router } from 'express';
import type { Services } from '../services';
import { ActivityConfigBody, ActivityQuery, ActivityStartBody } from '../request-schemas';
import type { ActivityType } from '../types';

const DEFAULT_LOG_LIMIT = 1000;

export const activityRoutes = (s: Services): Router => {
  const r = Router();
  const recorder = s.activityRecorder;

  r.post('/activity/start', (req, res) => {
    const { captureNetworkBodies } = ActivityStartBody.parse(req.body ?? {});
    recorder.start({ captureNetworkBodies });
    res.json({ success: true, message: 'Recording started', state: recorder.getState() });
  });

  r.post('/activity/stop', (_req, res) => {
    res.json({ success: true, message: 'Recording stopped', entriesCaptured: recorder.stop() });
  });

  r.get('/activity/status', (_req, res) => {
    res.json({ success: true, ...recorder.getState() });
  });

  r.get('/activity/check', (req, res) => {
    const { since } = ActivityQuery.parse(req.query);
    res.json({ success: true, ...recorder.getQuickStatus(since) });
  });

  r.get('/activity/poll', (req, res) => {
    const { since, types } = ActivityQuery.parse(req.query);
    res.json({ success: true, ...recorder.poll(since ?? 0, types as ActivityType[] | undefined) });
  });

  r.get('/activity/log', (req, res) => {
    const { since, types, limit } = ActivityQuery.parse(req.query);
    const result = recorder.getEntries({
      since,
      types: types as ActivityType[] | undefined,
      limit: limit ?? DEFAULT_LOG_LIMIT,
    });
    res.json({ success: true, ...result });
  });

  r.get('/activity/summary', (_req, res) => {
    res.json({ success: true, ...recorder.getSummary() });
  });

  r.delete('/activity/log', (_req, res) => {
    res.json({ success: true, cleared: recorder.clear() });
  });

  r.post('/activity/config', (req, res) => {
    const { autoStart } = ActivityConfigBody.parse(req.body ?? {});
    if (autoStart !== undefined) recorder.setAutoStart(autoStart);
    res.json({ success: true, state: recorder.getState() });
  });

  return r;
};
