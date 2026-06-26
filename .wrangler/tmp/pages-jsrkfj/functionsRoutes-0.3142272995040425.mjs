import { onRequestGet as __product___path___ts_onRequestGet } from "C:\\Users\\Antjan\\Documents\\GitHub\\workwear-showcase\\functions\\product\\[[path]].ts"

export const routes = [
    {
      routePath: "/product/:path*",
      mountPath: "/product",
      method: "GET",
      middlewares: [],
      modules: [__product___path___ts_onRequestGet],
    },
  ]