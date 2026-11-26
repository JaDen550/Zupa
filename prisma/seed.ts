/**
 * Development seed. Safe to run repeatedly (everything is upserted by a unique key).
 *
 *   npm run db:seed
 *
 * Optional environment variables:
 *   SEED_ADMIN_EMAIL     default: admin@zupa.sl
 *   SEED_ADMIN_PASSWORD  default: a random password, printed ONCE on first creation
 *
 * All products, prices and delivery fees below are SAMPLE DATA for development.
 * Replace them with real business data from the admin dashboard.
 * Money is in minor units: 65000 = NLe 650.00.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient, Prisma, AdminRole, ProductStatus, StockReason } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const nle = (major: number) => Math.round(major * 100);

const CATEGORIES = [
  { name: "Fashion and Clothing", slug: "fashion-clothing" },
  { name: "Shoes and Footwear", slug: "shoes-footwear" },
  { name: "Beauty and Personal Care", slug: "beauty-personal-care" },
  { name: "Electronics", slug: "electronics" },
  { name: "Phones and Accessories", slug: "phones-accessories" },
  { name: "Home and Living", slug: "home-living" },
  { name: "Kitchen Appliances", slug: "kitchen-appliances" },
  { name: "Groceries", slug: "groceries" },
  { name: "Baby and Kids", slug: "baby-kids" },
  { name: "Sports and Fitness", slug: "sports-fitness" },
  { name: "Automotive Accessories", slug: "automotive-accessories" },
  { name: "Office Supplies", slug: "office-supplies" },
  { name: "General Merchandise", slug: "general-merchandise" },
];

type SeedProduct = {
  sku: string;
  name: string;
  category: string; // category slug
  price: number; // NLe
  compareAt?: number;
  brand?: string;
  featured?: boolean;
  stock: number;
  description: string;
  specs: [string, string][];
};

const PRODUCTS: SeedProduct[] = [
  { sku: "FSH-001", name: "Men's Cotton Polo Shirt", category: "fashion-clothing", price: 250, stock: 60, featured: true,
    description: "Soft, breathable cotton polo for everyday wear. Holds its colour wash after wash.",
    specs: [["Material", "100% cotton"], ["Fit", "Regular"], ["Care", "Machine wash cold"]] },
  { sku: "FSH-002", name: "Women's Ankara Wrap Dress", category: "fashion-clothing", price: 450, compareAt: 520, stock: 25,
    description: "Bold African-print wrap dress with an adjustable waist tie. Lightly lined.",
    specs: [["Material", "Cotton wax print"], ["Length", "Knee-length"], ["Sizes", "S – XL"]] },
  { sku: "SHO-001", name: "Men's Leather Sandals", category: "shoes-footwear", price: 320, stock: 40,
    description: "Durable genuine-leather sandals with a cushioned insole and non-slip sole.",
    specs: [["Upper", "Genuine leather"], ["Sole", "Rubber, non-slip"], ["Sizes", "40 – 46"]] },
  { sku: "SHO-002", name: "Kids School Shoes", category: "shoes-footwear", price: 280, stock: 50, featured: true,
    description: "Hard-wearing black school shoes with reinforced toe caps.",
    specs: [["Colour", "Black"], ["Closure", "Velcro"], ["Sizes", "28 – 38"]] },
  { sku: "BTY-001", name: "Shea Butter Body Cream 250ml", category: "beauty-personal-care", price: 120, stock: 80, featured: true,
    description: "Rich moisturising cream made with unrefined shea butter. Fragrance-free.",
    specs: [["Size", "250 ml"], ["Skin type", "All"], ["Fragrance", "None"]] },
  { sku: "BTY-002", name: "Hair Growth Oil 100ml", category: "beauty-personal-care", price: 95, stock: 70,
    description: "Lightweight blend of natural oils to nourish the scalp and condition hair.",
    specs: [["Size", "100 ml"], ["Use", "Scalp and hair"]] },
  { sku: "ELC-001", name: "32-inch LED Television", category: "electronics", price: 4200, compareAt: 4600, brand: "Generic", stock: 12, featured: true,
    description: "HD-ready LED TV with HDMI and USB ports. Suitable for both generator and mains power.",
    specs: [["Screen", "32 inch"], ["Resolution", "1366 x 768"], ["Ports", "2 x HDMI, 1 x USB"], ["Warranty", "12 months"]] },
  { sku: "ELC-002", name: "Bluetooth Speaker 20W", category: "electronics", price: 650, stock: 30,
    description: "Portable speaker with deep bass, 10-hour battery and a built-in microphone.",
    specs: [["Output", "20 W"], ["Battery", "10 hours"], ["Connectivity", "Bluetooth 5.0"]] },
  { sku: "PHN-001", name: "Smartphone 128GB Dual SIM", category: "phones-accessories", price: 3800, brand: "Generic", stock: 18, featured: true,
    description: "Dual-SIM Android smartphone with a large battery and fast charging.",
    specs: [["Storage", "128 GB"], ["RAM", "4 GB"], ["SIM", "Dual"], ["Warranty", "12 months"]] },
  { sku: "PHN-002", name: "20,000mAh Power Bank", category: "phones-accessories", price: 520, stock: 45,
    description: "High-capacity power bank, ideal when mains power is unreliable. Charges two devices at once.",
    specs: [["Capacity", "20,000 mAh"], ["Outputs", "2 x USB"], ["Input", "USB-C / Micro-USB"]] },
  { sku: "HOM-001", name: "Memory Foam Pillow", category: "home-living", price: 280, stock: 35,
    description: "Contoured memory-foam pillow with a washable cover for better sleep.",
    specs: [["Fill", "Memory foam"], ["Cover", "Removable, washable"]] },
  { sku: "HOM-002", name: "Queen Bed Sheet Set", category: "home-living", price: 420, stock: 28,
    description: "Four-piece cotton-blend sheet set: fitted sheet, flat sheet and two pillowcases.",
    specs: [["Size", "Queen"], ["Pieces", "4"], ["Material", "Cotton blend"]] },
  { sku: "KIT-001", name: "Electric Rice Cooker 1.8L", category: "kitchen-appliances", price: 700, stock: 22, featured: true,
    description: "Non-stick rice cooker with automatic keep-warm. Feeds a family of six.",
    specs: [["Capacity", "1.8 L"], ["Power", "700 W"], ["Includes", "Steamer tray, spoon"]] },
  { sku: "KIT-002", name: "Non-stick Cookware Set (5 pieces)", category: "kitchen-appliances", price: 950, compareAt: 1100, stock: 15,
    description: "Five-piece non-stick set: two pots with lids and a frying pan. Heat-resistant handles.",
    specs: [["Pieces", "5"], ["Coating", "Non-stick"], ["Suitable for", "Gas and electric"]] },
  { sku: "GRC-001", name: "Long Grain Rice 25kg", category: "groceries", price: 650, stock: 100, featured: true,
    description: "Clean, polished long-grain rice in a 25 kg sack.",
    specs: [["Weight", "25 kg"], ["Type", "Long grain"]] },
  { sku: "GRC-002", name: "Vegetable Cooking Oil 5L", category: "groceries", price: 380, stock: 90,
    description: "Refined vegetable cooking oil in a 5-litre container.",
    specs: [["Volume", "5 L"], ["Type", "Refined vegetable oil"]] },
  { sku: "BBY-001", name: "Baby Diapers Size 3 (60 pack)", category: "baby-kids", price: 340, stock: 55,
    description: "Soft, absorbent diapers with a wetness indicator and stretchy waistband.",
    specs: [["Size", "3 (6 – 10 kg)"], ["Count", "60"]] },
  { sku: "BBY-002", name: "Baby Feeding Bottles (3-pack)", category: "baby-kids", price: 150, stock: 65,
    description: "BPA-free feeding bottles with anti-colic vents and slow-flow teats.",
    specs: [["Capacity", "260 ml each"], ["Material", "BPA-free PP"], ["Count", "3"]] },
  { sku: "SPT-001", name: "Football (Size 5)", category: "sports-fitness", price: 180, stock: 48, featured: true,
    description: "Machine-stitched match football with a durable synthetic cover.",
    specs: [["Size", "5"], ["Cover", "Synthetic leather"]] },
  { sku: "SPT-002", name: "Yoga Mat 6mm", category: "sports-fitness", price: 220, stock: 33,
    description: "Non-slip, 6 mm cushioned exercise mat with a carry strap.",
    specs: [["Thickness", "6 mm"], ["Length", "183 cm"]] },
  { sku: "AUT-001", name: "Car Phone Holder", category: "automotive-accessories", price: 110, stock: 60,
    description: "Dashboard and vent-clip phone holder with a one-hand release.",
    specs: [["Mount", "Dashboard / vent"], ["Fits", "4 – 6.7 inch phones"]] },
  { sku: "AUT-002", name: "Portable Tyre Inflator 12V", category: "automotive-accessories", price: 480, stock: 20,
    description: "Plug-in 12 V electric tyre pump with a pressure gauge and LED torch.",
    specs: [["Power", "12 V DC"], ["Max pressure", "150 psi"]] },
  { sku: "OFC-001", name: "A4 Copy Paper (500 sheets)", category: "office-supplies", price: 120, stock: 120,
    description: "Bright white 80 gsm A4 paper for printers and copiers.",
    specs: [["Size", "A4"], ["Weight", "80 gsm"], ["Sheets", "500"]] },
  { sku: "OFC-002", name: "Ballpoint Pens (box of 50)", category: "office-supplies", price: 85, stock: 150,
    description: "Smooth-writing blue ballpoint pens, 50 per box.",
    specs: [["Colour", "Blue"], ["Count", "50"]] },
  { sku: "GEN-001", name: "Rechargeable LED Lantern", category: "general-merchandise", price: 260, stock: 40, featured: true,
    description: "Bright rechargeable lantern with a solar panel and phone-charging port.",
    specs: [["Light", "LED, 3 modes"], ["Charging", "Solar + USB"], ["Run time", "Up to 12 hours"]] },
  { sku: "GEN-002", name: "Windproof Umbrella", category: "general-merchandise", price: 90, stock: 75,
    description: "Compact folding umbrella with a reinforced frame for the rainy season.",
    specs: [["Canopy", "Pongee fabric"], ["Frame", "Windproof"]] },
];

// Placeholder fees: set the real ones in the admin dashboard (Phase 4).
const ZONES = [
  { name: "Freetown Central", regions: ["Central Freetown", "Tower Hill", "Cline Town", "Fourah Bay"], fee: 30, freeOver: 1500, min: 1, max: 1 },
  { name: "Freetown East", regions: ["Wellington", "Kissy", "Portee", "Calaba Town", "Allen Town"], fee: 40, freeOver: 1500, min: 1, max: 2 },
  { name: "Freetown West", regions: ["Lumley", "Aberdeen", "Congo Cross", "Wilberforce", "Goderich"], fee: 40, freeOver: 1500, min: 1, max: 2 },
  { name: "Western Area Rural", regions: ["Waterloo", "Hastings", "Lungi Road", "Tombo"], fee: 60, freeOver: 2500, min: 2, max: 3 },
  { name: "Provincial Towns", regions: ["Bo", "Kenema", "Makeni", "Koidu", "Port Loko"], fee: 120, freeOver: null, min: 3, max: 7 },
];

const SETTINGS: [string, unknown, string][] = [
  ["store.name", "ZUPA", "Store display name"],
  ["store.tagline", "Your everyday shopping destination.", "Tagline shown in the header and emails"],
  ["store.baseCurrency", "SLE", "ISO code of the currency prices are stored in"],
  ["store.supportEmail", "", "Customer support email (set in admin)"],
  ["store.supportPhone", "", "Customer support phone (set in admin)"],
  ["inventory.defaultLowStockThreshold", 5, "Alert when stock falls to this number"],
  ["checkout.paymentMethods", ["CASH_ON_DELIVERY", "MANUAL"], "Enabled payment methods. MONIME is added once the integration is live."],
];

async function main() {
  // Currencies (Leone is the base; USD is available for later display support)
  await prisma.currency.upsert({ where: { code: "SLE" }, update: {}, create: { code: "SLE", name: "Sierra Leonean Leone", symbol: "NLe", exponent: 2 } });
  await prisma.currency.upsert({ where: { code: "USD" }, update: {}, create: { code: "USD", name: "US Dollar", symbol: "$", exponent: 2, active: false } });

  // Categories
  const categoryId: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await prisma.productCategory.upsert({
      where: { slug: c.slug }, update: { name: c.name, sortOrder: i }, create: { ...c, sortOrder: i },
    });
    categoryId[c.slug] = row.id;
  }

  // Products + inventory + specifications
  for (const p of PRODUCTS) {
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const existing = await prisma.product.findUnique({ where: { sku: p.sku }, select: { id: true } });
    if (existing) continue; // never overwrite edits made in the admin dashboard
    const created = await prisma.product.create({
      data: {
        sku: p.sku, slug, name: p.name, description: p.description, brand: p.brand,
        categoryId: categoryId[p.category], priceMinor: nle(p.price),
        compareAtMinor: p.compareAt ? nle(p.compareAt) : null,
        status: ProductStatus.ACTIVE, featured: !!p.featured,
        specifications: { create: p.specs.map(([name, value], i) => ({ name, value, sortOrder: i })) },
        inventory: { create: { quantity: p.stock, lowStockThreshold: 5 } },
      },
    });
    await prisma.stockMovement.create({
      data: { productId: created.id, delta: p.stock, reason: StockReason.INITIAL, note: "Seed data" },
    });
  }

  // Delivery zones
  for (const z of ZONES) {
    await prisma.deliveryZone.upsert({
      where: { name: z.name },
      update: {},
      create: {
        name: z.name, regions: z.regions, feeMinor: nle(z.fee),
        freeOverMinor: z.freeOver ? nle(z.freeOver) : null,
        estimatedDaysMin: z.min, estimatedDaysMax: z.max,
      },
    });
  }

  // Sample delivery rider
  await prisma.deliveryPersonnel.upsert({
    where: { phone: "+23200000000" }, update: {},
    create: { name: "Sample Rider", phone: "+23200000000", vehicle: "Motorbike" },
  });

  // Welcome promotion
  await prisma.promotion.upsert({
    where: { code: "WELCOME10" }, update: {},
    create: { code: "WELCOME10", description: "10% off your first order", type: "PERCENTAGE", percentOff: 10, maxDiscountMinor: nle(200), minOrderMinor: nle(200) },
  });

  // Platform settings
  for (const [key, value, description] of SETTINGS) {
    await prisma.platformSetting.upsert({
      where: { key }, update: {}, create: { key, value: value as Prisma.InputJsonValue, description },
    });
  }

  // Super admin: password comes from the environment, or is generated and shown once.
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@zupa.sl").toLowerCase();
  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (!existingAdmin) {
    const password = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
    await prisma.user.create({
      data: {
        email, name: "ZUPA Admin", role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 12),
        adminProfile: { create: { adminRole: AdminRole.SUPER_ADMIN } },
      },
    });
    console.log("\n  Admin account created");
    console.log(`  email:    ${email}`);
    console.log(`  password: ${password}`);
    console.log("  (shown once: save it now, then change it after first login)\n");
  } else {
    console.log(`Admin ${email} already exists; password unchanged.`);
  }

  const [categories, products, zones] = await Promise.all([
    prisma.productCategory.count(), prisma.product.count(), prisma.deliveryZone.count(),
  ]);
  console.log(`Seed complete: ${categories} categories, ${products} products, ${zones} delivery zones.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
