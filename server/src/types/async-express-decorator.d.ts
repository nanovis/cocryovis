declare module "async-express-decorator" {
  import type { Router, Request, Response, NextFunction } from "express";

  type AsyncRequestHandler<
    P = Record<string, string>,
    ResBody = unknown,
    ReqBody = unknown,
    ReqQuery = Record<string, string>,
  > = (
    _req: Request<P, ResBody, ReqBody, ReqQuery>,
    _res: Response<ResBody>,
    _next: NextFunction
  ) => void | Promise<void>;

  type RouterMethod = <
    P = Record<string, string>,
    ResBody = unknown,
    ReqBody = unknown,
    ReqQuery = Record<string, string>,
  >(
    _path: string,
    ..._handlers: AsyncRequestHandler<P, ResBody, ReqBody, ReqQuery>[]
  ) => Router;

  interface ToAsyncRouter {
    <T extends Router>(
      _router: T
    ): T & {
      get: RouterMethod;
      post: RouterMethod;
      put: RouterMethod;
      delete: RouterMethod;
    };

    /**
     * Override which router methods are wrapped
     * (default: get, post, put, delete)
     */
    setMethods(_methods: readonly string[]): void;

    /**
     * Get the currently wrapped router methods
     */
    getMethods(): readonly string[];
  }

  const toAsyncRouter: ToAsyncRouter;
  export = toAsyncRouter;
}
