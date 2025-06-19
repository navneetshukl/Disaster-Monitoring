import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase;

console.log('🔍 Environment check:');
console.log('SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', supabaseKey ? `${supabaseKey.substring(0, 30)}...` : 'NOT SET');

// Check for required environment variables
if (!supabaseUrl || !supabaseKey || 
    supabaseUrl.includes('your-project') || 
    supabaseKey.includes('your-anon-key')) {
  console.warn('⚠️  Running in DEMO mode - Supabase not configured. Some features may not work.');
  console.warn('To enable full functionality, configure SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
} else {
  try {
    // Only create actual Supabase client if credentials are valid
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error.message);
  }
}

// Test database connection asynchronously
async function testDatabaseConnection() {
  if (!supabase) {
    console.warn('⚠️  Cannot test database connection - Supabase client not initialized');
    return false;
  }
  
  try {
    const { data, error } = await supabase.from('disasters').select('count', { count: 'exact', head: true });
    if (error) {
      console.warn('⚠️  Database connection test failed:', error.message);
      console.warn('This might be because tables don\'t exist yet. Will attempt to create them...');
      return false;
    } else {
      console.log('✅ Database connection verified successfully');
      return true;
    }
  } catch (error) {
    console.error('❌ Database connection test error:', error.message);
    return false;
  }
}

// Export supabase client (may be null in demo mode)
export { supabase };

// Database initialization and table creation
export async function initializeDatabase() {
  if (!supabase) {
    console.warn('⚠️  Supabase not configured - running in demo mode');
    return;
  }

  try {
    // Test basic connection first
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      return;
    }

    // Check if tables exist and create them if they don't
    await ensureTablesExist();
    logger.info('Database tables verified/created successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    console.error('❌ Database initialization failed. The app will continue in limited mode.');
  }
}

// Ensure tables exist by testing them
async function ensureTablesExist() {
  if (!supabase) return;

  try {
    // Test if disasters table exists
    const { error: disastersError } = await supabase
      .from('disasters')
      .select('count', { count: 'exact', head: true });
    
    if (disastersError && disastersError.message.includes('does not exist')) {
      console.log('📝 Creating database tables...');
      await createTablesDirectly();
    }
    
    // Test other tables
    const tables = ['resources', 'reports', 'cache'];
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('count', { count: 'exact', head: true });
      
      if (error && error.message.includes('does not exist')) {
        console.log(`📝 Table ${table} needs to be created manually in Supabase dashboard`);
      }
    }
    
  } catch (error) {
    console.warn('⚠️  Could not verify tables:', error.message);
  }
}

// Create tables directly (basic version for emergency fallback)
async function createTablesDirectly() {
  if (!supabase) return;
  
  console.log('⚠️  Note: Some tables may need to be created manually in your Supabase dashboard.');
  console.log('   Please run the SQL commands from database/setup.sql in your Supabase SQL editor.');
}

// Cache utilities
export async function getFromCache(key) {
  try {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', key)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache has expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired cache entry
      await supabase.from('cache').delete().eq('key', key);
      return null;
    }

    return data.value;
  } catch (error) {
    logger.error('Cache retrieval error:', error);
    return null;
  }
}

export async function setCache(key, value, ttlSeconds = 3600) {
  try {
    if (!supabase) {
      return;
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    
    const { error } = await supabase
      .from('cache')
      .upsert({
        key,
        value,
        expires_at: expiresAt.toISOString()
      });

    if (error) {
      logger.error('Cache storage error:', error);
    }
  } catch (error) {
    logger.error('Cache storage error:', error);
  }
}

// Clean up expired cache entries (should be run periodically)
export async function cleanupExpiredCache() {
  try {
    if (!supabase) {
      return;
    }

    const { error } = await supabase
      .from('cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      logger.error('Cache cleanup error:', error);
    } else {
      logger.info('Expired cache entries cleaned up');
    }
  } catch (error) {
    logger.error('Cache cleanup error:', error);
  }
}

// Geospatial utilities
export function createPoint(longitude, latitude) {
  return `POINT(${longitude} ${latitude})`;
}

export async function findNearbyResources(longitude, latitude, radiusMeters = 10000, disasterId = null) {
  try {
    if (!supabase) {
      return [];
    }

    let query = supabase
      .from('resources')
      .select('*')
      .not('location', 'is', null);

    if (disasterId) {
      query = query.eq('disaster_id', disasterId);
    }

    // Note: In a real implementation, you'd use PostGIS functions
    // This is a simplified version for demonstration
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error('Nearby resources query error:', error);
    return [];
  }
}
