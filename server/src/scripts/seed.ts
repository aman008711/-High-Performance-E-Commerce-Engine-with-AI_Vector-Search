import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Discount } from '../models/Discount';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { env, pipeline } from '@xenova/transformers';

const TOTAL_PRODUCTS_TO_SEED = 5000;
const CHUNK_SIZE = 1000;

const MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "onnx/model_quantized.onnx"
];

const DOWNLOAD_BASE_URL = "https://hf-mirror.com/Xenova/all-MiniLM-L6-v2/resolve/main/";
const MODEL_DEST_DIR = path.join(__dirname, "../model/Xenova/all-MiniLM-L6-v2/");

function downloadModelFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode || 0)) {
        let redirectUrl = res.headers.location!;
        if (redirectUrl.startsWith('/')) {
          const parsedBase = new URL(url);
          redirectUrl = `${parsedBase.protocol}//${parsedBase.host}${redirectUrl}`;
        }
        downloadModelFile(redirectUrl, dest).then(resolve).catch(reject);
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

async function ensureModelDownloaded() {
  fs.mkdirSync(path.join(MODEL_DEST_DIR, "onnx"), { recursive: true });
  console.log("🔌 [Seeding] Checking local embedding model files...");
  
  for (const file of MODEL_FILES) {
    const dest = path.join(MODEL_DEST_DIR, file);
    if (!fs.existsSync(dest)) {
      console.log(`📥 [Seeding] Model file missing: ${file}. Downloading from mirror...`);
      const url = DOWNLOAD_BASE_URL + file;
      await downloadModelFile(url, dest);
      console.log(`✅ [Seeding] Successfully downloaded ${file}`);
    }
  }
  console.log("✨ [Seeding] All model files are present locally.");
}

const seedDatabase = async () => {
  try {
    // 1. Establish connection to MongoDB
    await connectDB();

    // 2. Setup model files locally
    await ensureModelDownloaded();
    
    // Configure Xenova to bypass Hugging Face remote calls and read from local cache
    env.localModelPath = path.join(__dirname, "../model/");
    env.allowRemoteModels = false;

    console.log('🧠 [Seeding] Loading Sentence-Transformers model pipeline...');
    const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    // 3. Purge Users collection and seed admin
    console.log('🧹 [Seeding] Purging existing users collection...');
    await User.deleteMany({});
    const passwordHash = await bcrypt.hash('adminpassword', 10);
    await User.create({
      username: 'admin',
      passwordHash,
      role: 'admin',
    });
    console.log('👤 [Seeding] Seeded default admin account (username: admin, password: adminpassword)');

    // 4. Purge Coupons collection and seed coupons
    console.log('🧹 [Seeding] Purging existing discount collection...');
    await Discount.deleteMany({});
    await Discount.insertMany([
      { code: 'SAVE10', percent: 10, isActive: true },
      { code: 'SAVE20', percent: 20, isActive: true },
      { code: 'FREESHIP', percent: 15, isActive: true }
    ]);
    console.log('🎟️ [Seeding] Seeded initial coupon codes (SAVE10, SAVE20, FREESHIP)');

    // 5. Purge Products collection
    console.log('🧹 [Seeding] Purging existing products collection...');
    const deleteResult = await Product.deleteMany({});
    console.log(`🧹 [Seeding] Cleared ${deleteResult.deletedCount} products`);

    // 6. Read real products template
    const baseProductsPath = path.join(__dirname, '../../data/real_products.json');
    if (!fs.existsSync(baseProductsPath)) {
      throw new Error(`Real products base template not found at: ${baseProductsPath}`);
    }
    const baseProducts = JSON.parse(fs.readFileSync(baseProductsPath, 'utf-8'));
    console.log(`📋 [Seeding] Loaded ${baseProducts.length} base product templates.`);

    // 7. Pre-compute vector embeddings for base products (fast, only 26 runs instead of 5,000!)
    console.log('🧠 [Seeding] Pre-calculating embeddings for base templates...');
    const baseEmbeddings: number[][] = [];
    for (let i = 0; i < baseProducts.length; i++) {
      const p = baseProducts[i];
      const searchText = `${p.name} ${p.description} ${p.brand} ${p.subcategory}`;
      
      const output = await embedder(searchText, { pooling: 'mean', normalize: true });
      baseEmbeddings.push(Array.from(output.data) as number[]);
    }
    console.log('✅ [Seeding] Embeddings pre-calculated successfully.');

    // 8. Generate 5,000 unique records dynamically
    console.log(`🚀 [Seeding] Generating ${TOTAL_PRODUCTS_TO_SEED} variations from templates...`);
    const colors = ["Black", "White", "Grey", "Blue", "Red", "Green", "Yellow", "Navy", "Olive", "Pink", "Silver", "Gold", "Beige"];
    const genders = ["Men", "Women", "Unisex"];
    const sizeOptions = ["S", "M", "L", "XL"];
    const shoeSizes = ["7", "8", "9", "10", "11"];
    const storageOptions = ["128GB", "256GB", "512GB", "1TB"];

    const allSeededProducts: any[] = [];
    for (let i = 0; i < TOTAL_PRODUCTS_TO_SEED; i++) {
      const baseIdx = i % baseProducts.length;
      const base = baseProducts[baseIdx];
      const embedding = baseEmbeddings[baseIdx];

      const color = colors[i % colors.length];
      const gender = base.gender === "Unisex" ? genders[i % genders.length] : base.gender;
      
      let name = base.name;
      let price = base.price;
      let description = base.description;
      let subcategory = base.subcategory;
      let material = base.material;

      // Add category-specific variation markers
      if (base.category === "Mobiles" || base.category === "Laptops") {
        const storage = storageOptions[i % storageOptions.length];
        name = `${base.name} (${color}, ${storage})`;
        price = base.price + (storageOptions.indexOf(storage) * 100);
      } else if (base.category === "Men's Clothing" || base.category === "Women's Clothing") {
        const size = sizeOptions[i % sizeOptions.length];
        name = `${base.brand} ${color} ${base.subcategory}`;
        description = `${base.description} Size: ${size}. High-quality fabric for durable wear.`;
      } else if (base.category === "Shoes") {
        const size = shoeSizes[i % shoeSizes.length];
        name = `${base.name} - Size ${size} (${color})`;
        price = base.price + (i % 3) * 15;
      } else {
        name = `${base.name} - ${color} Edition`;
        price = base.price + (i % 5) * 8;
      }

      const tags = Array.from(new Set([
        base.category.toLowerCase(),
        subcategory.toLowerCase(),
        base.brand.toLowerCase(),
        color.toLowerCase(),
        material.toLowerCase(),
        gender.toLowerCase()
      ]));

      allSeededProducts.push({
        name,
        description,
        price: parseFloat(price.toFixed(2)),
        stock: (i % 140) + 15,
        category: base.category,
        subcategory,
        brand: base.brand,
        color,
        gender,
        material,
        rating: parseFloat((base.rating - (i % 5) * 0.1).toFixed(1)),
        tags,
        imageUrl: base.imageUrl,
        vectorEmbedding: embedding
      });
    }

    // 9. Insert products in chunks of 1000
    const chunks = Math.ceil(TOTAL_PRODUCTS_TO_SEED / CHUNK_SIZE);
    let totalInserted = 0;
    const startTime = Date.now();

    for (let i = 0; i < chunks; i++) {
      const startIdx = i * CHUNK_SIZE;
      const endIdx = Math.min(startIdx + CHUNK_SIZE, TOTAL_PRODUCTS_TO_SEED);
      const chunkData = allSeededProducts.slice(startIdx, endIdx);

      console.log(`💾 [Seeding] Bulk inserting chunk ${i + 1}/${chunks} into database...`);
      const insertResult = await Product.insertMany(chunkData, { ordered: false });
      totalInserted += insertResult.length;
      console.log(`✅ [Seeding] Chunk ${i + 1}/${chunks} inserted. Total so far: ${totalInserted}/${TOTAL_PRODUCTS_TO_SEED}`);
    }

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 [Seeding] Bulk seeding completed in ${durationSeconds} seconds!`);

    // Verification check
    const dbCount = await Product.countDocuments();
    console.log(`📊 [Verification] Total products in database: ${dbCount}`);

    if (dbCount === TOTAL_PRODUCTS_TO_SEED) {
      console.log('💚 [Verification] Seeding verified successfully! Database count matches target.');
    } else {
      console.warn(`⚠️ [Verification] Seeding count mismatch. Target: ${TOTAL_PRODUCTS_TO_SEED}, Database: ${dbCount}`);
    }

  } catch (error) {
    console.error('💥 [Seeding] Seeding failed:', (error as Error).message);
  } finally {
    console.log('🔌 [Seeding] Closing database connection...');
    await mongoose.connection.close();
    console.log('👋 [Seeding] Database connection closed. Exit.');
    process.exit(0);
  }
};

seedDatabase();
