/** Maps canonical search categories to DB category patterns (seed produces varied names). */
export const CATEGORY_ALIASES: Record<string, RegExp> = {
  Shoes: /shoe|footwear|sandal|slipper|bellies|sneaker|boot/i,
  "Men's Clothing": /men'?s clothing|men'?s wear|mens wear/i,
  "Women's Clothing": /women'?s clothing|women'?s wear|womens wear|lingerie|apparel/i,
  Electronics: /electronics|computer|automation|robot/i,
  Mobiles: /mobile|phone|smartphone/i,
  Laptops: /laptop|notebook|ultrabook/i,
  Watches: /watch/i,
  Beauty: /beauty|personal care|cosmetic/i,
  'Home & Kitchen': /home & kitchen|kitchen & dining|kitchen|dining|cookware/i,
  Grocery: /grocery|food|nutrition|snack/i,
  Sports: /sport|fitness|outdoor|camping|yoga/i,
  Books: /book|stationery|pen/i,
  Toys: /toy|game|puzzle|lego/i,
  Furniture: /furniture|sofa|bed|chair|table|desk/i,
  Accessories: /accessor|bag|wallet|belt|backpack|jewel/i,
};

export const resolveCategoryFilter = (canonical: string): RegExp => {
  return CATEGORY_ALIASES[canonical] ?? new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
};
