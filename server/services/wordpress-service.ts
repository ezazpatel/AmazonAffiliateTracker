
import fetch from 'node-fetch';
import { storage } from '../storage';

export class WordPressService {
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { wpBaseUrl, username, password } = this.getCredentials();
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      
      const response = await fetch(`${wpBaseUrl}/wp-json/wp/v2/users/me`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to connect to WordPress');
      }

      const data = await response.json();
      return { 
        success: true, 
        message: `Connected successfully as ${data.name}` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  private getCredentials() {
    const wpBaseUrl = process.env.WP_BASE_URL;
    const username = process.env.WP_USERNAME;
    const password = process.env.WP_PASSWORD;

    if (!wpBaseUrl || !username || !password) {
      throw new Error('WordPress credentials not configured in environment variables');
    }

    return { wpBaseUrl, username, password };
  }

  async publishArticle(articleId: number) {
    console.log('[WordPressService] Starting article publish:', articleId);
    
    const article = await storage.getArticle(articleId);
    if (!article) {
      console.error('[WordPressService] Article not found:', articleId);
      throw new Error('Article not found');
    }
    console.log('[WordPressService] Article found:', { id: article.id, title: article.title });

    const { wpBaseUrl, username, password } = this.getCredentials();
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    console.log('[WordPressService] Sending request to WordPress:', wpBaseUrl);
    
    try {
      const response = await fetch(`${wpBaseUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: article.title,
          content: article.content,
          status: 'publish'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WordPressService] WordPress API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Failed to publish to WordPress: ${response.statusText} - ${errorText}`);
      }
      
      console.log('[WordPressService] Successfully published to WordPress');

    await storage.updateArticleStatus(articleId, 'published');
    return response.json();
  }
}

export const wordpressService = new WordPressService();
