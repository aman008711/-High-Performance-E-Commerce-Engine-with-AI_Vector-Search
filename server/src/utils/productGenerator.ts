import { faker } from '@faker-js/faker';

// Define a structured list of categories to ensure realistic distribution and queryability
export const CATEGORIES = [
  'Electronics',
  'Apparel & Fashion',
  'Home & Kitchen',
  'Sports & Outdoors',
  'Beauty & Personal Care',
  'Books',
  'Automotive',
  'Toys & Games',
];

// Helper to generate a unit-normalized mock vector embedding of a given dimension (default 384)
// Unit-normalization is crucial for Cosine Similarity search operations
export const generateNormalizedVector = (dimensions = 384): number[] => {
  const vector: number[] = [];
  let sumOfSquares = 0;

  // Generate random coordinates
  for (let i = 0; i < dimensions; i++) {
    // Standard normal distribution approximation using Box-Muller transform
    const u1 = Math.random() || 0.0001; // Avoid 0
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
    vector.push(randStdNormal);
    sumOfSquares += randStdNormal * randStdNormal;
  }

  // Calculate L2 Norm (magnitude)
  const magnitude = Math.sqrt(sumOfSquares);

  // Divide coordinates by magnitude to yield a unit vector
  return vector.map((val) => (magnitude > 0 ? val / magnitude : 0));
};

export interface MockProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  tags: string[];
  imageUrl: string;
  vectorEmbedding: number[];
}

// Generate a single realistic mock product
export const generateMockProduct = (): MockProductInput => {
  const category = faker.helpers.arrayElement(CATEGORIES);
  const material = faker.commerce.productMaterial();
  const color = faker.color.human();
  const adjective = faker.commerce.productAdjective();
  const productType = faker.commerce.product();

  const name = `${adjective} ${color} ${material} ${productType}`;
  const description = `${faker.commerce.productDescription()}. Crafted with premium ${material.toLowerCase()} and available in ${color.toLowerCase()}. Perfect for everyday utility and modern styling.`;
  const price = parseFloat(faker.commerce.price({ min: 10, max: 1200, dec: 2 }));
  const stock = faker.number.int({ min: 0, max: 450 });
  
  // Create tags based on properties
  const tags = Array.from(
    new Set([
      material.toLowerCase(),
      color.toLowerCase(),
      adjective.toLowerCase(),
      faker.word.adjective(),
    ])
  );

  // Fetch a reliable, high-resolution random category image from Picsum
  const randomImageId = faker.number.int({ min: 1, max: 1000 });
  const imageUrl = `https://picsum.photos/seed/${randomImageId}/500/400`;

  // 384 dimensions matching typical lightweight sentence-transformers (e.g. all-MiniLM-L6-v2)
  const vectorEmbedding = generateNormalizedVector(384);

  return {
    name,
    description,
    price,
    stock,
    category,
    tags,
    imageUrl,
    vectorEmbedding,
  };
};

// Generate multiple mock products
export const generateMultipleMockProducts = (count: number): MockProductInput[] => {
  const products: MockProductInput[] = [];
  for (let i = 0; i < count; i++) {
    products.push(generateMockProduct());
  }
  return products;
};
