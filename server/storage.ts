import { 
  type Keyword, 
  type InsertKeyword, 
  type Article, 
  type InsertArticle,
  type Product,
  type InsertProduct,
  type Activity,
  type InsertActivity,
  type ApiSettings,
  type InsertApiSettings,
  type User,
  type InsertUser,
  keywords,
  articles,
  products,
  activities,
  apiSettings,
  users,
  productDetails,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, like, desc, sql, asc } from "drizzle-orm";

export interface IStorage {
  // Keywords
  getKeyword(id: number): Promise<Keyword | undefined>;
  getKeywords(limit: number, offset: number, search?: string, status?: string): Promise<{ keywords: Keyword[], total: number }>;
  getUpcomingKeywords(limit?: number): Promise<Keyword[]>;
  addKeyword(keyword: InsertKeyword): Promise<Keyword>;
  addKeywords(keywords: InsertKeyword[]): Promise<Keyword[]>;
  updateKeywordStatus(id: number, status: string): Promise<void>;
  countPendingKeywords(): Promise<number>;
  
  // Articles
  getArticle(id: number): Promise<Article | undefined>;
  getArticles(limit: number, offset: number, search?: string, status?: string, keywordId?: number): Promise<{ articles: Article[], total: number }>;
  addArticle(article: InsertArticle): Promise<Article>;
  countArticles(): Promise<number>;
  
  // Products
  getProduct(id: number): Promise<Product | undefined>;
  getProductsByArticleId(articleId: number): Promise<Product[]>;
  addProduct(product: InsertProduct): Promise<Product>;
  countProducts(): Promise<number>;
  
  // Activities
  getActivities(limit?: number): Promise<Activity[]>;
  addActivity(activity: InsertActivity): Promise<Activity>;
  
  // API Settings
  getApiSettings(): Promise<ApiSettings | undefined>;
  saveApiSettings(settings: InsertApiSettings): Promise<ApiSettings>;
  
  // User methods from base interface
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // Keywords
  async getKeyword(id: number): Promise<Keyword | undefined> {
    const [keyword] = await db.select().from(keywords).where(eq(keywords.id, id));
    return keyword;
  }
  
  async getKeywords(
    limit: number, 
    offset: number, 
    search: string = "", 
    status: string = "all"
  ): Promise<{ keywords: Keyword[], total: number }> {
    let conditions = [];
    
    if (search) {
      conditions.push(like(keywords.primaryKeyword, `%${search}%`));
    }
    
    if (status && status !== "all") {
      conditions.push(eq(keywords.status, status));
    }
    
    let query = db.select().from(keywords);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(keywords);
    
    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 
        ? conditions[0] 
        : and(...conditions);
      
      query = query.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }
    
    const keywordsList = await query
      .orderBy(desc(keywords.createdAt))
      .limit(limit)
      .offset(offset);
    
    const [{ count }] = await countQuery;
    
    return { 
      keywords: keywordsList, 
      total: count 
    };
  }
  
  async getUpcomingKeywords(limit: number = 4): Promise<Keyword[]> {
    return db.select()
      .from(keywords)
      .where(eq(keywords.status, "pending"))
      .orderBy(
        asc(sql`concat(${keywords.scheduledDate}, ' ', ${keywords.scheduledTime})::timestamp`)
      )
      .limit(limit);
  }
  
  async addKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const [newKeyword] = await db.insert(keywords)
      .values(keyword)
      .returning();
    
    // Log activity
    await this.addActivity({
      activityType: "keyword_added",
      message: `New keyword "${keyword.primaryKeyword}" was added`
    });
    
    return newKeyword;
  }
  
  async addKeywords(keywordsList: InsertKeyword[]): Promise<Keyword[]> {
    if (keywordsList.length === 0) {
      return [];
    }
    
    const newKeywords = await db.insert(keywords)
      .values(keywordsList)
      .returning();
    
    return newKeywords;
  }
  
  async updateKeywordStatus(id: number, status: string): Promise<void> {
    await db.update(keywords)
      .set({ status })
      .where(eq(keywords.id, id));
  }
  
  async countPendingKeywords(): Promise<number> {
    const [{ count }] = await db.select({ 
      count: sql<number>`count(*)` 
    })
    .from(keywords)
    .where(eq(keywords.status, "pending"));
    
    return count;
  }
  
  // Articles
  async getArticle(id: number): Promise<Article | undefined> {
    const [article] = await db.select().from(articles).where(eq(articles.id, id));
    return article;
  }
  
  async getArticles(
    limit: number, 
    offset: number, 
    search: string = "", 
    status: string = "all", 
    keywordId?: number
  ): Promise<{ articles: Article[], total: number }> {
    let conditions = [];
    
    if (search) {
      conditions.push(
        sql`(${articles.title} ILIKE ${'%' + search + '%'} OR ${articles.content} ILIKE ${'%' + search + '%'})`
      );
    }
    
    if (status && status !== "all") {
      conditions.push(eq(articles.status, status));
    }
    
    if (keywordId) {
      conditions.push(eq(articles.keywordId, keywordId));
    }
    
    let query = db.select().from(articles);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(articles);
    
    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 
        ? conditions[0] 
        : and(...conditions);
      
      query = query.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }
    
    const articlesList = await query
      .orderBy(desc(articles.createdAt))
      .limit(limit)
      .offset(offset);
    
    const [{ count }] = await countQuery;
    
    return { 
      articles: articlesList, 
      total: count 
    };
  }
  
  async addArticle(article: InsertArticle): Promise<Article> {
    const [newArticle] = await db.insert(articles)
      .values(article)
      .returning();
    
    // Log activity
    await this.addActivity({
      activityType: "article_generated",
      message: `New article "${article.title}" was generated`
    });
    
    return newArticle;
  }
  
  async countArticles(): Promise<number> {
    const [{ count }] = await db.select({ 
      count: sql<number>`count(*)` 
    })
    .from(articles);
    
    return count;
  }

  async updateArticleStatus(id: number, status: string): Promise<void> {
    await db.update(articles)
      .set({ status })
      .where(eq(articles.id, id));
  }
  
  // Products
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }
  
  async getProductsByArticleId(articleId: number): Promise<Product[]> {
    return db.select()
      .from(products)
      .where(eq(products.articleId, articleId));
  }
  
  async addProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products)
      .values(product)
      .returning();
    
    return newProduct;
  }

  async hasProductDetails(asin: string): Promise<boolean> {
    const [result] = await db.select()
      .from(productDetails)
      .where(eq(productDetails.asin, asin))
      .limit(1);
    return !!result;
  }

  async getProductDetails(asin: string): Promise<any> {
    const [result] = await db.select()
      .from(productDetails)
      .where(eq(productDetails.asin, asin));
    return result;
  }

  async saveProductDetails(details: any): Promise<void> {
    await db.insert(productDetails)
      .values(details)
      .onConflictDoUpdate({
        target: productDetails.asin,
        set: details
      });
  }
  
  async countProducts(): Promise<number> {
    const [{ count }] = await db.select({ 
      count: sql<number>`count(*)` 
    })
    .from(products);
    
    return count;
  }
  
  // Activities
  async getActivities(limit: number = 10): Promise<Activity[]> {
    return db.select()
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }
  
  async addActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities)
      .values(activity)
      .returning();
    
    return newActivity;
  }
  
  // API Settings
  async getApiSettings(): Promise<ApiSettings | undefined> {
    const [settings] = await db.select().from(apiSettings).limit(1);
    return settings;
  }
  
  async saveApiSettings(settings: InsertApiSettings): Promise<ApiSettings> {
    const currentSettings = await this.getApiSettings();
    
    if (currentSettings) {
      // Update existing settings
      const [updatedSettings] = await db.update(apiSettings)
        .set({
          ...settings,
          updatedAt: new Date()
        })
        .where(eq(apiSettings.id, currentSettings.id))
        .returning();
      
      return updatedSettings;
    } else {
      // Create new settings
      const [newSettings] = await db.insert(apiSettings)
        .values(settings)
        .returning();
      
      return newSettings;
    }
  }
  
  // User methods from base interface
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users)
      .values(user)
      .returning();
    
    return newUser;
  }
}

// Initialize with some sample activities to make the dashboard look nice
async function seedActivities() {
  const storage = new DatabaseStorage();
  
  try {
    const activities = await storage.getActivities(1);
    
    // Only add initial activities if there are none
    if (activities.length === 0) {
      await storage.addActivity({
        activityType: "article_generated",
        message: "Article \"Best Gaming Chairs for 2023\" was successfully generated",
      });
      
      await storage.addActivity({
        activityType: "csv_imported",
        message: "Successfully imported 12 keywords from tech_products.csv",
      });
      
      await storage.addActivity({
        activityType: "api_warning",
        message: "Anthropic API credit usage at 75%, consider upgrading your plan",
      });
      
      await storage.addActivity({
        activityType: "generation_failed",
        message: "Failed to generate article \"Best Budget Laptops\" due to Amazon API timeout",
      });
    }
  } catch (error) {
    console.error("Error seeding initial activities:", error);
  }
}

export const storage = new DatabaseStorage();

// Seed initial activities
seedActivities().catch(console.error);