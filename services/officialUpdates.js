import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import { getFromCache, setCache } from './database.js';

export class OfficialUpdatesService {
  
  // List of official sources to scrape
  static officialSources = [
    {
      name: 'FEMA',
      url: 'https://www.fema.gov/disasters',
      selector: '.disaster-declaration',
      type: 'government'
    },
    {
      name: 'Red Cross',
      url: 'https://www.redcross.org/get-help/disaster-relief-and-recovery-services',
      selector: '.emergency-update',
      type: 'relief_organization'
    },
    {
      name: 'NYC Emergency Management',
      url: 'https://www1.nyc.gov/site/em/index.page',
      selector: '.emergency-alert',
      type: 'local_government'
    }
  ];

  // Mock official updates for demonstration
  static getMockOfficialUpdates(disasterId) {
    return [
      {
        id: 'fema_001',
        source: 'FEMA',
        title: 'Major Disaster Declaration for New York Flooding',
        content: 'President Biden has approved a Major Disaster Declaration for New York State due to severe flooding. Federal assistance is now available to affected individuals and communities.',
        url: 'https://www.fema.gov/disaster/4673',
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        type: 'government',
        priority: 'high',
        tags: ['federal_aid', 'disaster_declaration', 'flooding']
      },
      {
        id: 'redcross_001',
        source: 'American Red Cross',
        title: 'Emergency Shelters Open in NYC Area',
        content: 'The Red Cross has opened multiple emergency shelters across New York City to provide safe haven for those displaced by flooding. Locations include Madison Square Garden, Jacob Javits Center, and Brooklyn Armory.',
        url: 'https://www.redcross.org/local/new-york/greater-new-york',
        published_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 90 minutes ago
        type: 'relief_organization',
        priority: 'high',
        tags: ['shelter', 'evacuation', 'emergency_services']
      },
      {
        id: 'nyc_em_001',
        source: 'NYC Emergency Management',
        title: 'Flash Flood Warning Extended Until 8 PM',
        content: 'Flash flood warning for all five boroughs extended until 8:00 PM today. Residents are advised to avoid unnecessary travel and stay indoors. Emergency services are responding to multiple water rescue situations.',
        url: 'https://www1.nyc.gov/site/em/index.page',
        published_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        type: 'local_government',
        priority: 'critical',
        tags: ['flood_warning', 'travel_advisory', 'emergency_response']
      },
      {
        id: 'fema_002',
        source: 'FEMA',
        title: 'Individual Assistance Program Activated',
        content: 'FEMA\'s Individual Assistance program is now available for New York residents affected by flooding. This includes assistance for temporary housing, home repairs, and other disaster-related expenses.',
        url: 'https://www.fema.gov/assistance/individual',
        published_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
        type: 'government',
        priority: 'medium',
        tags: ['individual_assistance', 'financial_aid', 'housing_assistance']
      },
      {
        id: 'salvation_army_001',
        source: 'Salvation Army',
        title: 'Mobile Emergency Response Units Deployed',
        content: 'Salvation Army has deployed mobile emergency response units throughout the affected areas, providing hot meals, hydration, and emotional support to first responders and residents.',
        url: 'https://www.salvationarmyusa.org/usn/disaster-relief/',
        published_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        type: 'relief_organization',
        priority: 'medium',
        tags: ['mobile_services', 'food_assistance', 'emotional_support']
      }
    ];
  }

  // Fetch official updates for a disaster
  static async fetchOfficialUpdates(disasterId, sources = []) {
    const cacheKey = `official_updates_${disasterId}_${sources.join('_')}`;
    
    try {
      // Check cache first
      const cached = await getFromCache(cacheKey);
      if (cached) {
        logger.info('Official updates cache hit');
        return cached;
      }

      // For demonstration, return mock data
      // In a real implementation, this would scrape the official websites
      const mockUpdates = this.getMockOfficialUpdates(disasterId);
      
      // Filter by sources if specified
      const filteredUpdates = sources.length > 0 
        ? mockUpdates.filter(update => sources.includes(update.source.toLowerCase().replace(/\s+/g, '_')))
        : mockUpdates;

      // Sort by priority and timestamp
      const sortedUpdates = filteredUpdates.sort((a, b) => {
        const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return new Date(b.published_at) - new Date(a.published_at);
      });

      const result = {
        disaster_id: disasterId,
        sources_requested: sources,
        updates: sortedUpdates,
        total_updates: sortedUpdates.length,
        critical_updates: sortedUpdates.filter(u => u.priority === 'critical').length,
        last_updated: new Date().toISOString(),
        provider: 'mock_scraper'
      };

      // Cache the result for 10 minutes
      await setCache(cacheKey, result, 600);

      logger.info(`Fetched ${result.total_updates} official updates for disaster ${disasterId}`);
      return result;

    } catch (error) {
      logger.error('Official updates fetch error:', error);
      return {
        disaster_id: disasterId,
        sources_requested: sources,
        updates: [],
        total_updates: 0,
        critical_updates: 0,
        last_updated: new Date().toISOString(),
        error: error.message,
        provider: 'mock_scraper'
      };
    }
  }

  // Scrape a single official source (real implementation)
  static async scrapeOfficialSource(source) {
    const cacheKey = `scrape_${source.name.toLowerCase().replace(/\s+/g, '_')}`;
    
    try {
      // Check cache first
      const cached = await getFromCache(cacheKey);
      if (cached) {
        logger.info(`Official source cache hit: ${source.name}`);
        return cached;
      }

      // Make HTTP request with proper headers
      const response = await axios.get(source.url, {
        headers: {
          'User-Agent': 'DisasterResponsePlatform/1.0 (Emergency Information Aggregator)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000 // 10 second timeout
      });

      const $ = cheerio.load(response.data);
      const updates = [];

      // Extract updates based on selector
      $(source.selector).each((i, element) => {
        const $el = $(element);
        const update = {
          id: `${source.name.toLowerCase()}_${Date.now()}_${i}`,
          source: source.name,
          title: $el.find('h1, h2, h3, .title').first().text().trim(),
          content: $el.find('p, .content, .description').first().text().trim(),
          url: source.url,
          published_at: new Date().toISOString(), // Would extract actual date in real implementation
          type: source.type,
          priority: 'medium',
          tags: []
        };

        if (update.title && update.content) {
          updates.push(update);
        }
      });

      const result = {
        source: source.name,
        url: source.url,
        updates,
        scraped_at: new Date().toISOString()
      };

      // Cache for 15 minutes
      await setCache(cacheKey, result, 900);

      logger.info(`Scraped ${updates.length} updates from ${source.name}`);
      return result;

    } catch (error) {
      logger.error(`Scraping error for ${source.name}:`, error);
      return {
        source: source.name,
        url: source.url,
        updates: [],
        error: error.message,
        scraped_at: new Date().toISOString()
      };
    }
  }

  // Scrape all official sources
  static async scrapeAllOfficialSources() {
    try {
      const scrapePromises = this.officialSources.map(source => 
        this.scrapeOfficialSource(source)
      );

      const results = await Promise.allSettled(scrapePromises);
      const allUpdates = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allUpdates.push(...result.value.updates);
        } else {
          logger.error(`Failed to scrape ${this.officialSources[index].name}:`, result.reason);
        }
      });

      logger.info(`Scraped total of ${allUpdates.length} updates from all sources`);
      return allUpdates;

    } catch (error) {
      logger.error('Error scraping all official sources:', error);
      return [];
    }
  }

  // Get updates by priority level
  static filterUpdatesByPriority(updates, minPriority = 'medium') {
    const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    const minLevel = priorityOrder[minPriority] || 1;
    
    return updates.filter(update => 
      priorityOrder[update.priority] >= minLevel
    );
  }

  // Get updates by source type
  static filterUpdatesByType(updates, types = []) {
    if (types.length === 0) return updates;
    
    return updates.filter(update => 
      types.includes(update.type)
    );
  }

  // Extract key information from update content
  static extractKeyInformation(content) {
    const keyInfo = {
      locations: [],
      contacts: [],
      resources: [],
      deadlines: [],
      actions: []
    };

    // Extract locations (simplified pattern matching)
    const locationPattern = /\b([A-Z][a-z]+ [A-Z][a-z]+(?:, [A-Z]{2})?)\b/g;
    const locationMatches = content.match(locationPattern);
    if (locationMatches) {
      keyInfo.locations = [...new Set(locationMatches)];
    }

    // Extract phone numbers
    const phonePattern = /\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b/g;
    const phoneMatches = content.match(phonePattern);
    if (phoneMatches) {
      keyInfo.contacts = [...new Set(phoneMatches)];
    }

    // Extract URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urlMatches = content.match(urlPattern);
    if (urlMatches) {
      keyInfo.resources = [...new Set(urlMatches)];
    }

    // Extract time-sensitive information
    const timePattern = /\b(?:until|by|before)\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/gi;
    const timeMatches = content.match(timePattern);
    if (timeMatches) {
      keyInfo.deadlines = [...new Set(timeMatches)];
    }

    return keyInfo;
  }
}
