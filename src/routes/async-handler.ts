import type { Request, Response, NextFunction } from 'express';

type AsyncHandler = (req: Request, res: Response) => Promise<void>;

export const asyncHandler =
  (fn: AsyncHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
