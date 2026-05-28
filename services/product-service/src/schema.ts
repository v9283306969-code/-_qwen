import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  decimal,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==========================================
// ENUMS (Перечисления)
// ==========================================

export const productStatusEnum = pgEnum("product_status", [
  "active",
  "clearance", // Уценка (брак/возврат)
  "archived",
  "draft",
]);

export const productTypeEnum = pgEnum("product_type", [
  "cosmetics", // Косметика
  "supplements", // БАДы
  "bundle", // Набор (только для маржинга)
]);

export const stockStatusEnum = pgEnum("stock_status", [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "pre_order", // Доступен под заказ
]);

export const transactionTypeEnum = pgEnum("reservation_action_type", [
  "restock", // Пополнение склада
  "sale", // Продажа (списание)
  "reserve", // Резервирование под заказ
  "release", // Снятие резерва (отмена/таймаут)
  "defective_mark", // Пометка "Брак" (снятие из доступных)
  "return_to_stock", // Возврат от клиента в продажу
  "return_to_clearance", // Возврат от клиента в уценку
  "adjustment", // Ручная корректировка менеджером
]);

// ==========================================
// 1. CATALOG (Каталог)
// ==========================================

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    parentId: uuid("parent_id"), // Дерево категорий (вложенность)
    imageUrl: varchar("image_url", { length: 500 }),
    type: productTypeEnum("type").notNull().default("cosmetics"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(10),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex("idx_category_slug").on(t.slug),
    parentIdx: index("idx_category_parent").on(t.parentId),
  })
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  children: many(categories),
  products: many(products),
}));

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id").notNull().references(() => categories.id),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    type: productTypeEnum("type").notNull().default("cosmetics"),
    brand: varchar("brand", { length: 100 }),
    isCommissionable: boolean("is_commissionable").notNull().default(true),
    strapiId: varchar("strapi_id", { length: 50 }),
    sourceVariantId: uuid("source_variant_id"), // Для уценки: связь с оригиналом
    status: productStatusEnum("status").notNull().default("draft"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex("idx_product_slug").on(t.slug),
    catIdx: index("idx_product_category").on(t.categoryId),
    searchIdx: index("idx_product_search").on(t.name),
  })
);

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
}));

// ==========================================
// 2. VARIANTS & CONTENT
// ==========================================

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    sku: varchar("sku", { length: 50 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    oldPrice: decimal("old_price", { precision: 10, scale: 2 }),
    stockStatus: stockStatusEnum("stock_status").notNull().default("in_stock"),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    skuIdx: uniqueIndex("idx_variant_sku").on(t.sku),
    productIdx: index("idx_variant_product").on(t.productId),
  })
);

export const variantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
  media: many(productMedia),
  specs: many(productSpecs),
  inventory: many(inventory),
  partnerPrices: many(productPartnerPrices),
}));

export const productMedia = pgTable(
  "product_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    url: varchar("url", { length: 500 }).notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => ({
    variantIdx: index("idx_media_variant").on(t.variantId),
  })
);

export const productSpecs = pgTable(
  "product_specs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    key: varchar("key", { length: 50 }).notNull(),
    value: text("value").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    variantIdx: index("idx_specs_variant").on(t.variantId),
  })
);

// ==========================================
// 3. MLM & PRICING
// ==========================================

export const partnerTiers = pgTable(
  "partner_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 50 }).notNull(),
    slug: varchar("slug", { length: 20 }).notNull(),
    level: integer("level").notNull(),
    defaultDiscountPercent: integer("default_discount_percent").default(0),
  }
);

export const productPartnerPrices = pgTable(
  "product_partner_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    tierId: uuid("tier_id")
      .notNull()
      .references(() => partnerTiers.id),
    customPrice: decimal("custom_price", { precision: 10, scale: 2 }),
    validFrom: timestamp("valid_from").notNull(),
    validTo: timestamp("valid_to"),
  },
  (t) => ({
    variantTierIdx: uniqueIndex("idx_partner_price").on(t.variantId, t.tierId),
  })
);

export const commissionRules = pgTable(
  "commission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetTierLevel: integer("target_tier_level").notNull(),
    generationLevel: integer("generation_level").notNull(), // 1 или 2
    percent: decimal("percent", { precision: 5, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
  }
);

// ==========================================
// 4. INVENTORY & WAREHOUSES
// ==========================================

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    location: varchar("location", { length: 200 }),
    isMain: boolean("is_main").notNull().default(false),
    isDefective: boolean("is_defective").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
  }
);

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id").notNull().references(() => productVariants.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    quantityTotal: integer("quantity_total").notNull(),
    quantityDefective: integer("quantity_defective").notNull().default(0),
    quantityReserved: integer("quantity_reserved").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueIdx: uniqueIndex("idx_inventory_unique").on(t.variantId, t.warehouseId),
  })
);

export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id").notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
    type: transactionTypeEnum("type").notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    referenceId: varchar("reference_id", { length: 100 }),
    reason: text("reason"),
    performedBy: varchar("performed_by", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    variantIdx: index("idx_trx_variant").on(t.variantId),
    refIdx: index("idx_trx_ref").on(t.referenceId),
  })
);

export const inventoryRelations = relations(inventory, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventory.variantId],
    references: [productVariants.id],
  }),
  warehouse: one(warehouses, {
    fields: [inventory.warehouseId],
    references: [warehouses.id],
  }),
}));

// ==========================================
// 5. RESERVATIONS
// ==========================================

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: varchar("order_id", { length: 100 }).notNull(),
    variantId: uuid("variant_id").notNull(),
    warehouseId: uuid("warehouse_id").notNull(),
    quantity: integer("quantity").notNull(),
    lockedPrice: decimal("locked_price", { precision: 10, scale: 2 }).notNull(),
    reservedUntil: timestamp("reserved_until").notNull(),
    managedManually: boolean("managed_manually").notNull().default(false),
  },
  (t) => ({
    orderIdx: index("idx_reservation_order").on(t.orderId),
    expIdx: index("idx_reservation_expiry").on(t.reservedUntil),
  })
);

// ==========================================
// 6. BUNDLES
// ==========================================

export const bundles = pgTable(
  "bundles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
  }
);

export const bundleItems = pgTable(
  "bundle_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bundleId: uuid("bundle_id").notNull().references(() => bundles.id),
    variantId: uuid("variant_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => ({
    bundleIdx: index("idx_bundle_item").on(t.bundleId),
  })
);
