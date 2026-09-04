import { Router } from 'express';
import type { Services } from '../services';
import { asyncHandler } from './async-handler';
import {
  ClickBody,
  HoverBody,
  KeyboardBody,
  ScrollBody,
  SelectBody,
  TypeBody,
  WaitBody,
} from '../request-schemas';

export const interactionRoutes = (s: Services): Router => {
  const r = Router();
  const bm = s.browserManager;

  r.post('/click', asyncHandler(async (req, res) => {
    const { selector } = ClickBody.parse(req.body);
    await bm.click(selector);
    res.json({ success: true });
  }));

  r.post('/type', asyncHandler(async (req, res) => {
    const { selector, text } = TypeBody.parse(req.body);
    await bm.type(selector, text);
    res.json({ success: true });
  }));

  r.post('/wait', asyncHandler(async (req, res) => {
    const { selector, timeout } = WaitBody.parse(req.body);
    await bm.waitForSelector(selector, timeout);
    res.json({ success: true });
  }));

  r.post('/keyboard', asyncHandler(async (req, res) => {
    const { key } = KeyboardBody.parse(req.body);
    await bm.pressKey(key);
    res.json({ success: true });
  }));

  r.post('/select', asyncHandler(async (req, res) => {
    const { selector, value } = SelectBody.parse(req.body);
    await bm.selectOption(selector, value);
    res.json({ success: true });
  }));

  r.post('/hover', asyncHandler(async (req, res) => {
    const { selector } = HoverBody.parse(req.body);
    await bm.hover(selector);
    res.json({ success: true });
  }));

  r.post('/scroll', asyncHandler(async (req, res) => {
    const { x, y } = ScrollBody.parse(req.body ?? {});
    await bm.scroll(x, y);
    res.json({ success: true });
  }));

  return r;
};
