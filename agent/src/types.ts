import { z } from "zod";

export const gradeDocumentsSchema = z.object({
    binaryScore: z.string().describe("Relevance score 'yes' or 'no'"),
});