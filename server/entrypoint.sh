#!/bin/sh

echo "⏳ Waiting for MongoDB to be ready..."
until node -e "
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/ecommerce';
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2000 })
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
" ; do
  echo "⏳ MongoDB is unavailable - sleeping for 2 seconds..."
  sleep 2
done

echo "✅ MongoDB is up!"

# Now check if database needs seeding
node -e "
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/ecommerce';
mongoose.connect(MONGO_URI).then(async () => {
  try {
    const collections = await mongoose.connection.db.listCollections({ name: 'products' }).toArray();
    if (collections.length === 0) {
      console.log('Products collection does not exist - database empty.');
      process.exit(1);
    }
    const count = await mongoose.connection.db.collection('products').countDocuments();
    if (count === 0) {
      console.log('Product count is 0 - database empty.');
      process.exit(1);
    }
    console.log('Database already has ' + count + ' products.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(0); // If something else failed, let it bypass to prevent bootloops
  }
}).catch(() => process.exit(0));
"
STATUS=$?

if [ $STATUS -eq 1 ]; then
  echo "🚀 Running database seeds..."
  node dist/scripts/seed.js
  node dist/scripts/seed_search_logs.js
fi

echo "🚀 Starting Express server..."
exec node dist/index.js
