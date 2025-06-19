// Database setup and test script
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables first
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔧 Setting up database...\n');

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
    try {
        console.log('🔍 Testing database connection...');
        
        // Test connection
        const { data: testData, error: testError } = await supabase
            .from('disasters')
            .select('count', { count: 'exact', head: true });
            
        if (testError) {
            console.log('⚠️  Tables may not exist. Creating them...\n');
            
            // Create disasters table
            console.log('📝 Creating disasters table...');
            const { error: createError } = await supabase.rpc('create_disasters_table');
            
            if (createError) {
                console.log('⚠️  Could not create table via RPC. This is normal.');
                console.log('📋 Please run this SQL in your Supabase dashboard:\n');
                console.log(`
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create disasters table
CREATE TABLE IF NOT EXISTS disasters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    coordinates GEOGRAPHY(POINT),
    tags TEXT[],
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    audit_trail JSONB DEFAULT '[]'::jsonb
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_disasters_location ON disasters USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx_disasters_created_at ON disasters(created_at);
CREATE INDEX IF NOT EXISTS idx_disasters_created_by ON disasters(created_by);

-- Create other required tables
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    location_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    coordinates GEOGRAPHY(POINT),
    quantity INTEGER,
    status VARCHAR(50) DEFAULT 'available',
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disaster_id UUID REFERENCES disasters(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    coordinates GEOGRAPHY(POINT),
    severity VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    images TEXT[],
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample data
INSERT INTO disasters (id, title, description, location_name, latitude, longitude, created_by) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'Earthquake in California', 'Magnitude 6.5 earthquake hit central California', 'San Francisco, CA', 37.7749, -122.4194, '550e8400-e29b-41d4-a716-446655440000'),
    ('550e8400-e29b-41d4-a716-446655440002', 'Flood in Texas', 'Heavy rainfall causing severe flooding', 'Houston, TX', 29.7604, -95.3698, '550e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (id) DO NOTHING;
                `);
                
                console.log('\n✅ Please copy and run the above SQL in your Supabase dashboard.');
                console.log('Then run this script again to test the connection.\n');
                return;
            }
        } else {
            console.log('✅ Database connection successful!');
        }
        
        // Test inserting a disaster
        console.log('\n🧪 Testing disaster creation...');
        const newDisaster = {
            title: 'Test Disaster',
            description: 'This is a test disaster created by the setup script',
            location_name: 'Test Location',
            latitude: 40.7128,
            longitude: -74.0060,
            created_by: '550e8400-e29b-41d4-a716-446655440000'
        };
        
        const { data: insertData, error: insertError } = await supabase
            .from('disasters')
            .insert([newDisaster])
            .select();
            
        if (insertError) {
            console.error('❌ Failed to insert test disaster:', insertError);
        } else {
            console.log('✅ Successfully created test disaster:', insertData[0]?.title);
            
            // Clean up test data
            await supabase
                .from('disasters')
                .delete()
                .eq('id', insertData[0]?.id);
            console.log('🧹 Cleaned up test data');
        }
        
        // Get disaster count
        const { count, error: countError } = await supabase
            .from('disasters')
            .select('*', { count: 'exact', head: true });
            
        if (!countError) {
            console.log(`📊 Current disasters in database: ${count}`);
        }
        
        console.log('\n🎉 Database setup complete! Your database is ready to use.');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
    }
}

setupDatabase();
