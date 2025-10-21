import { z } from "zod";

// Schema for router decision
export const routerSchema = z.object({
    path: z.enum(["chit-chat", "retrieval"]).describe("Route to either 'chit-chat' for greetings/general conversation or 'retrieval' for specific Harry Potter queries"),
});
