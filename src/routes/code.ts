import { Router } from 'express';
import type { Services } from '../services';
import { asyncHandler } from './async-handler';
import { CodeBody, SaveScriptBody, ScriptNameBody } from '../request-schemas';

export const codeRoutes = (s: Services): Router => {
  const r = Router();

  r.post('/execute/inline', asyncHandler(async (req, res) => {
    const { code } = CodeBody.parse(req.body);
    res.json({ success: true, result: await s.browserManager.evaluate(code) });
  }));

  r.post('/script/execute-playwright', asyncHandler(async (req, res) => {
    const { code } = CodeBody.parse(req.body);
    res.json({ success: true, result: await s.browserManager.executePlaywrightCode(code) });
  }));

  r.post('/script/save', (req, res) => {
    const { name, code } = SaveScriptBody.parse(req.body);
    res.json({ success: true, ...s.scriptManager.save(name, code) });
  });

  r.post('/script/execute', asyncHandler(async (req, res) => {
    const { name } = ScriptNameBody.parse(req.body);
    res.json({ success: true, ...(await s.scriptManager.execute(name)) });
  }));

  return r;
};
