import { env, pipeline } from '@xenova/transformers';

async function main() {
  // Use high-speed mirror with default path template
  env.remoteHost = 'https://hf-mirror.com/';
  
  console.log('Loading pipeline with mirror...');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('Pipeline loaded! Generating embedding...');
  const output = await embedder('Hello world', { pooling: 'mean', normalize: true });
  const embedding = Array.from(output.data) as number[];
  console.log('Success! Embedding length:', embedding.length);
  console.log('First 5 elements:', embedding.slice(0, 5));
  process.exit(0);
}

main().catch(console.error);
