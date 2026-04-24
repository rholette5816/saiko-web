export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  emoji?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  emoji: string;
  items: MenuItem[];
}

export const menuData: MenuCategory[] = [
  {
    id: "featured",
    name: "FEATURED / PROMO ITEMS",
    emoji: "🍜",
    items: [
      { id: "f1", name: "Salted Egg Ramen", price: 300 },
      { id: "f2", name: "Gyuniku (Spicy Beef Noodles)", price: 415 },
      { id: "f3", name: "Cheesy Parmesan", price: 314 },
      { id: "f4", name: "Honey Soy Lemon", price: 314 },
    ],
  },
  {
    id: "pizza",
    name: "PIZZA",
    emoji: "🍕",
    items: [
      { id: "p1", name: "Creamy Spinach Salmon", price: 482 },
      { id: "p2", name: "Creamy Wasabe Salmon", price: 392 },
      { id: "p3", name: "Kane & Tuna", price: 482 },
      { id: "p4", name: "Beef Misono", price: 359 },
      { id: "p5", name: "Seafood", price: 336 },
    ],
  },
  {
    id: "bento",
    name: "BENTO (with soup & drinks)",
    emoji: "🍱",
    items: [
      { id: "b1", name: "Bento 1: Tonkatsu", price: 437 },
      { id: "b2", name: "Bento 2: Misono", price: 471 },
      { id: "b3", name: "Bento 3: Kaarage", price: 381 },
      { id: "b4", name: "Bento 4: Tempura", price: 426 },
    ],
  },
  {
    id: "doria",
    name: "DORIA MEAL",
    emoji: "🍛",
    items: [
      { id: "d1", name: "Chicken or Shrimp", price: 269 },
      { id: "d2", name: "Seafood", price: 269 },
      { id: "d3", name: "Beef", price: 247 },
    ],
  },
  {
    id: "side",
    name: "SIDE DISH",
    emoji: "🥗",
    items: [
      { id: "s1", name: "Seafood Yasai", price: 236 },
      { id: "s2", name: "Yasaitame", price: 224 },
      { id: "s3", name: "Kimuchi", price: 191 },
    ],
  },
  {
    id: "drinks",
    name: "DRINKS & BEVERAGES",
    emoji: "🥤",
    items: [
      // Smoothies
      { id: "dr1", name: "Smoothies - Cookies & Cream", price: 146 },
      { id: "dr2", name: "Smoothies - Coffee Chocolate", price: 146 },
      { id: "dr3", name: "Smoothies - Chocolate", price: 135 },
      { id: "dr4", name: "Smoothies - Vanilla", price: 135 },
      { id: "dr5", name: "Smoothies - Strawberry", price: 135 },
      // Fresh Juice
      { id: "dr6", name: "Fresh Juice - Mango", price: 124 },
      { id: "dr7", name: "Fresh Juice - Calamansi", price: 90 },
      { id: "dr8", name: "Fresh Juice - Lemon (Pitcher)", price: 180 },
      { id: "dr9", name: "Fresh Juice - Lemon (Glass)", price: 90 },
      // Shakes
      { id: "dr10", name: "Mango Shake", price: 135 },
      { id: "dr11", name: "Durian Shake", price: 245 },
      { id: "dr12", name: "Yakult Shake", price: 135 },
      // Drinks
      { id: "dr13", name: "Japanese Ice Tea (Pitcher)", price: 213 },
      { id: "dr14", name: "Japanese Ice Tea (Glass)", price: 90 },
      { id: "dr15", name: "Cucumber Lemonade (Pitcher)", price: 180 },
      { id: "dr16", name: "Cucumber Lemonade (Glass)", price: 90 },
      { id: "dr17", name: "Softdrinks (Can)", price: 96 },
      { id: "dr18", name: "Bottled Water", price: 34 },
      { id: "dr19", name: "San Miguel Lights", price: 101 },
      { id: "dr20", name: "San Miguel Pilsen", price: 101 },
      { id: "dr21", name: "Kirin/Ichiban", price: 146 },
      { id: "dr22", name: "Sapporo", price: 146 },
      // Desserts
      { id: "dr23", name: "Halo-Halo", price: 180 },
      { id: "dr24", name: "Mais Con Yelo", price: 124 },
    ],
  },
  {
    id: "donburi",
    name: "DONBURI RICE BOWL",
    emoji: "🍚",
    items: [
      { id: "do1", name: "Ebi Don", price: 247 },
      { id: "do2", name: "Tendon", price: 236 },
      { id: "do3", name: "Katsudon", price: 269 },
      { id: "do4", name: "Gyodon", price: 280 },
      { id: "do5", name: "Uyakodon", price: 225 },
      { id: "do6", name: "Toridon", price: 208 },
      { id: "do7", name: "Katsu Curry", price: 320 },
    ],
  },
  {
    id: "teppanyaki",
    name: "TEPPANYAKI",
    emoji: "🍳",
    items: [
      { id: "t1", name: "Wagyu Teppan", price: 504 },
      { id: "t2", name: "Seafood Teppan", price: 325 },
      { id: "t3", name: "Chicken Teppan", price: 280 },
      { id: "t4", name: "Okonomiyaki", price: 280 },
    ],
  },
  {
    id: "dumplings",
    name: "DUMPLINGS",
    emoji: "🥟",
    items: [
      { id: "du1", name: "Jap Bacon Wrap Siomai", price: 191 },
      { id: "du2", name: "Takoyaki Bacon", price: 180 },
      { id: "du3", name: "Takoyaki Mix", price: 202 },
      { id: "du4", name: "Takoyaki Shrimp/Squid", price: 180 },
      { id: "du5", name: "Pork Gyoza", price: 157 },
      { id: "du6", name: "Japanese Siomai", price: 157 },
    ],
  },
  {
    id: "salad",
    name: "SALAD",
    emoji: "🥗",
    items: [
      { id: "sa1", name: "Kani & Mango", price: 236 },
      { id: "sa2", name: "Kani Salad", price: 224 },
      { id: "sa3", name: "Pomelo Salad", price: 292 },
      { id: "sa4", name: "Pokebowl - Tuna & Salmon Poke", price: 325 },
      { id: "sa5", name: "Pokebowl - Poke Salmon", price: 292 },
      { id: "sa6", name: "Pokebowl - Poke Tuna", price: 280 },
    ],
  },
  {
    id: "friedrice",
    name: "FRIED RICE",
    emoji: "🍛",
    items: [
      { id: "fr1", name: "Lava Rice", price: 359 },
      { id: "fr2", name: "Umo Rice Seafood", price: 292 },
      { id: "fr3", name: "Wagyu", price: 269 },
      { id: "fr4", name: "Seafood", price: 236 },
      { id: "fr5", name: "Umo Rice Chahan", price: 185 },
      { id: "fr6", name: "Gyu Yaki Meshe", price: 180 },
      { id: "fr7", name: "Kimuchi", price: 180 },
      { id: "fr8", name: "Chahan", price: 168 },
    ],
  },
  {
    id: "yakitori",
    name: "YAKI TORI",
    emoji: "🍢",
    items: [
      { id: "y1", name: "Wagyu", price: 437 },
      { id: "y2", name: "Seafood", price: 292 },
      { id: "y3", name: "Pork", price: 280 },
      { id: "y4", name: "Chicken", price: 280 },
    ],
  },
  {
    id: "sushi",
    name: "MAKI & SUSHI",
    emoji: "🍣",
    items: [
      // Regular Maki
      { id: "su1", name: "Regular Maki - California Maki", price: 258 },
      { id: "su2", name: "Regular Maki - Tuna Futo Maki", price: 236 },
      { id: "su3", name: "Regular Maki - Maki Roll", price: 191 },
      // Sashimi
      { id: "su4", name: "Sashimi - Salmon", price: 432 },
      { id: "su5", name: "Sashimi - Tuna", price: 336 },
      // Uramaki
      { id: "su6", name: "Uramaki - Spicy Cheesy Salmon", price: 392 },
      { id: "su7", name: "Uramaki - Dragon Roll", price: 325 },
      { id: "su8", name: "Uramaki - Crazy Maki", price: 325 },
      { id: "su9", name: "Uramaki - Spicy Cheesy Tuna", price: 348 },
      // Bake Sushi
      { id: "su10", name: "Bake Sushi - California Bake", price: 381 },
      { id: "su11", name: "Bake Sushi - Bake Kaarage", price: 325 },
      { id: "su12", name: "Bake Sushi - Wasabi Mayo", price: 314 },
      { id: "su13", name: "Bake Sushi - Spicy Mayo", price: 325 },
    ],
  },
  {
    id: "stirfry",
    name: "STIR FRIED NOODLES",
    emoji: "🍜",
    items: [
      { id: "sf1", name: "Gomoko Yakisoba", price: 370 },
      { id: "sf2", name: "Katayakisoba", price: 359 },
      { id: "sf3", name: "Yakisoba", price: 359 },
      { id: "sf4", name: "Yaki Udon", price: 437 },
    ],
  },
  {
    id: "ramen",
    name: "RAMEN",
    emoji: "🍜",
    items: [
      { id: "r1", name: "Wagyu Ramen", price: 415 },
      { id: "r2", name: "Curry Ramen", price: 381 },
      { id: "r3", name: "Devil Ramen", price: 359 },
      { id: "r4", name: "Butao Ramen", price: 359 },
      { id: "r5", name: "Sukiyaki Ramen", price: 359 },
      { id: "r6", name: "Karubi Ramen", price: 488 },
      { id: "r7", name: "Creamy Seafood Ramen", price: 336 },
      { id: "r8", name: "3 Cheese Ramen", price: 336 },
      { id: "r9", name: "Seafood Ramen", price: 325 },
      { id: "r10", name: "Tantanmen Ramen", price: 336 },
      { id: "r11", name: "Ebi Tonkotso Ramen", price: 336 },
      { id: "r12", name: "Chasu Ramen", price: 325 },
      { id: "r13", name: "Tonkotso Ramen", price: 336 },
      { id: "r14", name: "Salted Egg Ramen", price: 336 },
    ],
  },
  {
    id: "alacarte",
    name: "ALA CARTE",
    emoji: "🍗",
    items: [
      { id: "a1", name: "Mix Fry", price: 376 },
      { id: "a2", name: "Shoyo Chicken", price: 448 },
      { id: "a3", name: "Ebi Cheesey Tempura", price: 308 },
      { id: "a4", name: "Tonkatsu with Cheese", price: 303 },
      { id: "a5", name: "Ebi Tempura", price: 280 },
      { id: "a6", name: "Ebi Furai", price: 280 },
      { id: "a7", name: "Karaage", price: 258 },
      { id: "a8", name: "Tonkatsu", price: 258 },
      { id: "a9", name: "Beef Misono (120g)", price: 308 },
    ],
  },
];
