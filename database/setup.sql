-- Disaster Response Platform Database Setup
-- This SQL script creates the necessary tables and indexes for the disaster response platform

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create disasters table
CREATE TABLE IF NOT EXISTS disasters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    location_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        CASE 
            WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
            THEN ST_Point(longitude, latitude)::geography 
            ELSE NULL 
        END
    ) STORED,
    severity VARCHAR(50) DEFAULT 'moderate' CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'resolved', 'archived')),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    audit_trail JSONB DEFAULT '[]'::jsonb
);

-- Create resources table
CREATE TABLE IF NOT EXISTS resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL CHECK (type IN ('shelter', 'medical', 'food', 'transport', 'communication', 'equipment', 'personnel')),
    description TEXT,
    location_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        CASE 
            WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
            THEN ST_Point(longitude, latitude)::geography 
            ELSE NULL 
        END
    ) STORED,
    capacity INTEGER,
    available BOOLEAN DEFAULT true,
    contact_info JSONB,
    disaster_id UUID REFERENCES disasters(id) ON DELETE SET NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID,
    verification_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cache table for external API responses
CREATE TABLE IF NOT EXISTS cache (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance

-- Disasters indexes
CREATE INDEX IF NOT EXISTS idx_disasters_location ON disasters USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_disasters_severity ON disasters (severity);
CREATE INDEX IF NOT EXISTS idx_disasters_status ON disasters (status);
CREATE INDEX IF NOT EXISTS idx_disasters_created_at ON disasters (created_at);
CREATE INDEX IF NOT EXISTS idx_disasters_created_by ON disasters (created_by);

-- Resources indexes
CREATE INDEX IF NOT EXISTS idx_resources_location ON resources USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources (type);
CREATE INDEX IF NOT EXISTS idx_resources_available ON resources (available);
CREATE INDEX IF NOT EXISTS idx_resources_disaster_id ON resources (disaster_id);
CREATE INDEX IF NOT EXISTS idx_resources_created_by ON resources (created_by);

-- Reports indexes
CREATE INDEX IF NOT EXISTS idx_reports_disaster_id ON reports (disaster_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_verification_status ON reports (verification_status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at);

-- Cache indexes
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache (expires_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_disasters_updated_at BEFORE UPDATE ON disasters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to find nearby resources
CREATE OR REPLACE FUNCTION find_nearby_resources(
    search_lat DECIMAL,
    search_lng DECIMAL,
    radius_km INTEGER DEFAULT 10,
    resource_type_filter VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    type VARCHAR,
    location_name VARCHAR,
    latitude DECIMAL,
    longitude DECIMAL,
    distance_km DECIMAL,
    available BOOLEAN,
    capacity INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.name,
        r.type,
        r.location_name,
        r.latitude,
        r.longitude,
        ROUND(ST_Distance(
            ST_Point(search_lng, search_lat)::geography,
            r.location
        )::numeric / 1000, 2) as distance_km,
        r.available,
        r.capacity
    FROM resources r
    WHERE r.location IS NOT NULL
    AND ST_DWithin(
        ST_Point(search_lng, search_lat)::geography,
        r.location,
        radius_km * 1000
    )
    AND (resource_type_filter IS NULL OR r.type = resource_type_filter)
    ORDER BY r.location <-> ST_Point(search_lng, search_lat)::geography;
END;
$$ LANGUAGE plpgsql;

-- Create function to get disaster statistics
CREATE OR REPLACE FUNCTION get_disaster_stats(disaster_uuid UUID DEFAULT NULL)
RETURNS TABLE (
    total_disasters BIGINT,
    active_disasters BIGINT,
    total_resources BIGINT,
    available_resources BIGINT,
    total_reports BIGINT,
    verified_reports BIGINT,
    pending_reports BIGINT
) AS $$
BEGIN
    IF disaster_uuid IS NULL THEN
        -- Global statistics
        RETURN QUERY
        SELECT 
            (SELECT COUNT(*) FROM disasters)::BIGINT,
            (SELECT COUNT(*) FROM disasters WHERE status = 'active')::BIGINT,
            (SELECT COUNT(*) FROM resources)::BIGINT,
            (SELECT COUNT(*) FROM resources WHERE available = true)::BIGINT,
            (SELECT COUNT(*) FROM reports)::BIGINT,
            (SELECT COUNT(*) FROM reports WHERE verification_status = 'verified')::BIGINT,
            (SELECT COUNT(*) FROM reports WHERE verification_status = 'pending')::BIGINT;
    ELSE
        -- Disaster-specific statistics
        RETURN QUERY
        SELECT 
            1::BIGINT,
            (SELECT COUNT(*) FROM disasters WHERE id = disaster_uuid AND status = 'active')::BIGINT,
            (SELECT COUNT(*) FROM resources WHERE disaster_id = disaster_uuid)::BIGINT,
            (SELECT COUNT(*) FROM resources WHERE disaster_id = disaster_uuid AND available = true)::BIGINT,
            (SELECT COUNT(*) FROM reports WHERE disaster_id = disaster_uuid)::BIGINT,
            (SELECT COUNT(*) FROM reports WHERE disaster_id = disaster_uuid AND verification_status = 'verified')::BIGINT,
            (SELECT COUNT(*) FROM reports WHERE disaster_id = disaster_uuid AND verification_status = 'pending')::BIGINT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing
INSERT INTO disasters (id, title, description, location_name, latitude, longitude, severity, status, created_by) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Sample Flood Emergency', 'Severe flooding in downtown area due to heavy rainfall. Multiple streets are impassable and residents need evacuation assistance.', 'Downtown Manhattan, NYC', 40.7580, -73.9855, 'high', 'active', 'admin1'),
('550e8400-e29b-41d4-a716-446655440002', 'Wildfire Alert', 'Fast-spreading wildfire threatening residential areas. Immediate evacuation orders in effect for zones A and B.', 'Malibu, CA', 34.0259, -118.7798, 'critical', 'active', 'admin1'),
('550e8400-e29b-41d4-a716-446655440003', 'Earthquake Response', 'Magnitude 6.2 earthquake struck the region. Infrastructure damage reported, search and rescue operations underway.', 'San Francisco, CA', 37.7749, -122.4194, 'high', 'monitoring', 'admin1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO resources (id, name, type, description, location_name, latitude, longitude, capacity, available, disaster_id, created_by) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'Emergency Shelter Downtown', 'shelter', 'Large emergency shelter with 200 bed capacity, medical facilities, and food services available.', 'Community Center, Manhattan', 40.7505, -73.9934, 200, true, '550e8400-e29b-41d4-a716-446655440001', 'responder1'),
('660e8400-e29b-41d4-a716-446655440002', 'Mobile Medical Unit', 'medical', 'Fully equipped mobile medical unit with emergency care capabilities and trauma specialists.', 'Times Square, NYC', 40.7580, -73.9855, 50, true, '550e8400-e29b-41d4-a716-446655440001', 'responder2'),
('660e8400-e29b-41d4-a716-446655440003', 'Food Distribution Center', 'food', 'Central food distribution point providing meals and emergency supplies to affected families.', 'Central Park, NYC', 40.7829, -73.9654, 500, true, '550e8400-e29b-41d4-a716-446655440001', 'responder1'),
('660e8400-e29b-41d4-a716-446655440004', 'Evacuation Transport Hub', 'transport', 'Bus terminal for coordinating evacuations and transport to safe zones.', 'Malibu Fire Station', 34.0259, -118.7798, 100, true, '550e8400-e29b-41d4-a716-446655440002', 'responder3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO reports (id, disaster_id, user_id, content, verification_status, created_at) VALUES
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'citizen1', 'Water level rising rapidly on 42nd Street. Several cars are stranded and people need immediate assistance. Emergency services are overwhelmed.', 'verified', NOW() - INTERVAL '2 hours'),
('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'citizen2', 'Power outage affecting entire block. Elderly residents in apartment complex need help evacuating. No emergency services visible yet.', 'pending', NOW() - INTERVAL '1 hour'),
('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'citizen3', 'Fire spreading towards residential area. Strong winds making situation worse. Need immediate evacuation support.', 'verified', NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- Create a view for disaster summary with statistics
CREATE OR REPLACE VIEW disaster_summary AS
SELECT 
    d.id,
    d.title,
    d.description,
    d.location_name,
    d.latitude,
    d.longitude,
    d.severity,
    d.status,
    d.created_at,
    d.updated_at,
    COUNT(DISTINCT r.id) as resource_count,
    COUNT(DISTINCT rep.id) as report_count,
    COUNT(DISTINCT CASE WHEN rep.verification_status = 'verified' THEN rep.id END) as verified_reports,
    COUNT(DISTINCT CASE WHEN rep.verification_status = 'pending' THEN rep.id END) as pending_reports
FROM disasters d
LEFT JOIN resources r ON d.id = r.disaster_id
LEFT JOIN reports rep ON d.id = rep.disaster_id
GROUP BY d.id, d.title, d.description, d.location_name, d.latitude, d.longitude, d.severity, d.status, d.created_at, d.updated_at;

-- Comments
COMMENT ON TABLE disasters IS 'Main disasters table storing disaster events and their details';
COMMENT ON TABLE resources IS 'Resources available for disaster response (shelters, medical facilities, etc.)';
COMMENT ON TABLE reports IS 'User-submitted reports about disasters with verification status';
COMMENT ON TABLE cache IS 'Cache table for storing external API responses with TTL';
COMMENT ON FUNCTION find_nearby_resources IS 'Find resources within a specified radius of given coordinates';
COMMENT ON FUNCTION get_disaster_stats IS 'Get comprehensive statistics for disasters, resources, and reports';
COMMENT ON VIEW disaster_summary IS 'Summary view of disasters with aggregated statistics';

-- Final message
DO $$
BEGIN
    RAISE NOTICE 'Disaster Response Platform database setup completed successfully!';
    RAISE NOTICE 'Tables created: disasters, resources, reports, cache';
    RAISE NOTICE 'Functions created: find_nearby_resources, get_disaster_stats, clean_expired_cache';
    RAISE NOTICE 'View created: disaster_summary';
    RAISE NOTICE 'Sample data inserted for testing';
END
$$;
