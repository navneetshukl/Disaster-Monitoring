import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase, findNearbyResources } from '../services/database.js';
import { logger, logAction } from '../utils/logger.js';

const router = express.Router();

// Simple authentication middleware
const authenticate = (req, res, next) => {
  req.user = {
    id: '550e8400-e29b-41d4-a716-446655440000', // Fixed UUID for testing
    username: 'testuser',
    name: 'Test User',
    role: 'admin',
    email: 'test@disaster.response'
  };
  next();
};

// GET /api/resources - List all resources with filtering
router.get('/', async (req, res) => {
  try {
    const { disaster_id, type, lat, lon, radius = 10, limit = 50, offset = 0 } = req.query;
    
    let query = supabase
      .from('resources')
      .select(`
        *,
        disasters!disaster_id (
          id,
          title,
          location_name
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (disaster_id) {
      query = query.eq('disaster_id', disaster_id);
    }
    
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Database error fetching resources:', error);
      return res.status(500).json({ error: 'Failed to fetch resources' });
    }

    let filteredData = data || [];

    // Apply geospatial filtering if coordinates provided
    if (lat && lon) {
      try {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        const radiusKm = parseFloat(radius);
        
        // In a real implementation, this would use PostGIS ST_DWithin
        filteredData = await findNearbyResources(longitude, latitude, radiusKm * 1000, disaster_id);
      } catch (error) {
        logger.error('Geospatial filtering error:', error);
      }
    }

    logAction('resources_fetched', { 
      count: filteredData.length, 
      filters: { disaster_id, type, lat, lon, radius } 
    });

    res.json({
      resources: filteredData,
      total: count || filteredData.length,
      offset: parseInt(offset),
      limit: parseInt(limit),
      geospatial_filter: lat && lon ? { lat, lon, radius } : null
    });

  } catch (error) {
    logger.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/resources/:id - Get specific resource
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('resources')
      .select(`
        *,
        disasters!disaster_id (
          id,
          title,
          location_name,
          description
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    logAction('resource_viewed', { resource_id: id });

    res.json(data);

  } catch (error) {
    logger.error('Error fetching resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/resources - Create new resource
router.post('/', authenticate, async (req, res) => {
  try {
    const { disaster_id, name, location_name, type, description, contact_info } = req.body;

    // Validation
    if (!disaster_id || !name || !type) {
      return res.status(400).json({ 
        error: 'disaster_id, name, and type are required' 
      });
    }

    // Check if disaster exists
    const { data: disaster, error: disasterError } = await supabase
      .from('disasters')
      .select('id')
      .eq('id', disaster_id)
      .single();

    if (disasterError || !disaster) {
      return res.status(404).json({ error: 'Disaster not found' });
    }

    const resourceId = uuidv4();
    
    // Geocode location if provided
    let coordinates = null;
    if (location_name) {
      try {
        const geocodeResult = await GeocodingService.geocodeLocation(location_name);
        coordinates = {
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude
        };
      } catch (error) {
        logger.error('Geocoding error for resource:', error);
      }
    }

    // Create resource record
    const resourceData = {
      id: resourceId,
      disaster_id,
      name,
      location_name,
      location: coordinates ? `POINT(${coordinates.longitude} ${coordinates.latitude})` : null,
      type,
      description,
      contact_info: contact_info || {},
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('resources')
      .insert(resourceData)
      .select(`
        *,
        disasters!disaster_id (
          id,
          title,
          location_name
        )
      `)
      .single();

    if (error) {
      logger.error('Database error creating resource:', error);
      return res.status(500).json({ error: 'Failed to create resource' });
    }

    logAction('resource_created', { 
      resource_id: resourceId, 
      disaster_id,
      name, 
      type,
      location: location_name,
      created_by: req.user.id 
    });

    // Emit real-time update
    req.io.emit('resources_updated', {
      action: 'created',
      resource: data,
      disaster_id,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(data);

  } catch (error) {
    logger.error('Error creating resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id - Update resource
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location_name, type, description, contact_info } = req.body;

    // Check if resource exists
    const { data: existingResource, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingResource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    // Geocode new location if changed
    let coordinates = null;
    if (location_name && location_name !== existingResource.location_name) {
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

    // Update resource
    const updateData = {
      name: name || existingResource.name,
      location_name: location_name || existingResource.location_name,
      location: coordinates ? `POINT(${coordinates.longitude} ${coordinates.latitude})` : existingResource.location,
      type: type || existingResource.type,
      description: description || existingResource.description,
      contact_info: contact_info || existingResource.contact_info
    };

    const { data, error } = await supabase
      .from('resources')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        disasters!disaster_id (
          id,
          title,
          location_name
        )
      `)
      .single();

    if (error) {
      logger.error('Database error updating resource:', error);
      return res.status(500).json({ error: 'Failed to update resource' });
    }

    logAction('resource_updated', { 
      resource_id: id, 
      name: data.name, 
      type: data.type,
      updated_by: req.user.id 
    });

    // Emit real-time update
    req.io.emit('resources_updated', {
      action: 'updated',
      resource: data,
      disaster_id: data.disaster_id,
      timestamp: new Date().toISOString()
    });

    res.json(data);

  } catch (error) {
    logger.error('Error updating resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources/:id - Delete resource
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if resource exists
    const { data: existingResource, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingResource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Database error deleting resource:', error);
      return res.status(500).json({ error: 'Failed to delete resource' });
    }

    logAction('resource_deleted', { 
      resource_id: id, 
      name: existingResource.name,
      type: existingResource.type,
      deleted_by: req.user.id 
    });

    // Emit real-time update
    req.io.emit('resources_updated', {
      action: 'deleted',
      resource_id: id,
      disaster_id: existingResource.disaster_id,
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Resource deleted successfully' });

  } catch (error) {
    logger.error('Error deleting resource:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/resources/nearby - Find nearby resources using geospatial query
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lon, radius = 10, type, disaster_id, limit = 20 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'lat and lon parameters are required' 
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const radiusMeters = parseFloat(radius) * 1000; // Convert km to meters

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusMeters)) {
      return res.status(400).json({ 
        error: 'Invalid coordinate or radius values' 
      });
    }

    // Use geospatial query to find nearby resources
    const nearbyResources = await findNearbyResources(
      longitude, 
      latitude, 
      radiusMeters, 
      disaster_id
    );

    // Filter by type if specified
    let filteredResources = nearbyResources;
    if (type) {
      filteredResources = nearbyResources.filter(resource => 
        resource.type.toLowerCase() === type.toLowerCase()
      );
    }

    // Limit results
    const limitedResources = filteredResources.slice(0, parseInt(limit));

    logAction('nearby_resources_searched', { 
      lat: latitude, 
      lon: longitude, 
      radius, 
      type, 
      disaster_id,
      results_count: limitedResources.length 
    });

    res.json({
      query: {
        latitude,
        longitude,
        radius_km: parseFloat(radius),
        type,
        disaster_id
      },
      resources: limitedResources,
      total_found: filteredResources.length,
      returned: limitedResources.length
    });

  } catch (error) {
    logger.error('Error finding nearby resources:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/resources/types - Get available resource types
router.get('/types', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('resources')
      .select('type')
      .not('type', 'is', null);

    if (error) {
      logger.error('Database error fetching resource types:', error);
      return res.status(500).json({ error: 'Failed to fetch resource types' });
    }

    // Get unique types
    const types = [...new Set(data.map(r => r.type))].sort();

    res.json({
      types,
      count: types.length
    });

  } catch (error) {
    logger.error('Error fetching resource types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
