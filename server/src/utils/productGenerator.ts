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

const IMAGES_BY_SUBCATEGORY: Record<string, string[]> = {
  "T-Shirts": [
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=500&auto=format&fit=crop&q=60"
  ],
  "Shirts": [
    "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&auto=format&fit=crop&q=60"
  ],
  "Jeans": [
    "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1582552938357-32b906df43c3?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&auto=format&fit=crop&q=60"
  ],
  "Jackets": [
    "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=500&auto=format&fit=crop&q=60"
  ],
  "Hoodies": [
    "https://images.unsplash.com/photo-1544441893-675973e31985?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=500&auto=format&fit=crop&q=60"
  ],
  "Dresses": [
    "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=500&auto=format&fit=crop&q=60"
  ],
  "Tops": [
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1548624149-f7b31668853b?w=500&auto=format&fit=crop&q=60"
  ],
  "Skirts": [
    "https://images.unsplash.com/photo-1577900232427-18219b9166a0?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1583496661160-fb48862c6a7e?w=500&auto=format&fit=crop&q=60"
  ],
  "Sweaters": [
    "https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1574164904299-3a102b110380?w=500&auto=format&fit=crop&q=60"
  ],
  "Running Shoes": [
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=500&auto=format&fit=crop&q=60"
  ],
  "Sneakers": [
    "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format&fit=crop&q=60"
  ],
  "Formal Shoes": [
    "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=500&auto=format&fit=crop&q=60"
  ],
  "Loafers": [
    "https://images.unsplash.com/photo-1531310197839-ccf54634509e?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop&q=60"
  ],
  "Boots": [
    "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=500&auto=format&fit=crop&q=60"
  ],
  "Headphones": [
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500&auto=format&fit=crop&q=60"
  ],
  "Keyboards": [
    "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=500&auto=format&fit=crop&q=60"
  ],
  "Speakers": [
    "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=60"
  ],
  "Monitors": [
    "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=500&auto=format&fit=crop&q=60"
  ],
  "Webcams": [
    "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500&auto=format&fit=crop&q=60"
  ],
  "Smartphones": [
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500&auto=format&fit=crop&q=60"
  ],
  "Basic Phones": [
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&auto=format&fit=crop&q=60"
  ],
  "Gaming Laptops": [
    "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500&auto=format&fit=crop&q=60"
  ],
  "Ultrabooks": [
    "https://images.unsplash.com/photo-1496181130204-755241524eab?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500&auto=format&fit=crop&q=60"
  ],
  "Smart Watches": [
    "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1517502884422-41eaaced0168?w=500&auto=format&fit=crop&q=60"
  ],
  "Analog Watches": [
    "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=500&auto=format&fit=crop&q=60"
  ],
  "Face Creams": [
    "https://images.unsplash.com/photo-1608248597481-496100c8c836?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=500&auto=format&fit=crop&q=60"
  ],
  "Shampoos": [
    "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=500&auto=format&fit=crop&q=60"
  ],
  "Perfumes": [
    "https://images.unsplash.com/photo-1541643600914-78b084683601?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=500&auto=format&fit=crop&q=60"
  ],
  "Blenders": [
    "https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=500&auto=format&fit=crop&q=60"
  ],
  "Kettles": [
    "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=500&auto=format&fit=crop&q=60"
  ],
  "Cookware": [
    "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=500&auto=format&fit=crop&q=60"
  ],
  "Toasters": [
    "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=500&auto=format&fit=crop&q=60"
  ],
  "Coffee Beans": [
    "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=500&auto=format&fit=crop&q=60"
  ],
  "Spices": [
    "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=500&auto=format&fit=crop&q=60"
  ],
  "Tea Bags": [
    "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=60"
  ],
  "Yoga Mats": [
    "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=500&auto=format&fit=crop&q=60"
  ],
  "Dumbbells": [
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60"
  ],
  "Tents": [
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=500&auto=format&fit=crop&q=60"
  ],
  "Tennis Rackets": [
    "https://images.unsplash.com/photo-1617083266333-575347e3e06e?w=500&auto=format&fit=crop&q=60"
  ],
  "Fiction Novels": [
    "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=500&auto=format&fit=crop&q=60"
  ],
  "Biographies": [
    "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500&auto=format&fit=crop&q=60"
  ],
  "Cookbooks": [
    "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60"
  ],
  "Building Blocks": [
    "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500&auto=format&fit=crop&q=60"
  ],
  "Board Games": [
    "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=500&auto=format&fit=crop&q=60"
  ],
  "Drones": [
    "https://images.unsplash.com/photo-1507582199268-247cfc7a726f?w=500&auto=format&fit=crop&q=60"
  ],
  "Office Chairs": [
    "https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=500&auto=format&fit=crop&q=60"
  ],
  "Coffee Tables": [
    "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=500&auto=format&fit=crop&q=60"
  ],
  "Desks": [
    "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500&auto=format&fit=crop&q=60"
  ],
  "Sunglasses": [
    "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&auto=format&fit=crop&q=60"
  ],
  "Belts": [
    "https://images.unsplash.com/photo-1624222247344-550fb8ecf7db?w=500&auto=format&fit=crop&q=60"
  ],
  "Backpacks": [
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=60"
  ],
  "Beanies": [
    "https://images.unsplash.com/photo-1576871337622-98d48d4353c0?w=500&auto=format&fit=crop&q=60"
  ]
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

  // Choose category-matching Unsplash image URL
  const imgList = IMAGES_BY_SUBCATEGORY[subcategory] || ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60"];
  const imageUrl = faker.helpers.arrayElement(imgList);
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
