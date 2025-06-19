import axios from 'axios';
import { logger } from '../utils/logger.js';
import { getFromCache, setCache } from './database.js';

export class GeocodingService {
  
  // Geocode location name to coordinates using Google Maps API
  static async geocodeWithGoogleMaps(locationName) {
    const cacheKey = `geocode_google_${Buffer.from(locationName).toString('base64')}`;
    
    try {
      // Check cache first
      const cached = await getFromCache(cacheKey);
      if (cached) {
        logger.info('Geocoding cache hit (Google Maps)');
        return cached;
      }

      if (!process.env.GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key not configured');
      }

      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: locationName,
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }

      const result = response.data.results[0];
      const geocodeData = {
        locationName,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
        confidence: result.geometry.location_type === 'ROOFTOP' ? 'high' : 'medium',
        provider: 'google_maps',
        timestamp: new Date().toISOString()
      };

      // Cache the result
      await setCache(cacheKey, geocodeData, 86400); // 24 hours cache

      logger.info(`Geocoded with Google Maps: ${locationName} -> ${geocodeData.latitude}, ${geocodeData.longitude}`);
      return geocodeData;

    } catch (error) {
      logger.error('Google Maps geocoding error:', error);
      throw error;
    }
  }

  // Geocode location name to coordinates using Mapbox API
  static async geocodeWithMapbox(locationName) {
    const cacheKey = `geocode_mapbox_${Buffer.from(locationName).toString('base64')}`;
    
    try {
      // Check cache first
      const cached = await getFromCache(cacheKey);
      if (cached) {
        logger.info('Geocoding cache hit (Mapbox)');
        return cached;
      }

      if (!process.env.MAPBOX_ACCESS_TOKEN) {
        throw new Error('Mapbox access token not configured');
      }

      const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationName)}.json`, {
        params: {
          access_token: process.env.MAPBOX_ACCESS_TOKEN,
          limit: 1
        }
      });

      if (!response.data.features || !response.data.features.length) {
        throw new Error('No geocoding results found');
      }

      const result = response.data.features[0];
      const geocodeData = {
        locationName,
        latitude: result.center[1],
        longitude: result.center[0],
        formattedAddress: result.place_name,
        confidence: result.relevance > 0.8 ? 'high' : 'medium',
        provider: 'mapbox',
        timestamp: new Date().toISOString()
      };

      // Cache the result
      await setCache(cacheKey, geocodeData, 86400); // 24 hours cache

      logger.info(`Geocoded with Mapbox: ${locationName} -> ${geocodeData.latitude}, ${geocodeData.longitude}`);
      return geocodeData;

    } catch (error) {
      logger.error('Mapbox geocoding error:', error);
      throw error;
    }
  }

  // Geocode location name to coordinates using OpenStreetMap Nominatim
  static async geocodeWithOSM(locationName) {
    const cacheKey = `geocode_osm_${Buffer.from(locationName).toString('base64')}`;
    
    try {
      // Check cache first
      const cached = await getFromCache(cacheKey);
      if (cached) {
        logger.info('Geocoding cache hit (OSM)');
        return cached;
      }

      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: locationName,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'DisasterResponsePlatform/1.0'
        }
      });

      if (!response.data || !response.data.length) {
        throw new Error('No geocoding results found');
      }

      const result = response.data[0];
      const geocodeData = {
        locationName,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name,
        confidence: result.importance > 0.5 ? 'high' : 'medium',
        provider: 'openstreetmap',
        timestamp: new Date().toISOString()
      };

      // Cache the result
      await setCache(cacheKey, geocodeData, 86400); // 24 hours cache

      logger.info(`Geocoded with OSM: ${locationName} -> ${geocodeData.latitude}, ${geocodeData.longitude}`);
      return geocodeData;

    } catch (error) {
      logger.error('OSM geocoding error:', error);
      throw error;
    }
  }

  // Main geocoding function with fallback providers
  static async geocodeLocation(locationName) {
    try {
      // Try Google Maps first if API key is available
      if (process.env.GOOGLE_MAPS_API_KEY) {
        try {
          return await this.geocodeWithGoogleMaps(locationName);
        } catch (error) {
          logger.warn('Google Maps geocoding failed, trying Mapbox...');
        }
      }

      // Try Mapbox if token is available
      if (process.env.MAPBOX_ACCESS_TOKEN) {
        try {
          return await this.geocodeWithMapbox(locationName);
        } catch (error) {
          logger.warn('Mapbox geocoding failed, trying OpenStreetMap...');
        }
      }

      // Fallback to OpenStreetMap (free)
      return await this.geocodeWithOSM(locationName);

    } catch (error) {
      logger.error('All geocoding providers failed:', error);
      
      // Return mock data for development
      return {
        locationName,
        latitude: 40.7128 + (Math.random() - 0.5) * 0.1, // NYC area with some randomness
        longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
        formattedAddress: `${locationName} (Mock Location)`,
        confidence: 'low',
        provider: 'mock',
        error: 'All geocoding providers failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Reverse geocoding - convert coordinates to address
  static async reverseGeocode(latitude, longitude) {
    const cacheKey = `reverse_geocode_${latitude}_${longitude}`;
    
    try {
      // Check cache first
      const cached = await getFromCache(cacheKey);
      if (cached) {
        logger.info('Reverse geocoding cache hit');
        return cached;
      }

      // Try Google Maps first
      if (process.env.GOOGLE_MAPS_API_KEY) {
        try {
          const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
              latlng: `${latitude},${longitude}`,
              key: process.env.GOOGLE_MAPS_API_KEY
            }
          });

          if (response.data.status === 'OK' && response.data.results.length) {
            const result = response.data.results[0];
            const reverseData = {
              latitude,
              longitude,
              formattedAddress: result.formatted_address,
              provider: 'google_maps',
              timestamp: new Date().toISOString()
            };

            await setCache(cacheKey, reverseData, 86400); // 24 hours cache
            logger.info(`Reverse geocoded: ${latitude}, ${longitude} -> ${reverseData.formattedAddress}`);
            return reverseData;
          }
        } catch (error) {
          logger.warn('Google Maps reverse geocoding failed, trying OSM...');
        }
      }

      // Fallback to OpenStreetMap
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'DisasterResponsePlatform/1.0'
        }
      });

      const reverseData = {
        latitude,
        longitude,
        formattedAddress: response.data.display_name || 'Unknown Location',
        provider: 'openstreetmap',
        timestamp: new Date().toISOString()
      };

      await setCache(cacheKey, reverseData, 86400); // 24 hours cache
      logger.info(`Reverse geocoded with OSM: ${latitude}, ${longitude} -> ${reverseData.formattedAddress}`);
      return reverseData;

    } catch (error) {
      logger.error('Reverse geocoding failed:', error);
      return {
        latitude,
        longitude,
        formattedAddress: 'Unknown Location',
        provider: 'none',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}
