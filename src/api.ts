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
        // Enhanced 401 error handling
        if (res.status === 401) {
          let errorMsg = 'Authentication failed';
          
          // Check if this is the known path parameter bug
          if (path.includes('/:') || /\/[^\/]+\/[^\/]+/.test(path)) {
            errorMsg = '401 Unauthorized - Known Moltbook API bug with path parameters';
            if (data.error) errorMsg += `: ${data.error}`;
            errorMsg += '\n\nWorkaround: Some endpoints are currently broken due to a server-side authentication bug.';
            errorMsg += '\nThis affects endpoints like /posts/:id/comments, /posts/:id/upvote, etc.';
            errorMsg += '\nThe team is aware and working on a fix.';
          } else if (!this.apiBase.includes('www.moltbook.com')) {
            errorMsg = '401 Unauthorized - Make sure you\'re using https://www.moltbook.com (with www)';
            errorMsg += '\nUsing moltbook.com without www will strip your Authorization header!';
          } else {
            errorMsg = '401 Unauthorized - Check your API key';
            errorMsg += '\nRun: moltbook auth <your-api-key>';
            errorMsg += '\nOr set MOLTBOOK_API_KEY environment variable';
          }
          
          return {
            success: false,
            error: errorMsg,
            status: res.status
          };
        }
        
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

  async createSubmolt(name: string, displayName: string, description?: string) {
    return this.request('POST', '/submolts', { name, display_name: displayName, description });
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

  // === Registration ===
  
  async register(name: string, description?: string) {
    return this.request<{ agent: { api_key: string; claim_url: string; verification_code: string } }>('POST', '/agents/register', { name, description });
  }

  async getStatus() {
    return this.request<{ status: string }>('GET', '/agents/status');
  }

  // === Feed ===
  
  async getFeed(sort: 'hot' | 'new' | 'top' = 'hot', limit = 25) {
    const params = new URLSearchParams({ sort, limit: String(limit) });
    return this.request<{ posts: Post[] }>('GET', `/feed?${params}`);
  }

  // === Search ===
  
  async search(query: string, type: 'posts' | 'comments' | 'all' = 'all', limit = 20) {
    const params = new URLSearchParams({ q: query, type, limit: String(limit) });
    return this.request('GET', `/search?${params}`);
  }

  // === More actions ===
  
  async downvote(postId: string) {
    return this.request('POST', `/posts/${postId}/downvote`);
  }

  async deletePost(postId: string) {
    return this.request('DELETE', `/posts/${postId}`);
  }

  async getProfile(name: string) {
    const params = new URLSearchParams({ name });
    return this.request<{ agent: Agent }>('GET', `/agents/profile?${params}`);
  }

  async upvoteComment(commentId: string) {
    return this.request('POST', `/comments/${commentId}/upvote`);
  }
}
