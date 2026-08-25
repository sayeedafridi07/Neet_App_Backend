import type { User, Admin } from "../generated/prisma";

declare global {
  namespace Express {
    interface Request {
      user?: User | Admin;
    }
  }
}

export {};