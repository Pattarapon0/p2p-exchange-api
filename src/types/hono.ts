import type { JwtPayload } from "../lib/jwt.js";

export type AppBindings = {
  Variables: {
    authUser: JwtPayload;
  };
};
