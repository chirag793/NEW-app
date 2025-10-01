import { publicProcedure } from "@/backend/trpc/create-context";
import { z } from "zod";

export const hiProcedure = publicProcedure
  .input(z.object({ name: z.string() }))
  .query(({ input }) => {
    return { message: `Hello ${input.name}!` };
  });
