import { z } from "zod";

export const gradeDocumentsSchema = z.object({
    binaryScore: z.boolean().describe("Relevance score 'yes' or 'no'"),
});