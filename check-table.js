// Check table structure
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkTable() {
    try {
        console.log('🔍 Checking table structure...');
        
        // Try to get any existing record to see the structure
        const { data, error } = await supabase
            .from('disasters')
            .select('*')
            .limit(1);
        
        if (error) {
            console.log('Error:', error);
        } else {
            console.log('✅ Table exists. Sample structure:');
            if (data && data.length > 0) {
                console.log('Columns:', Object.keys(data[0]));
            } else {
                console.log('Table is empty. Let me try inserting minimal data...');
                
                // Try inserting minimal disaster
                const { data: insertData, error: insertError } = await supabase
                    .from('disasters')
                    .insert([{
                        title: 'Test Disaster',
                        description: 'Test description',
                        location_name: 'Test Location',
                        created_by: '11111111-1111-1111-1111-111111111111'
                    }])
                    .select();
                
                if (insertError) {
                    console.log('❌ Insert error:', insertError);
                } else {
                    console.log('✅ Insert successful!');
                    console.log('Data:', insertData);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkTable();
