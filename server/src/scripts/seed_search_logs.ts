import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { SearchLog } from '../models/SearchLog';

const MOCK_QUERIES = [
  { query: 'shoes', type: 'text', results: 12 },
  { query: 'running shoes', type: 'text', results: 8 },
  { query: 'leather jacket', type: 'text', results: 4 },
  { query: 'cheap phone', type: 'text', results: 5 },
  { query: 'iphone 15', type: 'text', results: 3 },
  { query: 'headphones wireless', type: 'text', results: 6 },
  { query: 'mechanical keyboard', type: 'text', results: 2 },
  { query: 'coffee mug', type: 'text', results: 4 },
  { query: 'kids toys lego', type: 'text', results: 5 },
  { query: 'summer dress cotton', type: 'text', results: 8 },
  
  // Semantic / Vector searches
  { query: 'cozy warm winter wear', type: 'vector', results: 10 },
  { query: 'gadgets for student productivity', type: 'vector', results: 7 },
  { query: 'athletic footwear for marathon', type: 'vector', results: 6 },
  { query: 'smart home lighting solutions', type: 'vector', results: 0 }, // unanswered
  { query: 'unbreakable glass cup', type: 'vector', results: 0 }, // unanswered
  { query: 'retro style gaming console', type: 'vector', results: 2 },
  { query: 'ergonomic office chair wood', type: 'vector', results: 4 },
  { query: 'highly rated noise cancelling earbuds', type: 'vector', results: 5 },
  
  // Image-based searches (predicted labels)
  { query: 'running shoe', type: 'image', results: 12 },
  { query: 'notebook', type: 'image', results: 8 },
  { query: 'cellular telephone', type: 'image', results: 4 },
  { query: 'computer keyboard', type: 'image', results: 6 },
  { query: 'coffee mug', type: 'image', results: 3 },
  { query: 'backpack', type: 'image', results: 5 },
  { query: 'sports car', type: 'image', results: 0 }, // unanswered
  { query: 'electric guitar', type: 'image', results: 0 }, // unanswered
  
  // Some random unanswered queries
  { query: 'flying carpet', type: 'text', results: 0 },
  { query: 'quantum computer quantum', type: 'vector', results: 0 },
  { query: 'gucci belt real leather', type: 'text', results: 0 },
  { query: 'wireless charger for apple watch', type: 'text', results: 0 },
  { query: 'waterproof backpack high capacity', type: 'vector', results: 0 }
];

async function seedSearchLogs() {
  try {
    await connectDB();
    console.log('Connected to MongoDB. Clearing existing search logs...');
    await SearchLog.deleteMany({});

    const logs = [];
    const now = new Date();

    // Generate logs over the last 14 days
    for (let i = 0; i < 14; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      
      // Random number of searches for this day (between 10 and 25)
      const numSearches = Math.floor(Math.random() * 16) + 10;
      for (let j = 0; j < numSearches; j++) {
        const item = MOCK_QUERIES[Math.floor(Math.random() * MOCK_QUERIES.length)];
        
        // Randomize the hour/minute
        const timestamp = new Date(date);
        timestamp.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
        
        logs.push({
          query: item.query,
          searchType: item.type,
          resultsCount: item.results,
          timestamp: timestamp
        });
      }
    }

    await SearchLog.insertMany(logs);
    console.log(`Successfully seeded ${logs.length} search logs across the last 14 days.`);
    process.exit(0);
  } catch (error) {
    console.error('Seeding search logs failed:', error);
    process.exit(1);
  }
}

seedSearchLogs();
