import type { User, Admin } from "../generated/prisma";
import type { AuthType } from "../middlewares/auth.middleware.js";

declare global {
  namespace Express {
    interface Request {
      user?: User | Admin;
      auth?: {
        userId: string;
        type: AuthType;
      };
    }
  }
}

export {};