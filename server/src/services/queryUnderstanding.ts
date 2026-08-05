export interface ParsedQuery {
  category?: string;
  subcategory?: string;
  brand?: string;
  color?: string;
  gender?: string;
  material?: string;
  size?: string;
  maxPrice?: number;
  minPrice?: number;
  /** Remaining natural-language intent after metadata tokens are stripped */
  semanticQuery: string;
  /** Original normalised query */
  rawQuery: string;
}

const COLORS = [
  'black', 'white', 'grey', 'gray', 'blue', 'red', 'green', 'yellow', 'navy',
  'olive', 'pink', 'silver', 'gold', 'beige', 'brown', 'orange', 'purple',
  'teal', 'burgundy', 'charcoal', 'cream', 'khaki', 'tan', 'maroon', 'lavender',
];

const MATERIALS = [
  'cotton', 'polyester', 'leather', 'denim', 'wool', 'plastic', 'metal', 'glass',
  'wood', 'wooden', 'ceramic', 'steel', 'suede', 'canvas', 'silk', 'linen',
  'rubber', 'titanium', 'fabric',
];

const BRANDS: Record<string, string> = {
  nike: 'Nike',
  adidas: 'Adidas',
  levis: "Levi's",
  levi: "Levi's",
  zara: 'Zara',
  puma: 'Puma',
  tommy: 'Tommy Hilfiger',
  hilfiger: 'Tommy Hilfiger',
  boat: 'Boat',
  casio: 'Casio',
  apple: 'Apple',
  samsung: 'Samsung',
  sony: 'Sony',
  logitech: 'Logitech',
  dell: 'Dell',
  hp: 'HP',
  lenovo: 'Lenovo',
  asus: 'Asus',
  philips: 'Philips',
  prestige: 'Prestige',
  ikea: 'Ikea',
  lego: 'Lego',
  hawkins: 'Hawkins',
  dyson: 'Dyson',
  nescafe: 'Nescafe',
  tata: 'Tata',
  cadbury: 'Cadbury',
  starbucks: 'Starbucks',
  aw: 'AW',
};

/** Longest keywords first so "running shoes" wins over "shoes". */
const CATEGORY_MAPPINGS: { keywords: string[]; category?: string; subcategory?: string }[] = [
  { keywords: ['running shoes', 'running sneakers', 'trainers'], category: 'Shoes', subcategory: 'Running Shoes' },
  { keywords: ['tshirt', 't-shirt', 'tee', 'teeshirt', 'tees'], subcategory: 'T-Shirts' },
  { keywords: ['dress', 'dresses', 'gown', 'gowns'], category: "Women's Clothing", subcategory: 'Dresses' },
  { keywords: ['headphones', 'earbuds', 'earphones', 'headset'], category: 'Electronics', subcategory: 'Headphones' },
  { keywords: ['keyboard', 'keyboards'], category: 'Electronics', subcategory: 'Keyboards' },
  { keywords: ['speaker', 'speakers', 'soundbar'], category: 'Electronics', subcategory: 'Speakers' },
  { keywords: ['monitor', 'monitors', 'display', 'screen'], category: 'Electronics', subcategory: 'Monitors' },
  { keywords: ['webcam', 'webcams'], category: 'Electronics', subcategory: 'Webcams' },
  { keywords: ['smartphone', 'smartphones'], category: 'Mobiles', subcategory: 'Smartphones' },
  { keywords: ['phone', 'phones', 'mobile', 'mobiles'], category: 'Mobiles' },
  { keywords: ['laptop', 'laptops', 'notebook', 'notebooks', 'ultrabook'], category: 'Laptops' },
  { keywords: ['smartwatch'], category: 'Watches', subcategory: 'Smartwatches' },
  { keywords: ['watch', 'watches'], category: 'Watches' },
  { keywords: ['shirt', 'shirts'], subcategory: 'Shirts' },
  { keywords: ['jeans', 'denim', 'pants', 'trousers'], subcategory: 'Jeans' },
  { keywords: ['jacket', 'jackets', 'windbreaker', 'puffer'], subcategory: 'Jackets' },
  { keywords: ['hoodie', 'hoodies', 'sweatshirt', 'sweatshirts'], subcategory: 'Hoodies' },
  { keywords: ['top', 'tops', 'blouse', 'blouses'], category: "Women's Clothing", subcategory: 'Tops' },
  { keywords: ['skirt', 'skirts'], category: "Women's Clothing", subcategory: 'Skirts' },
  { keywords: ['sweater', 'sweaters', 'cardigan'], subcategory: 'Sweaters' },
  {
    keywords: [
      'shoes', 'sneakers', 'footwear', 'boots', 'loafers', 'sandals', 'slippers',
      'bellies', 'heels', 'flats', 'loafers', 'trainers',
    ],
    category: 'Shoes',
  },
  { keywords: ['beauty', 'cream', 'shampoo', 'perfume', 'mist', 'makeup', 'cosmetics'], category: 'Beauty' },
  { keywords: ['blender', 'kettle', 'pan', 'cookware', 'pot', 'toaster', 'kitchen'], category: 'Home & Kitchen' },
  { keywords: ['coffee', 'salt', 'pepper', 'tea', 'grocery', 'food', 'snacks'], category: 'Grocery' },
  { keywords: ['yoga', 'dumbbell', 'tent', 'racket', 'sports', 'camping'], category: 'Sports' },
  { keywords: ['book', 'books', 'novel', 'novels', 'biography', 'memoir', 'cookbook'], category: 'Books' },
  { keywords: ['toy', 'toys', 'lego', 'drone', 'blocks', 'puzzle', 'board game'], category: 'Toys' },
  { keywords: ['furniture', 'chair', 'table', 'desk', 'bookshelf', 'sofa'], category: 'Furniture' },
  { keywords: ['accessories', 'sunglasses', 'belt', 'backpack', 'beanie'], category: 'Accessories' },
];

const stripToken = (text: string, token: string): string => {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
};

export const parseQueryUnderstanding = (
  searchQuery: string,
  uiCategoryFilter?: string
): ParsedQuery => {
  const rawQuery = searchQuery.trim();
  let query = rawQuery.toLowerCase();
  const parsed: ParsedQuery = { semanticQuery: rawQuery, rawQuery };

  const underMatch = query.match(/(?:under|below|less than|within)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (underMatch) {
    parsed.maxPrice = parseFloat(underMatch[1]);
    query = stripToken(query, underMatch[0]);
  }
  const aboveMatch = query.match(/(?:above|over|more than|greater than)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (aboveMatch) {
    parsed.minPrice = parseFloat(aboveMatch[1]);
    query = stripToken(query, aboveMatch[0]);
  }
  if (/\bcheap\b/.test(query)) {
    parsed.maxPrice = parsed.maxPrice ?? 100;
    query = stripToken(query, 'cheap');
  }

  if (/\b(men|mens|man|boys)\b/.test(query)) {
    parsed.gender = 'Men';
    query = query.replace(/\b(men|mens|man|boys)\b/gi, ' ');
  } else if (/\b(women|womens|woman|lady|ladies|girls)\b/.test(query)) {
    parsed.gender = 'Women';
    query = query.replace(/\b(women|womens|woman|lady|ladies|girls)\b/gi, ' ');
  } else if (/\b(unisex)\b/.test(query)) {
    parsed.gender = 'Unisex';
    query = stripToken(query, 'unisex');
  } else if (/\b(kid|kids|child|children)\b/.test(query)) {
    parsed.gender = 'Kids';
    query = query.replace(/\b(kid|kids|child|children)\b/gi, ' ');
  }

  const sizeMatch = query.match(/\b(?:size|sz)\s*[-:]?\s*([0-9]+(?:\.[0-9]+)?|[xsmlXLMS]+)\b/i)
    ?? query.match(/\b(us|uk|eu)\s*[-:]?\s*([0-9]+(?:\.[0-9]+)?)\b/i);
  if (sizeMatch) {
    parsed.size = (sizeMatch[2] ?? sizeMatch[1]).toUpperCase();
    query = stripToken(query, sizeMatch[0]);
  }

  for (const c of COLORS) {
    const regex = new RegExp(`\\b${c}\\b`, 'i');
    if (regex.test(query)) {
      parsed.color = c === 'gray' ? 'Grey' : c.charAt(0).toUpperCase() + c.slice(1);
      query = stripToken(query, c);
      break;
    }
  }

  for (const m of MATERIALS) {
    const regex = new RegExp(`\\b${m}\\b`, 'i');
    if (regex.test(query)) {
      parsed.material = m === 'wooden' ? 'Wood' : m.charAt(0).toUpperCase() + m.slice(1);
      query = stripToken(query, m);
      break;
    }
  }

  for (const [key, brandVal] of Object.entries(BRANDS)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(query)) {
      parsed.brand = brandVal;
      query = stripToken(query, key);
      break;
    }
  }

  for (const map of CATEGORY_MAPPINGS) {
    for (const kw of map.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(query)) {
        if (map.category) parsed.category = map.category;
        if (map.subcategory) parsed.subcategory = map.subcategory;
        query = stripToken(query, kw);
        break;
      }
    }
  }

  if (parsed.subcategory && !parsed.category) {
    if (parsed.gender === 'Women') parsed.category = "Women's Clothing";
    else if (parsed.gender === 'Men') parsed.category = "Men's Clothing";
    else parsed.category = "Men's Clothing";
  }

  // UI category narrows results only when the query did not infer a product type
  if (uiCategoryFilter && !parsed.category) {
    parsed.category = uiCategoryFilter;
  }

  if (parsed.maxPrice === 100 && parsed.category) {
    if (parsed.category === 'Laptops') parsed.maxPrice = 800;
    else if (parsed.category === 'Mobiles') parsed.maxPrice = 400;
    else if (parsed.category === 'Grocery') parsed.maxPrice = 15;
    else if (parsed.category === 'Books') parsed.maxPrice = 30;
  }

  parsed.semanticQuery = query.replace(/\s+/g, ' ').trim() || rawQuery;

  return parsed;
};

export const buildStructuredEmbeddingText = (parsed: ParsedQuery): string => {
  const lines: string[] = [];
  if (parsed.semanticQuery) lines.push(parsed.semanticQuery);
  if (parsed.category) lines.push(`Category: ${parsed.category}`);
  if (parsed.subcategory) lines.push(`Subcategory: ${parsed.subcategory}`);
  if (parsed.brand) lines.push(`Brand: ${parsed.brand}`);
  if (parsed.color) lines.push(`Color: ${parsed.color}`);
  if (parsed.material) lines.push(`Material: ${parsed.material}`);
  if (parsed.gender) lines.push(`Gender: ${parsed.gender}`);
  if (parsed.size) lines.push(`Size: ${parsed.size}`);
  return lines.join('\n');
};
