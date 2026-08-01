import { env, pipeline } from '@xenova/transformers';
import path from 'path';

// Configure Xenova to bypass remote Hugging Face calls and read from the local cached directory
env.localModelPath = path.join(__dirname, '../model/');
env.allowRemoteModels = false;

let embedderInstance: any = null;

export const getEmbedder = async () => {
  if (!embedderInstance) {
    console.log('🧠 [Embedder] Initializing Sentence-Transformers model pipeline...');
    embedderInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('✅ [Embedder] Embedding pipeline ready.');
  }
  return embedderInstance;
};

export const getAIEmbedding = async (text: string): Promise<number[]> => {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data) as number[];
};
