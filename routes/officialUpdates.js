import express from 'express';
import { OfficialUpdatesService } from '../services/officialUpdates.js';
import { logger, logAction } from '../utils/logger.js';

const router = express.Router();

// GET /api/official-updates/:disaster_id - Get official updates for a disaster
router.get('/:disaster_id', async (req, res) => {
  try {
    const { disaster_id } = req.params;
    const { sources, priority, type, limit = 20, offset = 0 } = req.query;

    // Parse sources filter
    const sourcesList = sources ? sources.split(',').map(s => s.trim().toLowerCase()) : [];

    // Fetch official updates
    const updatesData = await OfficialUpdatesService.fetchOfficialUpdates(
      disaster_id, 
      sourcesList
    );

    // Filter by priority if specified
    let filteredUpdates = updatesData.updates;
    if (priority) {
      filteredUpdates = OfficialUpdatesService.filterUpdatesByPriority(
        filteredUpdates, 
        priority
      );
    }

    // Filter by type if specified
    if (type) {
      const typesList = type.split(',').map(t => t.trim());
      filteredUpdates = OfficialUpdatesService.filterUpdatesByType(
        filteredUpdates, 
        typesList
      );
    }

    // Apply pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedUpdates = filteredUpdates.slice(startIndex, endIndex);

    logAction('official_updates_fetched', { 
      disaster_id, 
      sources: sourcesList, 
      total_updates: updatesData.total_updates,
      critical_updates: updatesData.critical_updates,
      filtered_count: filteredUpdates.length
    });

    res.json({
      disaster_id,
      updates: paginatedUpdates,
      pagination: {
        total: filteredUpdates.length,
        offset: startIndex,
        limit: parseInt(limit),
        has_more: endIndex < filteredUpdates.length
      },
      summary: {
        total_updates: updatesData.total_updates,
        critical_updates: updatesData.critical_updates,
        filtered_updates: filteredUpdates.length
      },
      filters: {
        sources: sourcesList,
        priority,
        type: type ? type.split(',') : null
      },
      last_updated: updatesData.last_updated,
      provider: updatesData.provider
    });

  } catch (error) {
    logger.error('Error fetching official updates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/official-updates/:disaster_id/critical - Get critical official updates
router.get('/:disaster_id/critical', async (req, res) => {
  try {
    const { disaster_id } = req.params;
    const { limit = 10 } = req.query;

    const updatesData = await OfficialUpdatesService.fetchOfficialUpdates(disaster_id);
    const criticalUpdates = OfficialUpdatesService.filterUpdatesByPriority(
      updatesData.updates, 
      'critical'
    );

    // Limit results
    const limitedUpdates = criticalUpdates.slice(0, parseInt(limit));

    logAction('critical_official_updates_fetched', { 
      disaster_id, 
      critical_updates_count: criticalUpdates.length 
    });

    res.json({
      disaster_id,
      critical_updates: limitedUpdates,
      total_critical: criticalUpdates.length,
      total_updates: updatesData.total_updates,
      last_updated: updatesData.last_updated
    });

  } catch (error) {
    logger.error('Error fetching critical official updates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/official-updates/:disaster_id/sources - Get updates by source type
router.get('/:disaster_id/sources/:source_type', async (req, res) => {
  try {
    const { disaster_id, source_type } = req.params;
    const { limit = 20 } = req.query;

    const updatesData = await OfficialUpdatesService.fetchOfficialUpdates(disaster_id);
    const sourceUpdates = OfficialUpdatesService.filterUpdatesByType(
      updatesData.updates, 
      [source_type]
    );

    // Limit results
    const limitedUpdates = sourceUpdates.slice(0, parseInt(limit));

    logAction('official_updates_by_source_fetched', { 
      disaster_id, 
      source_type,
      source_updates_count: sourceUpdates.length 
    });

    res.json({
      disaster_id,
      source_type,
      updates: limitedUpdates,
      total_from_source: sourceUpdates.length,
      total_updates: updatesData.total_updates,
      last_updated: updatesData.last_updated
    });

  } catch (error) {
    logger.error('Error fetching official updates by source:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/official-updates/sources - Get available official sources
router.get('/sources', async (req, res) => {
  try {
    const sources = OfficialUpdatesService.officialSources.map(source => ({
      name: source.name,
      url: source.url,
      type: source.type,
      description: `Official updates from ${source.name}`
    }));

    res.json({
      sources,
      total_sources: sources.length,
      types: [...new Set(sources.map(s => s.type))]
    });

  } catch (error) {
    logger.error('Error fetching official sources:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/official-updates/:disaster_id/scrape - Manually trigger scraping
router.post('/:disaster_id/scrape', async (req, res) => {
  try {
    const { disaster_id } = req.params;
    const { sources } = req.body;

    // Validate disaster exists (in a real app)
    if (!disaster_id) {
      return res.status(400).json({ error: 'disaster_id is required' });
    }

    let scrapeResults;
    
    if (sources && Array.isArray(sources)) {
      // Scrape specific sources
      const scrapePromises = sources.map(sourceName => {
        const source = OfficialUpdatesService.officialSources.find(
          s => s.name.toLowerCase() === sourceName.toLowerCase()
        );
        
        if (!source) {
          return Promise.resolve({
            source: sourceName,
            error: 'Source not found',
            updates: []
          });
        }
        
        return OfficialUpdatesService.scrapeOfficialSource(source);
      });

      scrapeResults = await Promise.all(scrapePromises);
    } else {
      // Scrape all sources
      const allUpdates = await OfficialUpdatesService.scrapeAllOfficialSources();
      scrapeResults = [{
        source: 'all',
        updates: allUpdates,
        scraped_at: new Date().toISOString()
      }];
    }

    const totalUpdates = scrapeResults.reduce((sum, result) => 
      sum + (result.updates ? result.updates.length : 0), 0
    );

    logAction('official_updates_scraped', { 
      disaster_id, 
      sources: sources || 'all',
      total_updates: totalUpdates
    });

    res.json({
      disaster_id,
      scrape_results: scrapeResults,
      total_updates: totalUpdates,
      scraped_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error manually scraping official updates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/official-updates/:disaster_id/analyze - Analyze update content
router.post('/:disaster_id/analyze', async (req, res) => {
  try {
    const { disaster_id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required for analysis' });
    }

    // Extract key information from the update
    const keyInfo = OfficialUpdatesService.extractKeyInformation(content);

    logAction('official_update_analyzed', { 
      disaster_id, 
      content_length: content.length,
      locations_found: keyInfo.locations.length,
      contacts_found: keyInfo.contacts.length
    });

    res.json({
      disaster_id,
      content,
      key_information: keyInfo,
      analysis_timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error analyzing official update content:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/official-updates/:disaster_id/timeline - Get updates timeline
router.get('/:disaster_id/timeline', async (req, res) => {
  try {
    const { disaster_id } = req.params;
    const { hours = 24 } = req.query;

    const updatesData = await OfficialUpdatesService.fetchOfficialUpdates(disaster_id);
    
    // Filter updates by time range
    const hoursAgo = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const recentUpdates = updatesData.updates.filter(update => 
      new Date(update.published_at) > hoursAgo
    );

    // Group by hour
    const timeline = {};
    recentUpdates.forEach(update => {
      const hour = new Date(update.published_at).toISOString().slice(0, 13) + ':00';
      if (!timeline[hour]) {
        timeline[hour] = [];
      }
      timeline[hour].push(update);
    });

    logAction('official_updates_timeline_fetched', { 
      disaster_id, 
      hours: parseInt(hours),
      updates_in_period: recentUpdates.length
    });

    res.json({
      disaster_id,
      time_range_hours: parseInt(hours),
      timeline,
      total_updates_in_period: recentUpdates.length,
      timeline_points: Object.keys(timeline).length,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching official updates timeline:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
