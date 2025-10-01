import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC } from "@trpc/server";

// Context creation function
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  return {
    req: opts.req,
    // You can add more context items here like database connections, auth, etc.
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC
const t = initTRPC.context<Context>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
