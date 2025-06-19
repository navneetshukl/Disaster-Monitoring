// Database connectivity test
import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

// Import database service after env vars are loaded
const { supabase } = await import('./services/database.js');

async function testDatabase() {
    console.log('🔍 Testing database connectivity...\n');
    
    if (!supabase) {
        console.error('❌ Supabase client not initialized. Check your .env configuration.');
        return;
    }
    
    try {
        // Test 1: Basic connection
        console.log('1. Testing basic connection...');
        const { data, error } = await supabase.auth.getSession();
        if (error && error.message.includes('Invalid API key')) {
            console.error('❌ Invalid Supabase API key');
            return;
        }
        console.log('   ✅ Basic connection successful');
        
        // Test 2: Check if disasters table exists
        console.log('\n2. Testing disasters table...');
        const { data: disasters, error: disastersError } = await supabase
            .from('disasters')
            .select('count', { count: 'exact', head: true });
            
        if (disastersError) {
            console.error('❌ Disasters table error:', disastersError.message);
            
            // If table doesn't exist, try to create it
            if (disastersError.message.includes('relation "disasters" does not exist')) {
                console.log('   📝 Attempting to create disasters table...');
                await createTables();
            }
        } else {
            console.log('   ✅ Disasters table exists, count:', disasters);
        }
        
        // Test 3: Try to fetch disasters
        console.log('\n3. Testing fetch disasters...');
        const { data: allDisasters, error: fetchError } = await supabase
            .from('disasters')
            .select('*')
            .limit(5);
            
        if (fetchError) {
            console.error('❌ Fetch error:', fetchError.message);
        } else {
            console.log('   ✅ Fetch successful, found:', allDisasters?.length || 0, 'disasters');
            if (allDisasters && allDisasters.length > 0) {
                console.log('   📄 Sample disaster:', allDisasters[0].title);
            }
        }
        
        // Test 4: Try to create a test disaster
        console.log('\n4. Testing create disaster...');
        const testDisaster = {
            title: 'Test Database Connection',
            description: 'This is a test disaster to verify database connectivity',
            location_name: 'Test Location',
            latitude: 40.7128,
            longitude: -74.0060,
            tags: ['test'],
            created_by: 'netrunnerX'
        };
        
        const { data: newDisaster, error: createError } = await supabase
            .from('disasters')
            .insert([testDisaster])
            .select();
            
        if (createError) {
            console.error('❌ Create error:', createError.message);
        } else {
            console.log('   ✅ Create successful, disaster ID:', newDisaster[0]?.id);
            
            // Clean up test disaster
            await supabase
                .from('disasters')
                .delete()
                .eq('id', newDisaster[0].id);
            console.log('   🧹 Test disaster cleaned up');
        }
        
        console.log('\n🎉 Database tests completed!');
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
    }
}

async function createTables() {
    try {
        // Create disasters table using raw SQL
        const { error } = await supabase.rpc('create_disasters_table');
        if (error) {
            console.log('Note: Could not create table via RPC, table might already exist');
        }
    } catch (err) {
        console.log('Note: Table creation via RPC not available');
    }
}

// Run the test
testDatabase().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
});
