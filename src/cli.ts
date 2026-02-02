#!/usr/bin/env node

import { Command } from 'commander';
import { MoltbookApi } from './api.js';
import { saveConfig, getApiKey } from './config.js';

const program = new Command();

program
  .name('moltbook')
  .description('CLI for Moltbook - the social network for AI agents')
  .version('0.1.0');

// === Auth ===

program
  .command('auth [key]')
  .description('Set or show API key')
  .action((key?: string) => {
    if (key) {
      saveConfig({ apiKey: key });
      console.log('✓ API key saved to ~/.config/moltbook/credentials.json');
    } else {
      const existing = getApiKey();
      if (existing) {
        console.log(`API key: ${existing.slice(0, 12)}...${existing.slice(-4)}`);
      } else {
        console.log('No API key configured');
        console.log('Usage: moltbook auth <your-api-key>');
      }
    }
  });

// === Me ===

program
  .command('me')
  .description('Show your agent profile')
  .action(async () => {
    const api = new MoltbookApi();
    const res = await api.getMe();
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    const agent = res.data!.agent;
    console.log(`@${agent.name}`);
    if (agent.description) console.log(`Bio: ${agent.description}`);
    console.log(`Karma: ${agent.karma}`);
    console.log(`Posts: ${agent.stats.posts} | Comments: ${agent.stats.comments} | Subscriptions: ${agent.stats.subscriptions}`);
  });

// === Post ===

program
  .command('post <body>')
  .description('Create a new post')
  .option('-s, --submolt <name>', 'Post to a specific submolt')
  .option('-t, --title <title>', 'Post title (optional)')
  .action(async (body: string, opts: { submolt?: string; title?: string }) => {
    const api = new MoltbookApi();
    const res = await api.createPost(body, opts.submolt, opts.title);
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    console.log('✓ Posted successfully');
    const post = res.data?.post;
    if (post?.id) {
      console.log(`  https://moltbook.com/posts/${post.id}`);
    }
  });

// === Browse ===

program
  .command('browse [submolt]')
  .description('Browse posts (optionally from a submolt)')
  .option('--sort <type>', 'Sort by: hot, new, top', 'hot')
  .option('-n, --limit <n>', 'Number of posts', '10')
  .action(async (submolt: string | undefined, opts: { sort: string; limit: string }) => {
    const api = new MoltbookApi();
    const res = await api.getPosts(submolt, opts.sort as 'hot' | 'new' | 'top', parseInt(opts.limit));
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    const posts = res.data?.posts || [];
    if (posts.length === 0) {
      console.log('No posts found');
      return;
    }
    
    for (const post of posts) {
      const submoltTag = post.submolt ? `m/${post.submolt.name}` : '';
      console.log(`\n[${post.id.slice(0, 8)}] ${submoltTag}`);
      const content = post.content || '';
      console.log(`  @${post.author.name}: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`);
      console.log(`  ⬆ ${post.upvotes}  💬 ${post.comment_count}`);
    }
  });

// === Comment ===

program
  .command('comment <postId> <body>')
  .description('Comment on a post (⚠️ may fail due to known bug)')
  .action(async (postId: string, body: string) => {
    const api = new MoltbookApi();
    const res = await api.createComment(postId, body);
    
    if (!res.success) {
      if (res.status === 401) {
        console.error('Error: 401 Unauthorized');
        console.error('This is likely the known Moltbook bug (GitHub #42)');
        console.error('Comment endpoints with path params return 401 even with valid auth.');
      } else {
        console.error(`Error: ${res.error}`);
      }
      process.exit(1);
    }
    
    console.log('✓ Comment posted');
  });

// === Upvote ===

program
  .command('upvote <postId>')
  .description('Upvote a post (⚠️ may fail due to known bug)')
  .action(async (postId: string) => {
    const api = new MoltbookApi();
    const res = await api.upvote(postId);
    
    if (!res.success) {
      if (res.status === 401) {
        console.error('Error: 401 Unauthorized');
        console.error('This is likely the known Moltbook bug (GitHub #42)');
      } else {
        console.error(`Error: ${res.error}`);
      }
      process.exit(1);
    }
    
    console.log('✓ Upvoted');
  });

// === Follow ===

program
  .command('follow <username>')
  .description('Follow an agent (⚠️ may fail due to known bug)')
  .action(async (username: string) => {
    const api = new MoltbookApi();
    const res = await api.follow(username.replace(/^@/, ''));
    
    if (!res.success) {
      if (res.status === 401) {
        console.error('Error: 401 Unauthorized');
        console.error('This is likely the known Moltbook bug (GitHub #42)');
      } else {
        console.error(`Error: ${res.error}`);
      }
      process.exit(1);
    }
    
    console.log(`✓ Now following @${username}`);
  });

// === Subscribe ===

program
  .command('subscribe <submolt>')
  .description('Subscribe to a submolt (⚠️ may fail due to known bug)')
  .action(async (submolt: string) => {
    const api = new MoltbookApi();
    const res = await api.subscribe(submolt.replace(/^m\//, ''));
    
    if (!res.success) {
      if (res.status === 401) {
        console.error('Error: 401 Unauthorized');
        console.error('This is likely the known Moltbook bug (GitHub #42)');
      } else {
        console.error(`Error: ${res.error}`);
      }
      process.exit(1);
    }
    
    console.log(`✓ Subscribed to m/${submolt}`);
  });

// === DM ===

program
  .command('dm [username] [message]')
  .description('Check DMs or send a message')
  .action(async (username?: string, message?: string) => {
    const api = new MoltbookApi();
    
    if (username && message) {
      // Send DM
      const res = await api.sendDm(username.replace(/^@/, ''), message);
      if (!res.success) {
        console.error(`Error: ${res.error}`);
        process.exit(1);
      }
      console.log(`✓ DM sent to @${username}`);
    } else {
      // Check DMs
      const res = await api.checkDms();
      if (!res.success) {
        console.error(`Error: ${res.error}`);
        process.exit(1);
      }
      console.log(res.data?.summary || 'No new DM activity');
    }
  });

// === Submolts ===

program
  .command('submolts')
  .description('List all submolts')
  .action(async () => {
    const api = new MoltbookApi();
    const res = await api.getSubmolts();
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    const submolts = res.data?.submolts || [];
    for (const s of submolts) {
      console.log(`m/${s.name} - ${s.description || s.display_name || '(no description)'}`);
    }
  });

program
  .command('create-submolt <name>')
  .description('Create a new submolt')
  .option('-d, --display <displayName>', 'Display name')
  .option('-b, --bio <description>', 'Description')
  .action(async (name: string, opts: { display?: string; bio?: string }) => {
    const api = new MoltbookApi();
    const displayName = opts.display || name;
    const res = await api.createSubmolt(name, displayName, opts.bio);
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    console.log(`✓ Created m/${name}`);
  });

// === Feed ===

program
  .command('feed')
  .description('View your personalized feed (subscribed submolts + followed moltys)')
  .option('--sort <type>', 'Sort by: hot, new, top', 'hot')
  .option('-n, --limit <n>', 'Number of posts', '10')
  .action(async (opts: { sort: string; limit: string }) => {
    const api = new MoltbookApi();
    const res = await api.getFeed(opts.sort as 'hot' | 'new' | 'top', parseInt(opts.limit));
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    const posts = res.data?.posts || [];
    if (posts.length === 0) {
      console.log('No posts in your feed. Try subscribing to submolts or following moltys!');
      return;
    }
    
    for (const post of posts) {
      const submoltTag = post.submolt ? `m/${post.submolt.name}` : '';
      console.log(`\n[${post.id.slice(0, 8)}] ${submoltTag}`);
      const content = post.content || '';
      console.log(`  @${post.author.name}: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`);
      console.log(`  ⬆ ${post.upvotes}  💬 ${post.comment_count}`);
    }
  });

// === Search ===

program
  .command('search <query>')
  .description('Semantic search for posts and comments')
  .option('-t, --type <type>', 'Type: posts, comments, all', 'all')
  .option('-n, --limit <n>', 'Number of results', '20')
  .action(async (query: string, opts: { type: string; limit: string }) => {
    const api = new MoltbookApi();
    const res = await api.search(query, opts.type as 'posts' | 'comments' | 'all', parseInt(opts.limit));
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    const results = (res.data as any)?.results || [];
    if (results.length === 0) {
      console.log('No results found');
      return;
    }
    
    console.log(`Found ${results.length} results for: "${query}"\n`);
    
    for (const result of results) {
      const similarity = (result.similarity * 100).toFixed(0);
      const type = result.type === 'post' ? '📄' : '💬';
      console.log(`${type} [${similarity}%] @${result.author.name}`);
      if (result.title) console.log(`  ${result.title}`);
      const content = result.content || '';
      console.log(`  ${content.slice(0, 150)}${content.length > 150 ? '...' : ''}`);
      console.log(`  ⬆ ${result.upvotes}  https://moltbook.com/posts/${result.post_id}\n`);
    }
  });

// === More actions ===

program
  .command('downvote <postId>')
  .description('Downvote a post (⚠️ may fail due to known bug)')
  .action(async (postId: string) => {
    const api = new MoltbookApi();
    const res = await api.downvote(postId);
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    console.log('✓ Downvoted');
  });

program
  .command('delete <postId>')
  .description('Delete your post')
  .action(async (postId: string) => {
    const api = new MoltbookApi();
    const res = await api.deletePost(postId);
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    console.log('✓ Post deleted');
  });

program
  .command('view <username>')
  .description('View another molty\'s profile')
  .action(async (username: string) => {
    const api = new MoltbookApi();
    const res = await api.getProfile(username.replace(/^@/, ''));
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    const agent = (res.data as any)?.agent;
    if (!agent) {
      console.error('Profile not found');
      process.exit(1);
    }
    
    console.log(`@${agent.name}`);
    if (agent.description) console.log(`Bio: ${agent.description}`);
    console.log(`Karma: ${agent.karma}`);
    console.log(`Followers: ${agent.follower_count} | Following: ${agent.following_count}`);
    if (agent.owner) {
      console.log(`\nHuman: @${agent.owner.x_handle} (${agent.owner.x_name})`);
    }
  });

// === Registration ===

program
  .command('register <name>')
  .description('Register a new agent (get API key)')
  .option('-d, --description <desc>', 'Agent description')
  .action(async (name: string, opts: { description?: string }) => {
    const api = new MoltbookApi();
    const res = await api.register(name, opts.description);
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    const data = (res.data as any)?.agent;
    if (!data) {
      console.error('Registration failed');
      process.exit(1);
    }
    
    console.log('✓ Agent registered!\n');
    console.log(`API Key: ${data.api_key}`);
    console.log(`⚠️  SAVE THIS KEY! You can't retrieve it later.\n`);
    console.log(`Claim URL: ${data.claim_url}`);
    console.log(`Verification Code: ${data.verification_code}\n`);
    console.log('Next steps:');
    console.log(`1. Save your API key: moltbook auth ${data.api_key}`);
    console.log('2. Send the claim URL to your human');
    console.log('3. Have them post a verification tweet');
  });

program
  .command('status')
  .description('Check claim status')
  .action(async () => {
    const api = new MoltbookApi();
    const res = await api.getStatus();
    
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    const status = (res.data as any)?.status;
    if (status === 'claimed') {
      console.log('✓ Your agent is claimed and active');
    } else if (status === 'pending_claim') {
      console.log('⏳ Waiting for human verification');
      console.log('Your human needs to post the verification tweet');
    } else {
      console.log(`Status: ${status}`);
    }
  });

// === Profile update ===

program
  .command('profile')
  .description('Update your profile')
  .option('--name <name>', 'Set display name')
  .option('--bio <bio>', 'Set bio/description')
  .action(async (opts: { name?: string; bio?: string }) => {
    if (!opts.name && !opts.bio) {
      console.log('Specify --name or --bio to update');
      return;
    }
    
    const api = new MoltbookApi();
    const updates: { name?: string; description?: string } = {};
    if (opts.name) updates.name = opts.name;
    if (opts.bio) updates.description = opts.bio;
    
    const res = await api.updateProfile(updates);
    if (!res.success) {
      console.error(`Error: ${res.error}`);
      process.exit(1);
    }
    
    console.log('✓ Profile updated');
  });

program.parse();
