import crypto from "crypto";
import { storage } from "../storage";
import { type InsertProduct } from "@shared/schema";

interface AmazonProduct {
  asin: string;
  title: string;
  description: string;
  imageUrl: string;
  affiliateLink: string;
}

export class AmazonService {
  private async getApiSettings() {
    const settings = await storage.getApiSettings();
    
    if (!settings || !settings.amazonPartnerId || !settings.amazonApiKey || !settings.amazonSecretKey) {
      throw new Error("Amazon Partner API settings not configured");
    }
    
    return {
      partnerId: settings.amazonPartnerId,
      apiKey: settings.amazonApiKey,
      secretKey: settings.amazonSecretKey,
    };
  }
  
  /**
   * Search for products on Amazon using the Partner API
   */
  async searchProducts(keyword: string, count: number = 5): Promise<AmazonProduct[]> {
    try {
      const settings = await this.getApiSettings();
      
      // In a real implementation, this would make an actual API call to Amazon
      // For this prototype, we'll generate mock products based on the keyword
      
      // Real implementation would look something like this:
      // const timestamp = new Date().toISOString();
      // const signature = this.generateSignature(settings.secretKey, keyword, timestamp);
      // const url = `https://webservices.amazon.com/paapi5/searchitems?...`;
      // const response = await fetch(url, {
      //   headers: {
      //     'Authorization': `AWS ${settings.apiKey}:${signature}`,
      //     'Content-Type': 'application/json',
      //   }
      // });
      // const data = await response.json();
      // Process and return the actual product data...
      
      // Instead, we'll simulate a response
      const products: AmazonProduct[] = [];
      
      for (let i = 1; i <= count; i++) {
        // Generate a stable ASIN based on keyword and index
        const asinBase = crypto.createHash('md5').update(`${keyword}-${i}`).digest('hex');
        const asin = `B0${asinBase.substring(0, 8)}`.toUpperCase();
        
        products.push({
          asin,
          title: `${this.capitalizeFirstLetter(keyword)} ${this.getProductSuffix(i)}`,
          description: `Top rated ${keyword} with premium features. This ${keyword} ${this.getProductDescription(i)}`,
          imageUrl: `https://images-na.ssl-images-amazon.com/images/I/${this.generateImageId()}.jpg`,
          affiliateLink: `https://www.amazon.com/dp/${asin}?tag=${settings.partnerId}`,
        });
      }
      
      return products;
    } catch (error) {
      console.error("Amazon product search failed:", error);
      throw new Error(`Failed to search Amazon products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Add products to storage for a specific article
   */
  async addProductsToArticle(articleId: number, products: AmazonProduct[]): Promise<void> {
    for (const product of products) {
      const productData: InsertProduct = {
        articleId,
        asin: product.asin,
        title: product.title,
        description: product.description,
        imageUrl: product.imageUrl,
        affiliateLink: product.affiliateLink,
      };
      
      await storage.addProduct(productData);
    }
  }
  
  /**
   * Helper function to capitalize first letter of each word
   */
  private capitalizeFirstLetter(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Helper function to generate a product suffix
   */
  private getProductSuffix(index: number): string {
    const suffixes = [
      "Pro Max", 
      "Elite Edition", 
      "Premium", 
      "Deluxe", 
      "Ultra", 
      "Advanced", 
      "Plus",
      "Standard",
      "Compact",
      "Mini"
    ];
    
    return suffixes[index % suffixes.length];
  }
  
  /**
   * Helper function to generate product description
   */
  private getProductDescription(index: number): string {
    const descriptions = [
      "features advanced technology for maximum performance and reliability.",
      "is designed for professional use with premium materials and craftsmanship.",
      "offers exceptional value with its innovative features and elegant design.",
      "combines cutting-edge technology with user-friendly interfaces.",
      "is perfect for both beginners and experts seeking quality and durability."
    ];
    
    return descriptions[index % descriptions.length];
  }
  
  /**
   * Generate a random Amazon image ID
   */
  private generateImageId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }
}

export const amazonService = new AmazonService();
