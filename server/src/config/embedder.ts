import { env, pipeline, RawImage } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';
import https from 'https';

// Configure Xenova to bypass remote Hugging Face calls and read from the local cached directory
env.localModelPath = path.join(__dirname, '../model/');
env.allowRemoteModels = false;

let embedderInstance: any = null;
let classifierInstance: any = null;

const VISION_MODEL_FILES = [
  "config.json",
  "preprocessor_config.json",
  "onnx/model_quantized.onnx"
];
const VISION_DOWNLOAD_BASE = "https://huggingface.co/Xenova/resnet-50/resolve/main/";
const VISION_DEST_DIR = path.join(__dirname, "../model/Xenova/resnet-50/");

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode || 0)) {
        let redirectUrl = res.headers.location!;
        if (redirectUrl.startsWith('/')) {
          const parsedBase = new URL(url);
          redirectUrl = `${parsedBase.protocol}//${parsedBase.host}${redirectUrl}`;
        }
        downloadFile(redirectUrl, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Status code: ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

export async function ensureVisionModelDownloaded() {
  fs.mkdirSync(path.join(VISION_DEST_DIR, "onnx"), { recursive: true });
  for (const file of VISION_MODEL_FILES) {
    const dest = path.join(VISION_DEST_DIR, file);
    if (!fs.existsSync(dest)) {
      console.log(`📥 [Classifier] Downloading ResNet-50 model file: ${file}...`);
      const url = VISION_DOWNLOAD_BASE + file;
      await downloadFile(url, dest);
      console.log(`✅ [Classifier] Successfully downloaded ${file}`);
    }
  }
}

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

export const getClassifier = async () => {
  if (!classifierInstance) {
    await ensureVisionModelDownloaded();
    console.log('🧠 [Classifier] Initializing ResNet-50 image classification pipeline...');
    classifierInstance = await pipeline('image-classification', 'Xenova/resnet-50');
    console.log('✅ [Classifier] Image classification pipeline ready.');
  }
  return classifierInstance;
};

export const classifyImageBuffer = async (buffer: Buffer): Promise<any[]> => {
  const classifier = await getClassifier();
  const blob = new Blob([buffer]);
  const rawImage = await RawImage.fromBlob(blob as any);
  return await classifier(rawImage);
};
