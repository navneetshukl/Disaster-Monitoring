// Final API test with database insertion
import axios from 'axios';

const API_BASE = 'http://localhost:3003';

async function testAPI() {
    try {
        console.log('🧪 Testing API endpoints...\n');

        // 1. Test health check
        console.log('1. Health check...');
        const health = await axios.get(`${API_BASE}/api/health`);
        console.log('✅ Health:', health.data);

        // 2. Create a disaster
        console.log('\n2. Creating disaster...');
        const disasterData = {
            title: 'API Test Earthquake',
            description: 'This is a test earthquake created via API',
            location_name: 'San Francisco, CA'
        };

        const createResponse = await axios.post(`${API_BASE}/api/disasters`, disasterData, {
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ Disaster created:', createResponse.data);

        // 3. Get all disasters to verify it was saved
        console.log('\n3. Fetching all disasters...');
        const disasters = await axios.get(`${API_BASE}/api/disasters`);
        console.log('✅ Disasters in database:', disasters.data.disasters.length);
        console.log('Latest disaster:', disasters.data.disasters[0]);

        console.log('\n🎉 Database insertion is working perfectly!');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testAPI();
