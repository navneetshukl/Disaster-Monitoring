// Direct test of disaster insertion with proper UUID
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testDirectInsert() {
    try {
        console.log('🧪 Testing direct disaster insertion with proper UUID...\n');

        const disasterData = {
            id: uuidv4(),
            title: 'Direct Test Earthquake',
            description: 'This earthquake was inserted directly with proper UUID',
            location_name: 'Test City',
            latitude: 37.7749,
            longitude: -122.4194,
            severity: 'moderate',
            status: 'active',
            created_by: '550e8400-e29b-41d4-a716-446655440000', // Hardcoded UUID for netrunnerX
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            audit_trail: [{
                action: 'created',
                user_id: '550e8400-e29b-41d4-a716-446655440000',
                timestamp: new Date().toISOString(),
                changes: { title: 'Direct Test Earthquake', location_name: 'Test City' }
            }]
        };

        console.log('📋 Data to insert:', disasterData);
        console.log('\n🔄 Inserting...');

        const { data, error } = await supabase
            .from('disasters')
            .insert([disasterData])
            .select()
            .single();

        if (error) {
            console.error('❌ Insert failed:', error);
        } else {
            console.log('✅ Insert successful!');
            console.log('📊 Inserted data:', data);
            
            // Now fetch all disasters to verify
            const { data: allDisasters } = await supabase
                .from('disasters')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(3);
            
            console.log('\n📋 Latest disasters in database:');
            allDisasters.forEach((disaster, index) => {
                console.log(`${index + 1}. ${disaster.title} (ID: ${disaster.id})`);
            });
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDirectInsert();
