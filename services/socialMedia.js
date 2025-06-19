import axios from 'axios';
import { logger } from '../utils/logger.js';
import { getFromCache, setCache } from './database.js';
import { GeminiService } from './gemini.js';

export class SocialMediaService {
  
  // Mock Twitter API data for demonstration
  static getMockSocialMediaData(disasterId, keywords = []) {
    const mockPosts = [
      {
        id: 'mock_1',
        user: 'citizen1',
        username: '@concerned_citizen',
        content: '#floodrelief Need food and water in Lower East Side NYC. Families stranded on 2nd floor.',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        location: 'Lower East Side, NYC',
        media: ['http://example.com/flood1.jpg'],
        engagement: { likes: 15, retweets: 8, replies: 3 }
      },
      {
        id: 'mock_2',
        user: 'volunteer_helper',
        username: '@volunteer_nyc',
        content: 'Offering shelter for displaced families in Manhattan. Have space for 6 people. DM me #disasterrelief',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
        location: 'Manhattan, NYC',
        media: [],
        engagement: { likes: 25, retweets: 12, replies: 7 }
      },
      {
        id: 'mock_3',
        user: 'news_reporter',
        username: '@breaking_news',
        content: 'URGENT: Brooklyn Bridge closed due to flooding. Avoid the area. Emergency services on scene #NYCFlood',
        timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 minutes ago
        location: 'Brooklyn Bridge, NYC',
        media: ['http://example.com/bridge_flood.jpg'],
        engagement: { likes: 87, retweets: 45, replies: 12 }
      },
      {
        id: 'mock_4',
        user: 'local_resident',
        username: '@queens_local',
        content: 'Water levels rising fast in Queens. Need evacuation help for elderly neighbors. #SOS #FloodEmergency',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        location: 'Queens, NYC',
        media: [],
        engagement: { likes: 42, retweets: 28, replies: 15 }
      },
      {
        id: 'mock_5',
        user: 'red_cross_ny',
        username: '@redcross_ny',
        content: 'Emergency shelter open at Madison Square Garden. Food, water, and medical aid available. #DisasterRelief',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        location: 'Madison Square Garden, NYC',
        media: ['http://example.com/shelter.jpg'],
        engagement: { likes: 156, retweets: 89, replies: 23 }
      }
    ];

    // Filter by keywords if provided
    if (keywords.length > 0) {
      return mockPosts.filter(post => 
        keywords.some(keyword => 
          post.content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    return mockPosts;
  }

  // Fetch social media data (mock implementation)
  static async fetchSocialMediaReports(disasterId, keywords = ['flood', 'emergency', 'help', 'disaster']) {
    const cacheKey = `social_media_${disasterId}_${keywords.join('_')}`;
    
    try {
      // Check cache first
      const cached = await getFromCache(cacheKey);
      if (cached) {
        logger.info('Social media data cache hit');
        return cached;
      }

      // Get mock data (in a real implementation, this would call Twitter API, Bluesky, etc.)
      const rawPosts = this.getMockSocialMediaData(disasterId, keywords);
      
      // Analyze each post with Gemini AI
      const analyzedPosts = await Promise.all(
        rawPosts.map(async (post) => {
          const analysis = await GeminiService.analyzeSocialMediaContent(post.content);
          return {
            ...post,
            analysis,
            priority: this.calculatePriority(post, analysis),
            disaster_id: disasterId
          };
        })
      );

      // Sort by priority and timestamp
      const sortedPosts = analyzedPosts.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return new Date(b.timestamp) - new Date(a.timestamp); // Newer first
      });

      const result = {
        disaster_id: disasterId,
        keywords,
        posts: sortedPosts,
        total_posts: sortedPosts.length,
        high_priority_posts: sortedPosts.filter(p => p.priority >= 8).length,
        last_updated: new Date().toISOString(),
        provider: 'mock_twitter'
      };

      // Cache the result for 5 minutes (social media data changes quickly)
      await setCache(cacheKey, result, 300);

      logger.info(`Fetched ${result.total_posts} social media posts for disaster ${disasterId}`);
      return result;

    } catch (error) {
      logger.error('Social media fetch error:', error);
      return {
        disaster_id: disasterId,
        keywords,
        posts: [],
        total_posts: 0,
        high_priority_posts: 0,
        last_updated: new Date().toISOString(),
        error: error.message,
        provider: 'mock_twitter'
      };
    }
  }

  // Calculate priority score for social media posts
  static calculatePriority(post, analysis) {
    let priority = 5; // Base priority

    // Urgency level
    switch (analysis.urgency) {
      case 'critical': priority += 4; break;
      case 'high': priority += 3; break;
      case 'medium': priority += 2; break;
      case 'low': priority += 1; break;
    }

    // Content type
    if (analysis.contentType === 'help_request') priority += 2;
    if (analysis.contentType === 'emergency_alert') priority += 3;

    // Keywords
    const urgentKeywords = ['SOS', 'urgent', 'emergency', 'help', 'rescue', 'trapped'];
    const urgentMatches = urgentKeywords.filter(keyword => 
      post.content.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    priority += urgentMatches;

    // Engagement (higher engagement might indicate importance)
    const totalEngagement = post.engagement.likes + post.engagement.retweets + post.engagement.replies;
    if (totalEngagement > 50) priority += 1;
    if (totalEngagement > 100) priority += 1;

    // Cap at 10
    return Math.min(priority, 10);
  }

  // Stream social media updates (simulation)
  static async streamSocialMediaUpdates(disasterId, callback) {
    logger.info(`Starting social media stream for disaster ${disasterId}`);
    
    // Simulate periodic updates
    const interval = setInterval(async () => {
      try {
        const updates = await this.fetchSocialMediaReports(disasterId);
        callback(updates);
      } catch (error) {
        logger.error('Social media stream error:', error);
      }
    }, 30000); // Update every 30 seconds

    // Return cleanup function
    return () => {
      clearInterval(interval);
      logger.info(`Stopped social media stream for disaster ${disasterId}`);
    };
  }

  // Real Twitter API implementation (placeholder)
  static async fetchFromTwitterAPI(keywords, maxResults = 10) {
    try {
      // This would require Twitter API v2 Bearer Token
      // const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
      //   headers: {
      //     'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
      //   },
      //   params: {
      //     query: keywords.map(k => `#${k} OR ${k}`).join(' OR '),
      //     max_results: maxResults,
      //     'tweet.fields': 'created_at,author_id,public_metrics,geo',
      //     'user.fields': 'username,name,location'
      //   }
      // });

      logger.warn('Twitter API not implemented - using mock data');
      return this.getMockSocialMediaData(null, keywords);

    } catch (error) {
      logger.error('Twitter API error:', error);
      return [];
    }
  }

  // Bluesky API implementation (placeholder)
  static async fetchFromBlueskyAPI(keywords) {
    try {
      // This would implement Bluesky API calls
      logger.warn('Bluesky API not implemented - using mock data');
      return this.getMockSocialMediaData(null, keywords);

    } catch (error) {
      logger.error('Bluesky API error:', error);
      return [];
    }
  }

  // Filter posts by priority level
  static filterPostsByPriority(posts, minPriority = 7) {
    return posts.filter(post => post.priority >= minPriority);
  }

  // Extract location mentions from social media content
  static extractLocationMentions(content) {
    // Simple regex patterns for common location formats
    const patterns = [
      /\b([A-Z][a-z]+ [A-Z][a-z]+, [A-Z]{2})\b/g, // "City State, NY"
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, // "New York"
      /#([A-Za-z]+(?:[A-Z][a-z]*)*)/g // Hashtags that might be locations
    ];

    const locations = [];
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        locations.push(...matches);
      }
    });

    return [...new Set(locations)]; // Remove duplicates
  }
}
