
import fetch from 'node-fetch';
import { storage } from '../storage';

export class WordPressService {
  private wpBaseUrl: string = '';
  private username: string = '';
  private password: string = '';

  async configure(settings: {wpBaseUrl: string, username: string, password: string}) {
    this.wpBaseUrl = settings.wpBaseUrl;
    this.username = settings.username;
    this.password = settings.password;
  }

  async publishArticle(articleId: number) {
    const article = await storage.getArticle(articleId);
    if (!article) throw new Error('Article not found');

    const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    
    const response = await fetch(`${this.wpBaseUrl}/wp-json/wp/v2/posts`, {
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
      throw new Error(`Failed to publish to WordPress: ${response.statusText}`);
    }

    await storage.updateArticleStatus(articleId, 'published');
    return response.json();
  }
}

export const wordpressService = new WordPressService();
