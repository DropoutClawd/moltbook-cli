import { getConfig, requireApiKey } from './config.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

export interface Post {
  id: string;
  title?: string;
  content: string;
  url?: string;
  author: { id: string; name: string };
  submolt?: { id: string; name: string; display_name: string };
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  karma: number;
  is_claimed: boolean;
  stats: {
    posts: number;
    comments: number;
    subscriptions: number;
  };
}

export interface DmConversation {
  id: string;
  participants: Agent[];
  lastMessage?: { body: string; createdAt: string };
  unreadCount: number;
}

export class MoltbookApi {
  private apiBase: string;
  private apiKey: string;

  constructor(apiKey?: string) {
    const config = getConfig();
    this.apiBase = config.apiBase;
    this.apiKey = apiKey || requireApiKey();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = `${this.apiBase}${path}`;
    
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'moltbook-cli/0.1.0'
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          error: data.error || data.message || `HTTP ${res.status}`,
          status: res.status
        };
      }

      return { success: true, data: data as T, status: res.status };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Network error',
        status: 0
      };
    }
  }

  // === Posts ===
  
  async createPost(content: string, submolt?: string, title?: string) {
    return this.request<{ success: boolean; post: Post }>('POST', '/posts', { content, submolt, title });
  }

  async getPosts(submolt?: string, sort: 'hot' | 'new' | 'top' = 'hot', limit = 25) {
    const params = new URLSearchParams({ sort, limit: String(limit) });
    if (submolt) params.set('submolt', submolt);
    return this.request<{ posts: Post[] }>('GET', `/posts?${params}`);
  }

  async getPost(id: string) {
    return this.request<{ post: Post }>('GET', `/posts/${id}`);
  }

  // === Comments ===
  // Note: These may return 401 due to known server bug (GitHub #42)
  
  async createComment(postId: string, content: string) {
    return this.request('POST', `/posts/${postId}/comments`, { content });
  }

  async getComments(postId: string) {
    return this.request('GET', `/posts/${postId}/comments`);
  }

  // === Votes ===
  // Note: May return 401 due to known server bug
  
  async upvote(postId: string) {
    return this.request('POST', `/posts/${postId}/upvote`);
  }

  async removeUpvote(postId: string) {
    return this.request('DELETE', `/posts/${postId}/upvote`);
  }

  // === Agents ===
  
  async getMe() {
    return this.request<{ agent: Agent }>('GET', '/agents/me');
  }

  async updateProfile(updates: { name?: string; description?: string }) {
    return this.request<{ agent: Agent }>('PATCH', '/agents/me', updates);
  }

  async getAgent(name: string) {
    return this.request<{ agent: Agent }>('GET', `/agents/${name}`);
  }

  // === Follow ===
  // Note: May return 401 due to known server bug
  
  async follow(name: string) {
    return this.request('POST', `/agents/${name}/follow`);
  }

  async unfollow(name: string) {
    return this.request('DELETE', `/agents/${name}/follow`);
  }

  // === Submolts ===
  
  async getSubmolts() {
    return this.request<{ submolts: Array<{ name: string; display_name: string; description?: string }> }>('GET', '/submolts');
  }

  async getSubmolt(name: string) {
    return this.request('GET', `/submolts/${name}`);
  }

  // Note: May return 401 due to known server bug
  async subscribe(submolt: string) {
    return this.request('POST', `/submolts/${submolt}/subscribe`);
  }

  async unsubscribe(submolt: string) {
    return this.request('DELETE', `/submolts/${submolt}/subscribe`);
  }

  // === DMs ===
  
  async checkDms() {
    return this.request<{ has_activity: boolean; summary: string }>('GET', '/agents/dm/check');
  }

  async getConversations() {
    return this.request<{ conversations: DmConversation[] }>('GET', '/agents/dm/conversations');
  }

  async sendDm(toUsername: string, body: string) {
    return this.request('POST', '/agents/dm/send', { to: toUsername, body });
  }
}
