import { faker } from '@faker-js/faker';

// Expanded categories list
export const CATEGORIES = [
  "Men's Clothing",
  "Women's Clothing",
  "Shoes",
  "Electronics",
  "Mobiles",
  "Laptops",
  "Watches",
  "Beauty",
  "Home & Kitchen",
  "Grocery",
  "Sports",
  "Books",
  "Toys",
  "Furniture",
  "Accessories"
];

// Subcategory product templates mapping
const PRODUCT_TEMPLATES: Record<string, { subcategory: string; items: string[] }[]> = {
  "Men's Clothing": [
    { subcategory: "T-Shirts", items: ["Oversized T-Shirt", "Polo T-Shirt", "V-Neck T-Shirt", "Graphic Print Tee"] },
    { subcategory: "Shirts", items: ["Casual Cotton Shirt", "Formal Dress Shirt", "Slim Fit Denim Shirt", "Flannel Plaid Shirt"] },
    { subcategory: "Jeans", items: ["Slim Fit Jeans", "Regular Straight Jeans", "Skinny Denim Jeans", "Distressed Jeans"] },
    { subcategory: "Jackets", items: ["Leather Biker Jacket", "Windbreaker Jacket", "Denim Trucker Jacket", "Puffer Winter Jacket"] },
    { subcategory: "Hoodies", items: ["Fleece Pullover Hoodie", "Zip-Up Hoodie Sweatshirt", "Oversized Streetwear Hoodie"] }
  ],
  "Women's Clothing": [
    { subcategory: "Dresses", items: ["Floral Summer Dress", "Evening Gown", "Cocktail Party Dress", "Maxi Sundress"] },
    { subcategory: "Tops", items: ["Chiffon Blouse", "Casual Crop Top", "Ribbed Tank Top", "V-Neck Tee"] },
    { subcategory: "Skirts", items: ["Pleated A-Line Skirt", "Denim Mini Skirt", "High-Waisted Pencil Skirt"] },
    { subcategory: "Jeans", items: ["High-Rise Mom Jeans", "Skinny Fit Jeans", "Wide Leg Denim Trousers"] },
    { subcategory: "Sweaters", items: ["Knit Cardigan Sweater", "Turtle Neck Pullover", "Oversized Cable Knit Sweater"] }
  ],
  "Shoes": [
    { subcategory: "Running Shoes", items: ["Ultralight Running Shoes", "Trail Running Sneakers", "Cushioned Athletic Shoes"] },
    { subcategory: "Sneakers", items: ["Classic Canvas Sneakers", "High-Top Skate Shoes", "Retro Leather Sneakers"] },
    { subcategory: "Formal Shoes", items: ["Leather Oxford Shoes", "Formal Derby Shoes", "Brogue Dress Shoes"] },
    { subcategory: "Loafers", items: ["Suede Penny Loafers", "Casual Slip-On Moccasins"] },
    { subcategory: "Boots", items: ["Chelsea Leather Boots", "Ankle Combat Boots", "Suede Desert Boots"] }
  ],
  "Electronics": [
    { subcategory: "Headphones", items: ["Wireless Bluetooth Headphones", "Noise-Canceling Earbuds", "In-Ear Sports Earphones"] },
    { subcategory: "Keyboards", items: ["Mechanical Gaming Keyboard", "Slim Wireless Keyboard", "Ergonomic Split Keyboard"] },
    { subcategory: "Speakers", items: ["Portable Bluetooth Speaker", "Smart Home Voice Assistant Speaker", "Soundbar Home Theater"] },
    { subcategory: "Monitors", items: ["UltraWide Gaming Monitor", "4K Professional Monitor", "Curved Desktop Display"] },
    { subcategory: "Webcams", items: ["1080p HD Streaming Webcam", "4K Autofocus Conference Webcam"] }
  ],
  "Mobiles": [
    { subcategory: "Smartphones", items: ["Pro smartphone 5G", "Lite smartphone", "Camera Flagship Phone"] },
    { subcategory: "Basic Phones", items: ["Classic Feature Phone", "Rugged Dual-SIM Phone"] }
  ],
  "Laptops": [
    { subcategory: "Gaming Laptops", items: ["Gaming Laptop RTX", "Pro Esports Laptop"] },
    { subcategory: "Ultrabooks", items: ["Slim Aluminum Ultrabook", "Convertible 2-in-1 Touchscreen Laptop"] }
  ],
  "Watches": [
    { subcategory: "Smart Watches", items: ["GPS Fitness Smartwatch", "Heart Rate Tracker smartwatch", "Active Health Watch"] },
    { subcategory: "Analog Watches", items: ["Stainless Steel Analog Watch", "Minimalist Quartz Watch", "Luxury Chronograph Watch"] }
  ],
  "Beauty": [
    { subcategory: "Face Creams", items: ["Moisturizing Face Cream", "Hydrating Hyaluronic Serum", "Anti-Aging Night Cream"] },
    { subcategory: "Shampoos", items: ["Anti-Dandruff Shampoo", "Nourishing Argan Oil Conditioner", "Hair Volumizing Shampoo"] },
    { subcategory: "Perfumes", items: ["Eau De Parfum Spray", "Fresh Citrus Cologne", "Floral Body Mist"] }
  ],
  "Home & Kitchen": [
    { subcategory: "Blenders", items: ["High-Speed Smoothie Blender", "Personal Single-Serve Blender"] },
    { subcategory: "Kettles", items: ["Electric Glass Kettle", "Gooseneck Pour-Over Kettle"] },
    { subcategory: "Cookware", items: ["Non-Stick Frying Pan", "Cast Iron Skillet", "Stainless Steel Cooking Pot Set"] },
    { subcategory: "Toasters", items: ["2-Slice Retro Toaster", "Digital Smart Toaster"] }
  ],
  "Grocery": [
    { subcategory: "Coffee Beans", items: ["Organic Dark Roast Coffee Beans", "Medium Roast Ground Coffee"] },
    { subcategory: "Spices", items: ["Premium Himalayan Pink Salt", "Organic Black Pepper Grinder", "Gourmet Turmeric Powder"] },
    { subcategory: "Tea Bags", items: ["English Breakfast Tea Bags", "Pure Green Tea Bags", "Chamomile Herbal Infusion"] }
  ],
  "Sports": [
    { subcategory: "Yoga Mats", items: ["Eco-Friendly TPE Yoga Mat", "Extra Thick Pilates Mat"] },
    { subcategory: "Dumbbells", items: ["Hex Dumbbells Pair", "Adjustable Dumbbell Set"] },
    { subcategory: "Tents", items: ["4-Person Waterproof Camping Tent", "Pop-Up Backpacking Tent"] },
    { subcategory: "Tennis Rackets", items: ["Carbon Fiber Tennis Racket", "Beginner Tennis Racquet"] }
  ],
  "Books": [
    { subcategory: "Fiction Novels", items: ["Sci-Fi Dystopian Novel", "Classic Romance Paperback", "Epic Fantasy Novel"] },
    { subcategory: "Biographies", items: ["Historical Biography Book", "Tech Founder Memoir"] },
    { subcategory: "Cookbooks", items: ["Gourmet Healthy Recipes Cookbook", "Easy Baking Desserts Book"] }
  ],
  "Toys": [
    { subcategory: "Building Blocks", items: ["Space Shuttle Building Blocks Set", "City Police Station Creative Toys"] },
    { subcategory: "Board Games", items: ["Classic Strategy Board Game", "Party Trivia Card Game"] },
    { subcategory: "Drones", items: ["Mini Quadcopter Drone with HD Camera", "RC Stunt Drone for Kids"] }
  ],
  "Furniture": [
    { subcategory: "Office Chairs", items: ["Ergonomic Mesh Office Chair", "Luxury Leather Executive Chair"] },
    { subcategory: "Coffee Tables", items: ["Modern Wooden Coffee Table", "Minimalist Metal Frame Nesting Tables"] },
    { subcategory: "Desks", items: ["L-Shaped Corner Writing Desk", "Adjustable Height Standing Desk"] }
  ],
  "Accessories": [
    { subcategory: "Sunglasses", items: ["Polarized Aviator Sunglasses", "Wayfarer UV Protection Sunglasses"] },
    { subcategory: "Belts", items: ["Genuine Leather Reversible Belt", "Casual Woven Canvas Belt"] },
    { subcategory: "Backpacks", items: ["Water-Resistant Laptop Backpack", "Canvas Hiking Rucksack", "Anti-Theft Travel Bag"] },
    { subcategory: "Beanies", items: ["Ribbed Knit Winter Beanie Hat", "Slouchy Warm Skull Cap"] }
  ]
};

const BRANDS: Record<string, string[]> = {
  fashion: ["Nike", "Adidas", "Levi's", "Zara", "H&M", "Puma", "Tommy Hilfiger", "Calvin Klein"],
  tech: ["Apple", "Samsung", "Sony", "Logitech", "Dell", "HP", "Boat", "Casio", "Lenovo", "Asus"],
  home: ["Philips", "Prestige", "Ikea", "Lego", "Hawkins", "Dyson", "Hamilton Beach"],
  beauty: ["L'Oreal", "Nivea", "Clinique", "The Body Shop", "Estee Lauder", "Maybelline"],
  grocery: ["Nescafe", "Tata", "Cadbury", "Organic India", "Twinings", "Starbucks"],
  books: ["Penguin Books", "HarperCollins", "Random House", "Oxford Press"],
  general: ["AmazonBasics", "Generic"]
};

const COLORS = ["Black", "White", "Grey", "Blue", "Red", "Green", "Yellow", "Navy", "Olive", "Pink", "Silver", "Gold", "Beige"];
const MATERIALS = ["Cotton", "Polyester", "Leather", "Denim", "Wool", "Plastic", "Metal", "Glass", "Wood", "Ceramic", "Stainless Steel", "Suede", "Canvas"];

// Normalized L2 vector generator
export const generateNormalizedVector = (dimensions = 384): number[] => {
  const vector: number[] = [];
  let sumOfSquares = 0;
  for (let i = 0; i < dimensions; i++) {
    const u1 = Math.random() || 0.0001;
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
    vector.push(randStdNormal);
    sumOfSquares += randStdNormal * randStdNormal;
  }
  const magnitude = Math.sqrt(sumOfSquares);
  return vector.map((val) => (magnitude > 0 ? val / magnitude : 0));
};

export interface MockProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  subcategory: string;
  brand: string;
  color: string;
  gender: string;
  material: string;
  rating: number;
  tags: string[];
  imageUrl: string;
  vectorEmbedding: number[];
}

export const generateMockProduct = (): MockProductInput => {
  const category = faker.helpers.arrayElement(CATEGORIES);
  const subcatGroup = faker.helpers.arrayElement(PRODUCT_TEMPLATES[category]);
  const subcategory = subcatGroup.subcategory;
  const baseItem = faker.helpers.arrayElement(subcatGroup.items);

  // Determine appropriate brand list
  let brandList = BRANDS.general;
  if (["Men's Clothing", "Women's Clothing", "Shoes", "Accessories"].includes(category)) {
    brandList = BRANDS.fashion;
  } else if (["Electronics", "Mobiles", "Laptops", "Watches"].includes(category)) {
    brandList = BRANDS.tech;
  } else if (["Home & Kitchen", "Furniture", "Toys"].includes(category)) {
    brandList = BRANDS.home;
  } else if (category === "Beauty") {
    brandList = BRANDS.beauty;
  } else if (category === "Grocery") {
    brandList = BRANDS.grocery;
  } else if (category === "Books") {
    brandList = BRANDS.books;
  }
  const brand = faker.helpers.arrayElement(brandList);

  const color = faker.helpers.arrayElement(COLORS);
  const material = faker.helpers.arrayElement(MATERIALS);
  const adjective = faker.commerce.productAdjective();

  // Handle Gender assignment
  let gender = "Unisex";
  if (category === "Men's Clothing") {
    gender = "Men";
  } else if (category === "Women's Clothing") {
    gender = "Women";
  } else if (["Shoes", "Watches", "Accessories"].includes(category)) {
    gender = faker.helpers.arrayElement(["Men", "Women", "Unisex"]);
  }

  // Construct premium product title
  const name = `${brand} ${adjective} ${color} ${baseItem}`;
  const description = `${faker.commerce.productDescription()}. This premium ${baseItem.toLowerCase()} from ${brand} is engineered with high-quality ${material.toLowerCase()} and finished in a stylish ${color.toLowerCase()} tone. Tailored for ${gender.toLowerCase()} wearers, it offers outstanding reliability and modern aesthetics.`;
  
  // Set category-appropriate pricing
  let minPrice = 10;
  let maxPrice = 300;
  if (category === "Laptops") {
    minPrice = 500;
    maxPrice = 2500;
  } else if (category === "Mobiles") {
    minPrice = 200;
    maxPrice = 1200;
  } else if (category === "Watches") {
    minPrice = 50;
    maxPrice = 800;
  } else if (category === "Grocery") {
    minPrice = 5;
    maxPrice = 40;
  }
  const price = parseFloat(faker.commerce.price({ min: minPrice, max: maxPrice, dec: 2 }));
  const stock = faker.number.int({ min: 5, max: 250 });
  const rating = parseFloat(faker.number.float({ min: 3.5, max: 5.0, precision: 0.1 }).toFixed(1));

  // Build clean, query-stemmed index tags
  const nameWords = baseItem.toLowerCase().split(/\s+/);
  const tags = Array.from(
    new Set([
      category.toLowerCase(),
      subcategory.toLowerCase(),
      brand.toLowerCase(),
      color.toLowerCase(),
      material.toLowerCase(),
      gender.toLowerCase(),
      ...nameWords
    ])
  );

  const randomImageId = faker.number.int({ min: 1, max: 1000 });
  const imageUrl = `https://picsum.photos/seed/${randomImageId}/500/400`;
  const vectorEmbedding = generateNormalizedVector(384);

  return {
    name,
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
    imageUrl,
    vectorEmbedding
  };
};

export const generateMultipleMockProducts = (count: number): MockProductInput[] => {
  const products: MockProductInput[] = [];
  for (let i = 0; i < count; i++) {
    products.push(generateMockProduct());
  }
  return products;
};
