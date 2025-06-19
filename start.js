// Startup script to ensure proper environment loading
import dotenv from 'dotenv';

// Load environment variables first
console.log('🔧 Loading environment variables...');
dotenv.config();

// Verify environment variables are loaded
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('✅ Environment loaded:');
console.log('- SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
console.log('- SUPABASE_ANON_KEY:', supabaseKey ? 'SET' : 'NOT SET');
console.log('- PORT:', process.env.PORT || 3001);

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials. Please check your .env file.');
    process.exit(1);
}

// Now start the server
console.log('🚀 Starting server...\n');
import('./server.js');
