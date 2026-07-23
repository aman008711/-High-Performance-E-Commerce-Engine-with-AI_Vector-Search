import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { generateMultipleMockProducts } from '../utils/productGenerator';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

const TOTAL_PRODUCTS_TO_SEED = 5000;
const CHUNK_SIZE = 1000;

const seedDatabase = async () => {
  // Set faker seed globally for deterministic and reproducible data across seeding runs
  faker.seed(42);

  try {
    // Establish connection to MongoDB
    await connectDB();

    console.log('🧹 [Seeding] Purging existing users collection...');
    await User.deleteMany({});
    const passwordHash = await bcrypt.hash('adminpassword', 10);
    await User.create({
      username: 'admin',
      passwordHash,
      role: 'admin',
    });
    console.log('👤 [Seeding] Seeded default admin account (username: admin, password: adminpassword)');

    console.log('🧹 [Seeding] Purging existing products collection...');
    const deleteResult = await Product.deleteMany({});
    console.log(`🧹 [Seeding] Cleared ${deleteResult.deletedCount} products`);

    const chunks = Math.ceil(TOTAL_PRODUCTS_TO_SEED / CHUNK_SIZE);
    console.log(`🚀 [Seeding] Starting seeding of ${TOTAL_PRODUCTS_TO_SEED} products in ${chunks} chunks...`);

    let totalInserted = 0;
    const startTime = Date.now();

    for (let i = 0; i < chunks; i++) {
      const remaining = TOTAL_PRODUCTS_TO_SEED - totalInserted;
      const countToGenerate = Math.min(CHUNK_SIZE, remaining);

      console.log(`📦 [Seeding] Generating ${countToGenerate} products for chunk ${i + 1}/${chunks}...`);
      const mockProducts = generateMultipleMockProducts(countToGenerate);

      console.log(`💾 [Seeding] Bulk inserting chunk ${i + 1}/${chunks} into database...`);
      const insertResult = await Product.insertMany(mockProducts, { ordered: false });
      
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
    console.error('💥 [Seeding] Seeding process failed:', (error as Error).message);
  } finally {
    // Graceful disconnect
    console.log('🔌 [Seeding] Closing database connection...');
    await mongoose.connection.close();
    console.log('👋 [Seeding] Database connection closed. Exit.');
    process.exit(0);
  }
};

seedDatabase();
