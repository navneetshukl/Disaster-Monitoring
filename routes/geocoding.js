import express from 'express';
import { GeocodingService } from '../services/geocoding.js';
import { GeminiService } from '../services/gemini.js';
import { logger, logAction } from '../utils/logger.js';

const router = express.Router();

// POST /api/geocoding/extract-and-geocode - Extract location from text and geocode it
router.post('/extract-and-geocode', async (req, res) => {
  try {
    const { text, location_name } = req.body;

    if (!text && !location_name) {
      return res.status(400).json({ 
        error: 'Either text (for extraction) or location_name (for direct geocoding) is required' 
      });
    }

    let finalLocationName = location_name;
    let extractionResult = null;

    // Extract location from text if needed
    if (!location_name && text) {
      try {
        extractionResult = await GeminiService.extractLocationFromText(text);
        finalLocationName = extractionResult.extractedLocation;
      } catch (error) {
        logger.error('Location extraction error:', error);
        return res.status(500).json({ 
          error: 'Failed to extract location from text',
          details: error.message
        });
      }
    }

    // Geocode the location
    if (!finalLocationName || finalLocationName === 'Unknown Location') {
      return res.status(400).json({ 
        error: 'No valid location found to geocode',
        extraction_result: extractionResult
      });
    }

    try {
      const geocodeResult = await GeocodingService.geocodeLocation(finalLocationName);

      const response = {
        input: {
          text: text || null,
          location_name: location_name || null
        },
        extraction: extractionResult,
        geocoding: geocodeResult,
        final_coordinates: {
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude,
          formatted_address: geocodeResult.formattedAddress
        },
        processing_timestamp: new Date().toISOString()
      };

      logAction('location_extracted_and_geocoded', { 
        input_text: text ? text.substring(0, 100) : null,
        input_location: location_name,
        extracted_location: finalLocationName,
        geocoded_coordinates: `${geocodeResult.latitude}, ${geocodeResult.longitude}`,
        provider: geocodeResult.provider
      });

      res.json(response);

    } catch (error) {
      logger.error('Geocoding error:', error);
      res.status(500).json({ 
        error: 'Failed to geocode location',
        location_name: finalLocationName,
        extraction_result: extractionResult,
        details: error.message
      });
    }

  } catch (error) {
    logger.error('Error in extract-and-geocode:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/geocoding/geocode - Geocode a location name to coordinates
router.post('/geocode', async (req, res) => {
  try {
    const { location_name, provider } = req.body;

    if (!location_name) {
      return res.status(400).json({ error: 'location_name is required' });
    }

    let geocodeResult;

    // Use specific provider if requested
    if (provider) {
      switch (provider.toLowerCase()) {
        case 'google':
          geocodeResult = await GeocodingService.geocodeWithGoogleMaps(location_name);
          break;
        case 'mapbox':
          geocodeResult = await GeocodingService.geocodeWithMapbox(location_name);
          break;
        case 'osm':
        case 'openstreetmap':
          geocodeResult = await GeocodingService.geocodeWithOSM(location_name);
          break;
        default:
          return res.status(400).json({ 
            error: 'Invalid provider. Supported providers: google, mapbox, osm' 
          });
      }
    } else {
      // Use default geocoding with fallback
      geocodeResult = await GeocodingService.geocodeLocation(location_name);
    }

    logAction('location_geocoded', { 
      location_name,
      provider: geocodeResult.provider,
      coordinates: `${geocodeResult.latitude}, ${geocodeResult.longitude}`,
      confidence: geocodeResult.confidence
    });

    res.json(geocodeResult);

  } catch (error) {
    logger.error('Geocoding error:', error);
    res.status(500).json({ 
      error: 'Failed to geocode location',
      location_name: req.body.location_name,
      details: error.message
    });
  }
});

// POST /api/geocoding/reverse - Reverse geocode coordinates to address
router.post('/reverse', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ 
        error: 'latitude and longitude are required' 
      });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ 
        error: 'Invalid latitude or longitude values' 
      });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ 
        error: 'Latitude must be between -90 and 90, longitude between -180 and 180' 
      });
    }

    const reverseResult = await GeocodingService.reverseGeocode(lat, lon);

    logAction('coordinates_reverse_geocoded', { 
      input_coordinates: `${lat}, ${lon}`,
      result_address: reverseResult.formattedAddress,
      provider: reverseResult.provider
    });

    res.json(reverseResult);

  } catch (error) {
    logger.error('Reverse geocoding error:', error);
    res.status(500).json({ 
      error: 'Failed to reverse geocode coordinates',
      coordinates: `${req.body.latitude}, ${req.body.longitude}`,
      details: error.message
    });
  }
});

// GET /api/geocoding/providers - Get available geocoding providers
router.get('/providers', (req, res) => {
  try {
    const providers = [
      {
        name: 'google',
        display_name: 'Google Maps',
        available: !!process.env.GOOGLE_MAPS_API_KEY,
        features: ['geocoding', 'reverse_geocoding'],
        rate_limit: '40,000 requests per month (free tier)',
        accuracy: 'high'
      },
      {
        name: 'mapbox',
        display_name: 'Mapbox',
        available: !!process.env.MAPBOX_ACCESS_TOKEN,
        features: ['geocoding', 'reverse_geocoding'],
        rate_limit: '100,000 requests per month (free tier)',
        accuracy: 'high'
      },
      {
        name: 'osm',
        display_name: 'OpenStreetMap (Nominatim)',
        available: true,
        features: ['geocoding', 'reverse_geocoding'],
        rate_limit: '1 request per second',
        accuracy: 'medium'
      }
    ];

    const availableProviders = providers.filter(p => p.available);
    const primaryProvider = availableProviders.find(p => p.name === 'google') || 
                           availableProviders.find(p => p.name === 'mapbox') || 
                           availableProviders.find(p => p.name === 'osm');

    res.json({
      providers,
      available_providers: availableProviders,
      primary_provider: primaryProvider?.name || 'none',
      total_providers: providers.length,
      available_count: availableProviders.length
    });

  } catch (error) {
    logger.error('Error fetching geocoding providers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/geocoding/batch - Batch geocode multiple locations
router.post('/batch', async (req, res) => {
  try {
    const { locations, provider } = req.body;

    if (!locations || !Array.isArray(locations)) {
      return res.status(400).json({ 
        error: 'locations array is required' 
      });
    }

    if (locations.length > 10) {
      return res.status(400).json({ 
        error: 'Maximum 10 locations allowed per batch request' 
      });
    }

    const geocodePromises = locations.map(async (location, index) => {
      try {
        let result;
        
        if (provider) {
          // Use specific provider
          switch (provider.toLowerCase()) {
            case 'google':
              result = await GeocodingService.geocodeWithGoogleMaps(location);
              break;
            case 'mapbox':
              result = await GeocodingService.geocodeWithMapbox(location);
              break;
            case 'osm':
              result = await GeocodingService.geocodeWithOSM(location);
              break;
            default:
              throw new Error('Invalid provider');
          }
        } else {
          result = await GeocodingService.geocodeLocation(location);
        }

        return {
          index,
          location,
          success: true,
          result
        };
      } catch (error) {
        return {
          index,
          location,
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(geocodePromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    logAction('batch_geocoding_completed', { 
      total_locations: locations.length,
      successful_geocodes: successful.length,
      failed_geocodes: failed.length,
      provider: provider || 'auto'
    });

    res.json({
      batch_results: results,
      summary: {
        total_locations: locations.length,
        successful: successful.length,
        failed: failed.length,
        success_rate: `${Math.round(successful.length / locations.length * 100)}%`
      },
      provider_used: provider || 'auto',
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Batch geocoding error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/geocoding/test - Test geocoding with sample data
router.get('/test', async (req, res) => {
  try {
    const testLocations = [
      'Manhattan, NYC',
      'Los Angeles, CA',
      'Chicago, IL',
      'London, UK',
      'Tokyo, Japan'
    ];

    const testResults = [];

    for (const location of testLocations) {
      try {
        const result = await GeocodingService.geocodeLocation(location);
        testResults.push({
          location,
          success: true,
          coordinates: `${result.latitude}, ${result.longitude}`,
          provider: result.provider,
          confidence: result.confidence
        });
      } catch (error) {
        testResults.push({
          location,
          success: false,
          error: error.message
        });
      }
    }

    const successfulTests = testResults.filter(r => r.success);

    logAction('geocoding_test_completed', { 
      total_tests: testResults.length,
      successful_tests: successfulTests.length
    });

    res.json({
      test_results: testResults,
      summary: {
        total_tests: testResults.length,
        successful: successfulTests.length,
        failed: testResults.length - successfulTests.length,
        success_rate: `${Math.round(successfulTests.length / testResults.length * 100)}%`
      },
      tested_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Geocoding test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
