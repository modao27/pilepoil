/// <reference lib="webworker" />
import { createHandler } from './handler';
import type { Request, Response } from './protocol';

const scope = self as unknown as {
  postMessage(msg: Response): void;
  onmessage: ((e: MessageEvent<Request>) => void) | null;
};

const handle = createHandler({
  post: (msg) => scope.postMessage(msg),
  defer: (fn) => setTimeout(fn, 0),
  now: () => performance.now(),
});

scope.onmessage = (e) => handle(e.data);
