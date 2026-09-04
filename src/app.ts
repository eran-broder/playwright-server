import express, { Express, NextFunction, Request, Response } from 'express';
import type { Services } from './services';
import { statusRoutes } from './routes/status';
import { browserRoutes } from './routes/browser';
import { navigationRoutes } from './routes/navigation';
import { interactionRoutes } from './routes/interaction';
import { captureRoutes } from './routes/capture';
import { codeRoutes } from './routes/code';
import { nativeRoutes } from './routes/native';
import { pageRoutes } from './routes/pages';
import { activityRoutes } from './routes/activity';

const BODY_LIMIT = '50mb';

const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, error: err.message });
};

const ROUTE_FACTORIES = [
  statusRoutes,
  browserRoutes,
  navigationRoutes,
  interactionRoutes,
  captureRoutes,
  codeRoutes,
  nativeRoutes,
  pageRoutes,
  activityRoutes,
];

export const createApp = (services: Services): Express => {
  const app = express();
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.text({ limit: BODY_LIMIT }));
  ROUTE_FACTORIES.forEach((factory) => app.use(factory(services)));
  app.use(errorHandler);
  return app;
};
