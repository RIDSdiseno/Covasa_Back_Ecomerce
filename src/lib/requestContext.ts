import { AsyncLocalStorage } from "async_hooks";

export type RequestContext = {
  requestId: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  run: <T>(context: RequestContext, fn: () => T) => storage.run(context, fn),
  get: () => storage.getStore(),
};
