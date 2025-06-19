import express from 'express';
import { SocialMediaService } from '../services/socialMedia.js';
import { logger, logAction } from '../utils/logger.js';

const router = express.Router();

// GET /api/social-media/:disaster_id - Get social media reports for a disaster
router.get('/:disaster_id', async (req, res) => {
  try {
    const { disaster_id } = req.params;
    const { keywords, priority, limit = 20, offset = 0 } = req.query;

    // Parse keywords
    const keywordArray = keywords ? keywords.split(',').map(k => k.trim()) : 
                        ['flood', 'emergency', 'help', 'disaster', 'relief'];

    // Fetch social media data
    const socialMediaData = await SocialMediaService.fetchSocialMediaReports(
      disaster_id, 
      keywordArray
    );

    // Filter by priority if specified
    let filteredPosts = socialMediaData.posts;
    if (priority) {
      const minPriority = parseInt(priority);
      filteredPosts = SocialMediaService.filterPostsByPriority(filteredPosts, minPriority);
    }

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

    logAction('social_media_fetched', { 
      disaster_id, 
      keywords: keywordArray, 
      total_posts: socialMediaData.total_posts,
      high_priority_posts: socialMediaData.high_priority_posts,
      filtered_count: filteredPosts.length
    });

    res.json({
      disaster_id,
      keywords: keywordArray,
      posts: paginatedPosts,
      pagination: {
        total: filteredPosts.length,
        offset: startIndex,
        limit: parseInt(limit),
        has_more: endIndex < filteredPosts.length
      },
      summary: {
        total_posts: socialMediaData.total_posts,
        high_priority_posts: socialMediaData.high_priority_posts,
        filtered_posts: filteredPosts.length
      },
      last_updated: socialMediaData.last_updated,
      provider: socialMediaData.provider
    });

  } catch (error) {
    logger.error('Error fetching social media data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social-media/:disaster_id/stream - Start streaming social media updates
router.get('/:disaster_id/stream', async (req, res) => {
  try {
    const { disaster_id } = req.params;

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ 
      type: 'connection', 
      message: 'Social media stream connected',
      disaster_id,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Set up periodic updates
    const sendUpdate = async () => {
      try {
        const socialMediaData = await SocialMediaService.fetchSocialMediaReports(disaster_id);
        const highPriorityPosts = SocialMediaService.filterPostsByPriority(socialMediaData.posts, 7);
        
        res.write(`data: ${JSON.stringify({
          type: 'update',
          disaster_id,
          high_priority_posts: highPriorityPosts,
          total_posts: socialMediaData.total_posts,
          timestamp: new Date().toISOString()
        })}\n\n`);
      } catch (error) {
        logger.error('Error in social media stream update:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Error fetching social media updates',
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    };

    // Send updates every 30 seconds
    const intervalId = setInterval(sendUpdate, 30000);

    // Clean up on connection close
    req.on('close', () => {
      clearInterval(intervalId);
      logger.info(`Social media stream closed for disaster ${disaster_id}`);
    });

    logAction('social_media_stream_started', { disaster_id });

  } catch (error) {
    logger.error('Error setting up social media stream:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social-media/:disaster_id/priority - Get high priority social media posts
router.get('/:disaster_id/priority', async (req, res) => {
  try {
    const { disaster_id } = req.params;
    const { min_priority = 7, limit = 10 } = req.query;

    const socialMediaData = await SocialMediaService.fetchSocialMediaReports(disaster_id);
    const priorityPosts = SocialMediaService.filterPostsByPriority(
      socialMediaData.posts, 
      parseInt(min_priority)
    );

    // Limit results
    const limitedPosts = priorityPosts.slice(0, parseInt(limit));

    logAction('priority_social_media_fetched', { 
      disaster_id, 
      min_priority: parseInt(min_priority),
      priority_posts_count: priorityPosts.length 
    });

    res.json({
      disaster_id,
      min_priority: parseInt(min_priority),
      priority_posts: limitedPosts,
      total_priority_posts: priorityPosts.length,
      total_posts: socialMediaData.total_posts,
      last_updated: socialMediaData.last_updated
    });

  } catch (error) {
    logger.error('Error fetching priority social media posts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social-media/mock - Get mock social media data for testing
router.get('/mock', async (req, res) => {
  try {
    const { keywords } = req.query;
    const keywordArray = keywords ? keywords.split(',').map(k => k.trim()) : [];

    const mockData = SocialMediaService.getMockSocialMediaData(null, keywordArray);

    logAction('mock_social_media_fetched', { 
      keywords: keywordArray, 
      posts_count: mockData.length 
    });

    res.json({
      provider: 'mock_twitter',
      keywords: keywordArray,
      posts: mockData,
      total_posts: mockData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching mock social media data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/social-media/:disaster_id/analyze - Analyze social media content with AI
router.post('/:disaster_id/analyze', async (req, res) => {
  try {
    const { disaster_id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required for analysis' });
    }

    // Analyze the content using Gemini AI
    const { GeminiService } = await import('../services/gemini.js');
    const analysis = await GeminiService.analyzeSocialMediaContent(content);

    // Calculate priority score
    const priority = SocialMediaService.calculatePriority(
      { content, engagement: { likes: 0, retweets: 0, replies: 0 } },
      analysis
    );

    logAction('social_media_content_analyzed', { 
      disaster_id, 
      content_preview: content.substring(0, 100),
      relevance: analysis.relevance,
      urgency: analysis.urgency,
      priority
    });

    res.json({
      disaster_id,
      content,
      analysis: {
        ...analysis,
        priority
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error analyzing social media content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/social-media/:disaster_id/locations - Extract location mentions from social media
router.get('/:disaster_id/locations', async (req, res) => {
  try {
    const { disaster_id } = req.params;

    const socialMediaData = await SocialMediaService.fetchSocialMediaReports(disaster_id);
    const allLocations = [];

    // Extract locations from all posts
    socialMediaData.posts.forEach(post => {
      const locations = SocialMediaService.extractLocationMentions(post.content);
      allLocations.push(...locations);
    });

    // Count frequency of location mentions
    const locationCounts = {};
    allLocations.forEach(location => {
      locationCounts[location] = (locationCounts[location] || 0) + 1;
    });

    // Sort by frequency
    const sortedLocations = Object.entries(locationCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([location, count]) => ({ location, mentions: count }));

    logAction('social_media_locations_extracted', { 
      disaster_id, 
      unique_locations: sortedLocations.length,
      total_mentions: allLocations.length
    });

    res.json({
      disaster_id,
      locations: sortedLocations,
      total_mentions: allLocations.length,
      unique_locations: sortedLocations.length,
      analyzed_posts: socialMediaData.posts.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error extracting social media locations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
