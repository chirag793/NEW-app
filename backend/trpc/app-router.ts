import { createTRPCRouter } from "@/backend/trpc/create-context";
import { hiProcedure } from "@/backend/trpc/routes/example/hi/route";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiProcedure,
  }),
});

export type AppRouter = typeof appRouter;
