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
import { parse } from 'csv-parse/sync';

const TOTAL_PRODUCTS_TO_SEED = 4000;
const CHUNK_SIZE = 500;

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

function guessCategory(categoryTree: string, name: string): string {
  const text = `${categoryTree} ${name}`.toLowerCase();
  if (text.includes('phone') || text.includes('mobile') || text.includes('blackberry')) return 'Mobiles';
  if (text.includes('laptop') || text.includes('notebook') || text.includes('computer')) return 'Laptops';
  if (text.includes('shoe') || text.includes('boot') || text.includes('slipper') || text.includes('bellies') || text.includes('sneaker')) return 'Shoes';
  if (text.includes('shirt') || text.includes('jeans') || text.includes('kurta') || text.includes('clothing') || text.includes('shorts') || text.includes('wear') || text.includes('stole') || text.includes('saree') || text.includes('bra') || text.includes('panties')) {
    if (text.includes('women') || text.includes('girl') || text.includes('lady') || text.includes('saree') || text.includes('bra') || text.includes('panties') || text.includes('dress') || text.includes('skirt') || text.includes('top')) {
      return "Women's Clothing";
    }
    return "Men's Clothing";
  }
  if (text.includes('plant') || text.includes('flower') || text.includes('pot') || text.includes('decor')) return 'Home Decor';
  if (text.includes('mixer') || text.includes('blender') || text.includes('kettle') || text.includes('pan') || text.includes('kitchen')) return 'Home & Kitchen';
  if (text.includes('shampoo') || text.includes('cream') || text.includes('beauty') || text.includes('personal care')) return 'Beauty & Personal Care';
  if (text.includes('toy') || text.includes('lego') || text.includes('game') || text.includes('play')) return 'Toys & Games';
  if (text.includes('watch')) return 'Watches';
  if (text.includes('paper weight') || text.includes('stationery') || text.includes('pen') || text.includes('book')) return 'Pens & Stationery';
  if (text.includes('sensor') || text.includes('pump') || text.includes('controller') || text.includes('switch') || text.includes('adapter')) return 'Electronics';
  return 'General';
}

function classifyCategory(categoryTree: string, name: string, specifications: string): string {
  const treeLower = (categoryTree || '').toLowerCase();
  const nameLower = (name || '').toLowerCase();
  const specsLower = (specifications || '').toLowerCase();

  // 1. Shoes / Footwear
  if (
    treeLower.includes('footwear') || 
    treeLower.includes('shoes') || 
    treeLower.includes('bellies') || 
    treeLower.includes('boot') || 
    treeLower.includes('slipper') || 
    treeLower.includes('sneaker') ||
    nameLower.includes('shoes') || 
    nameLower.includes('sneakers') || 
    nameLower.includes('boots') || 
    nameLower.includes('bellies') || 
    nameLower.includes('slippers') || 
    nameLower.includes('sandals') || 
    nameLower.includes('clogs')
  ) {
    return 'Shoes';
  }

  // 2. Clothing (Men's vs Women's Clothing)
  if (
    treeLower.includes('clothing') || 
    treeLower.includes('apparel') || 
    treeLower.includes('kurta') || 
    treeLower.includes('stole') || 
    treeLower.includes('saree') || 
    treeLower.includes('lingerie') ||
    treeLower.includes('socks') ||
    nameLower.includes('shorts') || 
    nameLower.includes('tshirt') || 
    nameLower.includes('shirt') || 
    nameLower.includes('jeans') || 
    nameLower.includes('kurta') || 
    nameLower.includes('socks') || 
    nameLower.includes('saree') || 
    nameLower.includes('bra') || 
    nameLower.includes('panties') || 
    nameLower.includes('trousers') || 
    nameLower.includes('suit') || 
    nameLower.includes('dress') || 
    nameLower.includes('hoodie') ||
    specsLower.includes('ideal for: women') ||
    specsLower.includes('ideal for: girls') ||
    specsLower.includes('ideal for: men') ||
    specsLower.includes('ideal for: boys')
  ) {
    if (
      treeLower.includes('women') || 
      nameLower.includes('women') || 
      nameLower.includes('girl') || 
      nameLower.includes('lady') || 
      nameLower.includes('ladies') || 
      nameLower.includes('saree') || 
      nameLower.includes('bra') || 
      nameLower.includes('panties') || 
      nameLower.includes('dress') || 
      nameLower.includes('skirt') || 
      nameLower.includes('top') ||
      specsLower.includes('ideal for: women') ||
      specsLower.includes('ideal for: girls')
    ) {
      return "Women's Clothing";
    }
    return "Men's Clothing";
  }

  // 3. Fallback to Flipkart Category Tree top-level name
  const treeParts = (categoryTree || '').replace(/[\[\]"]/g, '').split(' >> ').map((s: string) => s.trim());
  let category = treeParts[0] || '';

  if (!category || category.length > 50 || category.includes('(') || category.includes('with Pot') || category.split(' ').length > 4) {
    return guessCategory(categoryTree, name);
  }

  // Normalize spelling and casing of common top categories
  const lower = category.toLowerCase();
  if (lower === 'footwear') return 'Shoes';
  if (lower === 'pet supplies') return 'Pet Supplies';
  if (lower === 'pens & stationery') return 'Pens & Stationery';
  if (lower === 'sports & fitness') return 'Sports & Fitness';
  if (lower === 'beauty and personal care' || lower.includes('beauty')) return 'Beauty & Personal Care';
  if (lower === 'bags, wallets & belts' || lower.includes('bags')) return 'Bags, Wallets & Belts';
  if (lower.includes('decor') || lower.includes('festive')) return 'Home Decor';
  if (lower === 'automotive') return 'Automotive';
  if (lower === 'tools & hardware') return 'Tools & Hardware';
  if (lower.includes('furnishing')) return 'Home Furnishing';
  if (lower === 'baby care') return 'Baby Care';
  if (lower.includes('mobile') || lower.includes('phone')) return 'Mobiles';
  if (lower.includes('laptop')) return 'Laptops';
  if (lower === 'food & nutrition' || lower.includes('food')) return 'Food & Nutrition';
  if (lower.includes('watch')) return 'Watches';
  if (lower.includes('toy') || lower.includes('game')) return 'Toys & Games';
  if (lower.includes('jewel')) return 'Jewellery';
  if (lower.includes('furniture')) return 'Furniture';
  if (lower.includes('kitchen') || lower.includes('dining')) return 'Home & Kitchen';
  if (lower.includes('computer')) return 'Computers';
  if (lower.includes('camera')) return 'Cameras & Accessories';
  if (lower.includes('automation') || lower.includes('robot')) return 'Automation & Robotics';

  return category.charAt(0).toUpperCase() + category.slice(1);
}

function parseSpecifications(specsString: string): Record<string, string> {
  const specs: Record<string, string> = {};
  if (!specsString) return specs;
  const parts = specsString.split(';');
  for (const part of parts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex !== -1) {
      const key = part.substring(0, colonIndex).trim().toLowerCase();
      const val = part.substring(colonIndex + 1).trim();
      specs[key] = val;
    }
  }
  return specs;
}

const getLoremFlickrUrl = (name: string, category: string, width = 500, height = 400): string => {
  const cat = (category || '').toLowerCase();
  const title = (name || '').toLowerCase();
  
  let keyword = 'product';
  if (cat.includes('shoe')) keyword = 'shoes';
  else if (cat.includes('phone') || cat.includes('mobile')) keyword = 'smartphone,phone';
  else if (cat.includes('laptop')) keyword = 'laptop,computer';
  else if (cat.includes('watch')) keyword = 'watch';
  else if (cat.includes('clothing') || cat.includes('apparel') || cat.includes('shirt') || cat.includes('sweater') || cat.includes('dress') || cat.includes('jeans') || cat.includes('hoodie')) {
    if (title.includes('shirt') || title.includes('tee')) keyword = 'tshirt';
    else if (title.includes('sweater') || title.includes('knit')) keyword = 'sweater';
    else if (title.includes('dress')) keyword = 'dress';
    else if (title.includes('jeans')) keyword = 'jeans';
    else if (title.includes('hoodie')) keyword = 'hoodie';
    else keyword = 'clothing';
  }
  else if (cat.includes('electronics')) {
    if (title.includes('headphone') || title.includes('airpods') || title.includes('earbuds')) keyword = 'headphones';
    else if (title.includes('keyboard')) keyword = 'keyboard';
    else if (title.includes('speaker')) keyword = 'speaker';
    else if (title.includes('monitor')) keyword = 'monitor';
    else keyword = 'electronics';
  }
  else if (cat.includes('beauty') || cat.includes('care') || cat.includes('cream')) keyword = 'cosmetics';
  else if (cat.includes('kitchen') || cat.includes('home')) {
    if (title.includes('vacuum') || title.includes('dyson')) keyword = 'vacuum';
    else keyword = 'home,kitchen';
  }
  else if (cat.includes('toy') || cat.includes('lego')) keyword = 'toys';
  else if (cat.includes('grocery') || cat.includes('food') || cat.includes('coffee')) keyword = 'coffee,grocery';
  else if (cat.includes('furniture') || cat.includes('chair')) keyword = 'furniture';
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const lock = Math.abs(hash) % 1000;
  
  return `https://loremflickr.com/${width}/${height}/${keyword}?lock=${lock}`;
};

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

    // 6. Read real products dataset from products.md
    const datasetPath = path.join(__dirname, '../../../products.md');
    if (!fs.existsSync(datasetPath)) {
      throw new Error(`Dataset file not found at: ${datasetPath}`);
    }
    console.log(`📋 [Seeding] Reading dataset from ${datasetPath}...`);
    const csvContent = fs.readFileSync(datasetPath, 'utf-8');

    console.log('📋 [Seeding] Parsing CSV content...');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true
    }) as any[];
    console.log(`📋 [Seeding] Parsed ${records.length} records from products.md.`);

    // 7. Process records, deduplicate and categorize
    const standardColors = ["Black", "White", "Grey", "Blue", "Red", "Green", "Yellow", "Navy", "Olive", "Pink", "Silver", "Gold", "Beige", "Brown", "Orange", "Purple", "Teal", "Burgundy", "Charcoal", "Cream", "Khaki", "Tan", "Maroon", "Lavender"];

    console.log(`🚀 [Seeding] Filtering and normalising product records...`);
    const allSeededProducts: any[] = [];
    const seenKeys = new Set<string>();

    for (const record of records) {
      if (allSeededProducts.length >= TOTAL_PRODUCTS_TO_SEED) {
        break;
      }

      const rawName = (record.product_name || '').trim();
      const rawBrand = (record.brand || '').trim();

      // Parse category
      const category = classifyCategory(record.category_tree, rawName, record.product_specifications);

      // Subcategory
      const catParts = (record.category_tree || '').replace(/[\[\]"]/g, '').split(' >> ').map((s: string) => s.trim());
      let subcategory = catParts[1] || 'General';
      if (subcategory.length > 50) {
        subcategory = subcategory.substring(0, 50) + '...';
      }

      // Brand
      let brand = rawBrand;
      if (!brand) brand = 'Generic';
      const lowerBrand = brand.toLowerCase();
      if (lowerBrand === "nike") brand = "Nike";
      else if (lowerBrand === "adidas") brand = "Adidas";
      else if (lowerBrand === "levis" || lowerBrand === "levi") brand = "Levi's";
      else if (lowerBrand === "tommy" || lowerBrand === "hilfiger") brand = "Tommy Hilfiger";
      else if (lowerBrand === "apple") brand = "Apple";
      else if (lowerBrand === "samsung") brand = "Samsung";
      else if (lowerBrand === "sony") brand = "Sony";
      else brand = brand.charAt(0).toUpperCase() + brand.slice(1);

      // Price
      let price = parseFloat(record.discounted_price);
      if (isNaN(price) || price <= 0) {
        price = parseFloat(record.retail_price);
      }
      if (isNaN(price) || price <= 0) {
        price = parseFloat((Math.random() * 190 + 9.99).toFixed(2));
      }
      price = parseFloat(price.toFixed(2));

      // Image Url - Parse real image URL from products.md, fallback to placeholder generator if missing
      let imageUrl = '';
      if (record.image_url) {
        // Clean square brackets, quotes, whitespace, and take the first URL in any comma-separated sequence
        const cleanUrl = record.image_url.replace(/[\[\]"\s]/g, '').split(',')[0];
        imageUrl = cleanUrl || getLoremFlickrUrl(rawName, category);
      } else {
        imageUrl = getLoremFlickrUrl(rawName, category);
      }

      // Specs
      const specs = parseSpecifications(record.product_specifications);

      // Gender
      let gender = 'Unisex';
      const idealFor = (specs['ideal for'] || specs['gender'] || specs['suitable for'] || '').toLowerCase();
      if (idealFor.includes('women') || idealFor.includes('girl') || idealFor.includes('female')) {
        gender = 'Women';
      } else if (idealFor.includes('men') || idealFor.includes('boy') || idealFor.includes('male')) {
        gender = 'Men';
      }

      // Material
      let material = specs['material'] || specs['primary material'] || specs['fabric'] || specs['outer material'] || specs['sole material'] || specs['upholstery material'] || specs['frame material'] || 'General';
      material = material.trim();
      if (material.length > 50) {
        material = material.substring(0, 50) + '...';
      }

      // Color
      let color = specs['primary color'] || specs['color'] || specs['upholstery color'] || specs['finish color'] || specs['shade'] || specs['dial color'] || specs['strap color'] || '';
      color = color.trim();
      if (!color) {
        // search in name/description
        const searchStr = `${rawName} ${record.description}`.toLowerCase();
        for (const stdColor of standardColors) {
          if (searchStr.includes(stdColor.toLowerCase())) {
            color = stdColor;
            break;
          }
        }
      }
      if (!color) color = 'Multicolor';
      color = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();

      // Deduplicate composite keys
      const compositeKey = `${rawName.toLowerCase()}|${brand.toLowerCase()}|${color.toLowerCase()}|${price.toFixed(2)}`;
      if (!seenKeys.has(compositeKey)) {
        seenKeys.add(compositeKey);

        const stock = Math.floor(Math.random() * 100) + 10;

        let rating = parseFloat(record.rating);
        if (isNaN(rating) || rating < 1.0 || rating > 5.0) {
          rating = parseFloat((3.5 + Math.random() * 1.5).toFixed(1));
        }

        const description = (record.description || 'No description available.').trim();

        const tags = Array.from(new Set([
          category.toLowerCase(),
          subcategory.toLowerCase(),
          brand.toLowerCase(),
          color.toLowerCase(),
          material.toLowerCase(),
          gender.toLowerCase()
        ])).filter(t => t.length > 0);

        allSeededProducts.push({
          name: rawName,
          description,
          price,
          stock,
          category,
          subcategory,
          brand,
          color,
          gender,
          material,
          rating,
          tags,
          imageUrl
        });
      }
    }

    console.log(`📋 [Seeding] Prepared ${allSeededProducts.length} unique products from dataset.`);

    // 8. Generate Embeddings using Batching (highly optimised)
    console.log(`🚀 [Seeding] Calculating embeddings in batches of 50...`);
    const BATCH_SIZE_EMBED = 50;
    const totalToEmbed = allSeededProducts.length;
    let lastLoggedTime = Date.now();

    for (let startIdx = 0; startIdx < totalToEmbed; startIdx += BATCH_SIZE_EMBED) {
      const endIdx = Math.min(startIdx + BATCH_SIZE_EMBED, totalToEmbed);
      const batchProducts = allSeededProducts.slice(startIdx, endIdx);

      const batchTexts = batchProducts.map(p => {
        return `${p.name}
Brand: ${p.brand}
Category: ${p.category}
Subcategory: ${p.subcategory}
Material: ${p.material}
Color: ${p.color}
Tags: ${p.tags.join(', ')}`;
      });

      const output = await embedder(batchTexts, { pooling: 'mean', normalize: true });
      const rawData = Array.from(output.data) as number[];

      for (let j = 0; j < batchProducts.length; j++) {
        const vectorSlice = rawData.slice(j * 384, (j + 1) * 384);
        batchProducts[j].vectorEmbedding = vectorSlice;
      }

      if (Date.now() - lastLoggedTime > 10000 || endIdx === totalToEmbed) {
        console.log(`⚙️ [Embedding Pipeline] Processed ${endIdx}/${totalToEmbed} embeddings...`);
        lastLoggedTime = Date.now();
      }
    }

    console.log(`✨ [Seeding] Generated all ${allSeededProducts.length} vectors.`);

    // 9. Insert products in chunks of 500 (Highly Optimized)
    const chunks = Math.ceil(allSeededProducts.length / CHUNK_SIZE);
    let totalInserted = 0;
    const insertStartTime = Date.now();

    for (let i = 0; i < chunks; i++) {
      const startIdx = i * CHUNK_SIZE;
      const endIdx = Math.min(startIdx + CHUNK_SIZE, allSeededProducts.length);
      const chunkData = allSeededProducts.slice(startIdx, endIdx);

      console.log(`💾 [Seeding] Bulk inserting chunk ${i + 1}/${chunks} (${chunkData.length} products)...`);
      const insertResult = await Product.insertMany(chunkData, { ordered: false });
      totalInserted += insertResult.length;
      console.log(`✅ [Seeding] Chunk ${i + 1}/${chunks} inserted. Total: ${totalInserted}/${allSeededProducts.length}`);
    }

    const durationSeconds = ((Date.now() - insertStartTime) / 1000).toFixed(2);
    console.log(`🎉 [Seeding] Bulk migration completed in ${durationSeconds} seconds!`);

    const dbCount = await Product.countDocuments();
    console.log(`📊 [Verification] Total products in database: ${dbCount}`);

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
