import weaviate, { WeaviateClient } from 'weaviate-client';
``
export let weaviateClient: WeaviateClient | null = null;
export const getWeaviateClient = async () => {
    if (!weaviateClient) {
        weaviateClient = await weaviate.connectToWeaviateCloud(process.env.WEAVIATE_URL || '',
            {
                authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ''),
                headers: {
                    'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || ''
                }
            });
    }
    return weaviateClient;
}
export const get_collection = async (collection: string = process.env.WEAVIATE_COLLECTION || 'HarryPotterCollection') => {
    const client = await getWeaviateClient();
    return client.collections.use(collection);
};
getWeaviateClient();