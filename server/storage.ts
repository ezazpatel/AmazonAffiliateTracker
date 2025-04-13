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
  type InsertApiSettings
} from "@shared/schema";

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
  getUser(id: number): Promise<any | undefined>;
  getUserByUsername(username: string): Promise<any | undefined>;
  createUser(user: any): Promise<any>;
}

export class MemStorage implements IStorage {
  private keywords: Map<number, Keyword>;
  private articles: Map<number, Article>;
  private products: Map<number, Product>;
  private activities: Map<number, Activity>;
  private apiSettings?: ApiSettings;
  private users: Map<number, any>;
  
  private currentKeywordId: number;
  private currentArticleId: number;
  private currentProductId: number;
  private currentActivityId: number;
  private currentUserId: number;
  
  constructor() {
    this.keywords = new Map();
    this.articles = new Map();
    this.products = new Map();
    this.activities = new Map();
    this.users = new Map();
    
    this.currentKeywordId = 1;
    this.currentArticleId = 1;
    this.currentProductId = 1;
    this.currentActivityId = 1;
    this.currentUserId = 1;
    
    // Add some sample activities
    this.addActivity({
      activityType: "article_generated",
      message: "Article \"Best Gaming Chairs for 2023\" was successfully generated",
    });
    
    this.addActivity({
      activityType: "csv_imported",
      message: "Successfully imported 12 keywords from tech_products.csv",
    });
    
    this.addActivity({
      activityType: "api_warning",
      message: "Anthropic API credit usage at 75%, consider upgrading your plan",
    });
    
    this.addActivity({
      activityType: "generation_failed",
      message: "Failed to generate article \"Best Budget Laptops\" due to Amazon API timeout",
    });
  }
  
  // Keywords
  async getKeyword(id: number): Promise<Keyword | undefined> {
    return this.keywords.get(id);
  }
  
  async getKeywords(
    limit: number, 
    offset: number, 
    search: string = "", 
    status: string = "all"
  ): Promise<{ keywords: Keyword[], total: number }> {
    let filteredKeywords = Array.from(this.keywords.values());
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredKeywords = filteredKeywords.filter(keyword => 
        keyword.primaryKeyword.toLowerCase().includes(searchLower)
      );
    }
    
    if (status && status !== "all") {
      filteredKeywords = filteredKeywords.filter(keyword => 
        keyword.status === status
      );
    }
    
    // Sort by most recent
    filteredKeywords = filteredKeywords.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const paginatedKeywords = filteredKeywords.slice(offset, offset + limit);
    
    return {
      keywords: paginatedKeywords,
      total: filteredKeywords.length
    };
  }
  
  async getUpcomingKeywords(limit: number = 4): Promise<Keyword[]> {
    const pendingKeywords = Array.from(this.keywords.values())
      .filter(keyword => keyword.status === "pending")
      .sort((a, b) => {
        // Sort by date and time
        const dateA = `${a.scheduledDate} ${a.scheduledTime}`;
        const dateB = `${b.scheduledDate} ${b.scheduledTime}`;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      })
      .slice(0, limit);
    
    return pendingKeywords;
  }
  
  async addKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const id = this.currentKeywordId++;
    const newKeyword: Keyword = {
      ...keyword,
      id,
      status: "pending",
      createdAt: new Date(),
    };
    
    this.keywords.set(id, newKeyword);
    return newKeyword;
  }
  
  async addKeywords(keywords: InsertKeyword[]): Promise<Keyword[]> {
    const addedKeywords: Keyword[] = [];
    
    for (const keyword of keywords) {
      const newKeyword = await this.addKeyword(keyword);
      addedKeywords.push(newKeyword);
    }
    
    return addedKeywords;
  }
  
  async updateKeywordStatus(id: number, status: string): Promise<void> {
    const keyword = this.keywords.get(id);
    
    if (keyword) {
      keyword.status = status;
      this.keywords.set(id, keyword);
    }
  }
  
  async countPendingKeywords(): Promise<number> {
    return Array.from(this.keywords.values())
      .filter(keyword => keyword.status === "pending")
      .length;
  }
  
  // Articles
  async getArticle(id: number): Promise<Article | undefined> {
    return this.articles.get(id);
  }
  
  async getArticles(
    limit: number, 
    offset: number, 
    search: string = "", 
    status: string = "all", 
    keywordId?: number
  ): Promise<{ articles: Article[], total: number }> {
    let filteredArticles = Array.from(this.articles.values());
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredArticles = filteredArticles.filter(article => 
        article.title.toLowerCase().includes(searchLower)
      );
    }
    
    if (status && status !== "all") {
      filteredArticles = filteredArticles.filter(article => 
        article.status === status
      );
    }
    
    if (keywordId) {
      filteredArticles = filteredArticles.filter(article => 
        article.keywordId === keywordId
      );
    }
    
    // Sort by most recent
    filteredArticles = filteredArticles.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const paginatedArticles = filteredArticles.slice(offset, offset + limit);
    
    return {
      articles: paginatedArticles,
      total: filteredArticles.length
    };
  }
  
  async addArticle(article: InsertArticle): Promise<Article> {
    const id = this.currentArticleId++;
    const newArticle: Article = {
      ...article,
      id,
      createdAt: new Date(),
    };
    
    this.articles.set(id, newArticle);
    return newArticle;
  }
  
  async countArticles(): Promise<number> {
    return this.articles.size;
  }
  
  // Products
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }
  
  async getProductsByArticleId(articleId: number): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(product => product.articleId === articleId);
  }
  
  async addProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const newProduct: Product = {
      ...product,
      id,
      createdAt: new Date(),
    };
    
    this.products.set(id, newProduct);
    return newProduct;
  }
  
  async countProducts(): Promise<number> {
    return this.products.size;
  }
  
  // Activities
  async getActivities(limit: number = 10): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
  
  async addActivity(activity: InsertActivity): Promise<Activity> {
    const id = this.currentActivityId++;
    const newActivity: Activity = {
      ...activity,
      id,
      createdAt: new Date(),
    };
    
    this.activities.set(id, newActivity);
    return newActivity;
  }
  
  // API Settings
  async getApiSettings(): Promise<ApiSettings | undefined> {
    return this.apiSettings;
  }
  
  async saveApiSettings(settings: InsertApiSettings): Promise<ApiSettings> {
    const now = new Date();
    
    if (this.apiSettings) {
      this.apiSettings = {
        ...this.apiSettings,
        ...settings,
        updatedAt: now,
      };
    } else {
      this.apiSettings = {
        ...settings,
        id: 1,
        createdAt: now,
        updatedAt: now,
      };
    }
    
    return this.apiSettings;
  }
  
  // User methods from base interface
  async getUser(id: number): Promise<any | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<any | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(user: any): Promise<any> {
    const id = this.currentUserId++;
    const newUser = { ...user, id };
    this.users.set(id, newUser);
    return newUser;
  }
}

export const storage = new MemStorage();
