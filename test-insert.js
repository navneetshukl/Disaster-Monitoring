// Direct database insertion test
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔧 Testing direct database insertion...');
console.log('URL:', supabaseUrl ? 'SET' : 'NOT SET');
console.log('KEY:', supabaseKey ? 'SET' : 'NOT SET');

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDirectInsertion() {
    try {
        console.log('\n1. Testing connection...');
        const { data: healthData, error: healthError } = await supabase
            .from('disasters')
            .select('count', { count: 'exact', head: true });
        
        if (healthError) {
            console.log('❌ Connection test failed:', healthError.message);
            console.log('Creating table...');
            
            // Try to create the table
            const { error: createError } = await supabase.rpc('exec', {
                sql: `
                CREATE TABLE IF NOT EXISTS disasters (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    location_name VARCHAR(255),
                    latitude DECIMAL(10, 8),
                    longitude DECIMAL(11, 8),
                    tags TEXT[],
                    created_by UUID NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    audit_trail JSONB DEFAULT '[]'::jsonb
                );`
            });
            
            if (createError) {
                console.log('❌ Could not create table via RPC');
                console.log('You need to manually create the table in Supabase dashboard');
                return;
            }
        } else {
            console.log('✅ Connection successful');
        }

        console.log('\n2. Inserting test disaster...');
        const testDisaster = {
            title: 'Test Earthquake',
            description: 'This is a test disaster for database insertion',
            location_name: 'Test City',
            latitude: 40.7128,
            longitude: -74.0060,
            tags: ['earthquake', 'test'],
            created_by: '11111111-1111-1111-1111-111111111111'
        };

        const { data, error } = await supabase
            .from('disasters')
            .insert([testDisaster])
            .select();

        if (error) {
            console.log('❌ Insert failed:', error);
            console.log('Error details:', JSON.stringify(error, null, 2));
        } else {
            console.log('✅ Insert successful!');
            console.log('Inserted data:', JSON.stringify(data, null, 2));
            
            // Get count
            const { count } = await supabase
                .from('disasters')
                .select('*', { count: 'exact', head: true });
            console.log(`📊 Total disasters in database: ${count}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDirectInsertion();
