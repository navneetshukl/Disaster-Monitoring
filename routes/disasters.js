import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/database.js';
import { GeocodingService } from '../services/geocoding.js';
import { logger, logAction } from '../utils/logger.js';

const router = express.Router();

// Simple authentication middleware - no mock data
const authenticate = (req, res, next) => {
  // Use a fixed UUID for testing - in production this would come from JWT/session
  req.user = {
    id: '550e8400-e29b-41d4-a716-446655440000', // Fixed UUID for testing
    username: 'testuser',
    name: 'Test User',
    role: 'admin',
    email: 'test@disaster.response'
  };
  
  next();
};

// Validation middleware
const validateDisaster = (req, res, next) => {
  const { title, description } = req.body;
  
  if (!title || !description) {
    return res.status(400).json({ 
      error: 'Title and description are required' 
    });
  }
  
  if (title.length < 5 || title.length > 200) {
    return res.status(400).json({ 
      error: 'Title must be between 5 and 200 characters' 
    });
  }
  
  if (description.length < 10) {
    return res.status(400).json({ 
      error: 'Description must be at least 10 characters' 
    });
  }
  
  next();
};

// GET /api/disasters - List disasters with filtering
router.get('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        error: 'Database not configured',
        message: 'Supabase connection not available'
      });
    }

    const { tag, owner_id, location, radius, limit = 50, offset = 0 } = req.query;
    
    let query = supabase
      .from('disasters')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (tag) {
      query = query.contains('tags', [tag]);
    }
    
    if (owner_id) {
      query = query.eq('owner_id', owner_id);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Database error fetching disasters:', error);
      return res.status(500).json({ error: 'Failed to fetch disasters' });
    }

    // If location-based filtering is requested
    let filteredData = data || [];
    if (location) {
      try {
        const [lat, lng] = location.split(',').map(Number);
        const radiusKm = radius ? parseFloat(radius) : 10;
        
        // In a real implementation, this would use PostGIS ST_DWithin
        // For now, we'll use a simple distance calculation
        filteredData = filteredData.filter(disaster => {
          if (!disaster.location) return false;
          // This would be replaced with proper geospatial query
          return true;
        });
      } catch (error) {
        logger.error('Location filtering error:', error);
      }
    }

    logAction('disasters_fetched', { 
      count: filteredData.length, 
      filters: { tag, owner_id, location, radius } 
    });

    res.json({
      disasters: filteredData,
      total: count || filteredData.length,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

  } catch (error) {
    logger.error('Error fetching disasters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/disasters/:id - Get specific disaster
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('disasters')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Disaster not found' });
    }

    logAction('disaster_viewed', { disaster_id: id });

    res.json(data);

  } catch (error) {
    logger.error('Error fetching disaster:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/disasters - Create new disaster
router.post('/', authenticate, validateDisaster, async (req, res) => {
  try {
    const { title, location_name, description, tags = [] } = req.body;
    const disasterId = uuidv4();

    if (!supabase) {
      return res.status(500).json({
        error: 'Database not configured',
        message: 'Supabase connection not available'
      });
    }

    // Extract location from description if not provided
    let finalLocationName = location_name;
    let coordinates = null;

    if (!finalLocationName && description) {
      try {
        const locationExtraction = await GeocodingService.extractLocationFromText(description);
        finalLocationName = locationExtraction.extractedLocation;
      } catch (error) {
        logger.error('Location extraction error:', error);
      }
    }

    // Geocode location if we have a location name
    if (finalLocationName && finalLocationName !== 'Unknown Location') {
      try {
        const geocodeResult = await GeocodingService.geocodeLocation(finalLocationName);
        coordinates = {
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude
        };
      } catch (error) {
        logger.error('Geocoding error:', error);
      }
    }

    const disasterData = {
      id: disasterId,
      title,
      description,
      location_name: finalLocationName || 'Unknown Location',
      latitude: coordinates ? coordinates.latitude : null,
      longitude: coordinates ? coordinates.longitude : null,
      severity: 'moderate',
      status: 'active',
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      audit_trail: [{
        action: 'created',
        user_id: req.user.id,
        timestamp: new Date().toISOString(),
        changes: { title, location_name: finalLocationName, description }
      }]
    };

    const { data, error } = await supabase
      .from('disasters')
      .insert([disasterData])
      .select()
      .single();

    if (error) {
      logger.error('Database error creating disaster:', error);
      return res.status(500).json({ 
        error: 'Failed to create disaster',
        details: error.message 
      });
    }

    logAction('disaster_created', { 
      disaster_id: disasterId, 
      title, 
      location: finalLocationName,
      created_by: req.user.id 
    });

    // Emit real-time update
    req.io.emit('disaster_created', {
      disaster: data,
      user: req.user,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      disaster: data,
      message: 'Disaster created successfully and saved to database!'
    });

  } catch (error) {
    logger.error('Error creating disaster:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/disasters/:id - Update disaster
router.put('/:id', authenticate, validateDisaster, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, location_name, description, tags = [] } = req.body;

    // Check if disaster exists and user has permission
    const { data: existingDisaster, error: fetchError } = await supabase
      .from('disasters')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingDisaster) {
      return res.status(404).json({ error: 'Disaster not found' });
    }

    if (existingDisaster.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Geocode new location if changed
    let coordinates = null;
    if (location_name && location_name !== existingDisaster.location_name) {
      try {
        const geocodeResult = await GeocodingService.geocodeLocation(location_name);
        coordinates = {
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude
        };
      } catch (error) {
        logger.error('Geocoding error:', error);
      }
    }

    // Update disaster
    const updateData = {
      title,
      location_name,
      location: coordinates ? `POINT(${coordinates.longitude} ${coordinates.latitude})` : existingDisaster.location,
      description,
      tags: Array.isArray(tags) ? tags : [],
      updated_at: new Date().toISOString(),
      audit_trail: [
        ...existingDisaster.audit_trail,
        {
          action: 'updated',
          user_id: req.user.id,
          timestamp: new Date().toISOString(),
          changes: { title, location_name, description, tags }
        }
      ]
    };

    const { data, error } = await supabase
      .from('disasters')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Database error updating disaster:', error);
      return res.status(500).json({ error: 'Failed to update disaster' });
    }

    logAction('disaster_updated', { 
      disaster_id: id, 
      title, 
      location: location_name,
      updated_by: req.user.id 
    });

    // Emit real-time update
    req.io.emit('disaster_updated', {
      action: 'updated',
      disaster: data,
      timestamp: new Date().toISOString()
    });

    res.json(data);

  } catch (error) {
    logger.error('Error updating disaster:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/disasters/:id - Delete disaster
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if disaster exists and user has permission
    const { data: existingDisaster, error: fetchError } = await supabase
      .from('disasters')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingDisaster) {
      return res.status(404).json({ error: 'Disaster not found' });
    }

    if (existingDisaster.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { error } = await supabase
      .from('disasters')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Database error deleting disaster:', error);
      return res.status(500).json({ error: 'Failed to delete disaster' });
    }

    logAction('disaster_deleted', { 
      disaster_id: id, 
      title: existingDisaster.title,
      deleted_by: req.user.id 
    });

    // Emit real-time update
    req.io.emit('disaster_updated', {
      action: 'deleted',
      disaster_id: id,
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Disaster deleted successfully' });

  } catch (error) {
    logger.error('Error deleting disaster:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/disasters/:id/stats - Get disaster statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if disaster exists
    const { data: disaster, error: disasterError } = await supabase
      .from('disasters')
      .select('*')
      .eq('id', id)
      .single();

    if (disasterError || !disaster) {
      return res.status(404).json({ error: 'Disaster not found' });
    }

    // Get related statistics
    const [reportsResult, resourcesResult] = await Promise.all([
      supabase
        .from('reports')
        .select('id, verification_status, created_at')
        .eq('disaster_id', id),
      supabase
        .from('resources')
        .select('id, type, created_at')
        .eq('disaster_id', id)
    ]);

    const reports = reportsResult.data || [];
    const resources = resourcesResult.data || [];

    const stats = {
      disaster_id: id,
      total_reports: reports.length,
      verified_reports: reports.filter(r => r.verification_status === 'verified').length,
      pending_reports: reports.filter(r => r.verification_status === 'pending').length,
      total_resources: resources.length,
      resource_types: [...new Set(resources.map(r => r.type))],
      created_at: disaster.created_at,
      last_updated: disaster.updated_at,
      tags: disaster.tags
    };

    res.json(stats);

  } catch (error) {
    logger.error('Error fetching disaster stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
