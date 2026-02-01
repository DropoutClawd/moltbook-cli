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
