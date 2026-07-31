import fs from 'fs';
import path from 'path';
import https from 'https';

const FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model_quantized.onnx"
];

const BASE_URL = "https://hf-mirror.com/Xenova/all-MiniLM-L6-v2/resolve/main/";
const DEST_DIR = path.join(__dirname, "../model/Xenova/all-MiniLM-L6-v2/");

fs.mkdirSync(path.join(DEST_DIR, "onnx"), { recursive: true });

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
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

async function main() {
  console.log("Starting model download via HTTPS module...");
  for (const file of FILES) {
    const url = BASE_URL + file;
    const dest = path.join(DEST_DIR, file);
    console.log(`Downloading ${file}...`);
    try {
      await downloadFile(url, dest);
      console.log(`Success downloading ${file}`);
    } catch (e) {
      console.error(`Failed to download ${file}:`, (e as Error).message);
    }
  }
  console.log("Finished downloading all model files.");
  process.exit(0);
}

main();
