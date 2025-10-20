import { WeaviateStore } from "@langchain/weaviate";
import { OpenAIEmbeddings } from "@langchain/openai";
import { getWeaviateClient } from "./weaviate";
import { WeaviateClient } from "weaviate-client";


const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-ada-002",
});


export const vectorStore = async () => new WeaviateStore(embeddings, {
    client: await getWeaviateClient() as any,
    // Must start with a capital letter
    indexName: "HarryPotterCollection",
});

export const getRetriever = async () => {
    const store = await vectorStore();
    return store.asRetriever(
        { searchType: "similarity", k: 5 }
    );
}
