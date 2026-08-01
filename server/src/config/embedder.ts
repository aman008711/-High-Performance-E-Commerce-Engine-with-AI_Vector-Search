import { env, pipeline } from '@xenova/transformers';
import path from 'path';

let embedderPipeline: any = null;

export const initEmbedder = async (): Promise<void> => {
  if (embedderPipeline) return;
  
  // Point to local cached directory
  env.localModelPath = path.join(__dirname, "../model/");
  env.allowRemoteModels = false;

  console.log('🧠 [Embedder] Loading Sentence-Transformers model pipeline...');
  embedderPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✨ [Embedder] Local ONNX model loaded successfully.');
};

export const getEmbedder = (): any => {
  if (!embedderPipeline) {
    throw new Error('Embedder not initialized. Call initEmbedder() first.');
  }
  return embedderPipeline;
};

export const embedText = async (text: string): Promise<number[]> => {
  const pipelineInstance = getEmbedder();
  const output = await pipelineInstance(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data) as number[];
};
