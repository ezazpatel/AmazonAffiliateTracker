import { integer, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Product details table to store cached Amazon product data
export const productDetails = pgTable("product_details", {
  id: serial("id").primaryKey(),
  asin: text("asin").notNull().unique(),
  title: text("title"),
  description: text("description"),
  image_url: text("image_url"),
  price: text("price"),
  is_buy_box_winner: boolean("is_buy_box_winner"),
  is_prime_eligible: boolean("is_prime_eligible"), 
  condition: text("condition"),
  availability_type: text("availability_type"),
  sales_rank: integer("sales_rank"),
  created_at: timestamp("created_at").defaultNow(),
});

export type ProductDetails = typeof productDetails.$inferSelect;
export type InsertProductDetails = typeof productDetails.$inferInsert;

export const insertProductDetailsSchema = createInsertSchema(productDetails);

// Keywords table to store upload CSV data
export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  primaryKeyword: text("primary_keyword").notNull(),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKeywordSchema = createInsertSchema(keywords).omit({
  id: true,
  createdAt: true,
  status: true,
});

// Articles table to store generated content
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  keywordId: integer("keyword_id").notNull().references(() => keywords.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  snippet: text("snippet"),
  status: text("status").notNull().default("draft"), // draft, published
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  createdAt: true,
});

// Products table to store Amazon product data
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id),
  asin: text("asin").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  affiliateLink: text("affiliate_link").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

// Define relations after both articles and products are declared.
export const articlesRelations = relations(articles, ({ one, many }) => ({
  keyword: one(keywords, {
    fields: [articles.keywordId],
    references: [keywords.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  article: one(articles, {
    fields: [products.articleId],
    references: [articles.id],
  }),
}));

// Activities table to track system activities
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  activityType: text("activity_type").notNull(), // article_generated, csv_imported, api_warning, generation_failed
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

// API settings table
export const apiSettings = pgTable("api_settings", {
  id: serial("id").primaryKey(),
  amazonPartnerId: text("amazon_partner_id"),
  amazonApiKey: text("amazon_api_key"),
  amazonSecretKey: text("amazon_secret_key"),
  anthropicApiKey: text("anthropic_api_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  wpBaseUrl: text("wp_base_url"),
  wpUsername: text("wp_username"),
  wpPassword: text("wp_password"),
});

export const insertApiSettingsSchema = createInsertSchema(apiSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;

export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type ApiSettings = typeof apiSettings.$inferSelect;
export type InsertApiSettings = z.infer<typeof insertApiSettingsSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;