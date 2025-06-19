// Simple API test script to verify backend functionality
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

async function testAPI() {
    console.log('🚀 Testing Disaster Response Platform APIs...\n');
    
    try {
        // Test 1: Health Check
        console.log('1. Testing Health Check...');
        const health = await axios.get(`${API_BASE}/api/health`);
        console.log('   ✅ Health check passed:', health.data);
        
        // Test 2: Get Disasters
        console.log('\n2. Testing Disasters API...');
        const disasters = await axios.get(`${API_BASE}/api/disasters`);
        console.log('   ✅ Disasters API working, found:', disasters.data.disasters.length, 'disasters');
        
        // Test 3: Create a test disaster
        console.log('\n3. Testing Create Disaster...');
        const newDisaster = {
            title: 'Test Earthquake',
            location_name: 'San Francisco, CA',
            description: 'A test earthquake for API verification',
            tags: ['earthquake', 'test']
        };
        
        const createResponse = await axios.post(`${API_BASE}/api/disasters`, newDisaster, {
            headers: { 'x-user-id': 'netrunnerX' }
        });
        console.log('   ✅ Disaster created with ID:', createResponse.data.disaster.id);
        
        // Test 4: Test Geocoding
        console.log('\n4. Testing Geocoding API...');
        const geocodeResponse = await axios.post(`${API_BASE}/api/geocoding`, {
            location: 'Manhattan, New York'
        });
        console.log('   ✅ Geocoding working:', geocodeResponse.data);
        
        // Test 5: Test Social Media
        console.log('\n5. Testing Social Media API...');
        const socialResponse = await axios.get(`${API_BASE}/api/social-media/mock`);
        console.log('   ✅ Social Media API working, found:', socialResponse.data.reports.length, 'reports');
        
        // Test 6: Test Resources
        console.log('\n6. Testing Resources API...');
        const resourcesResponse = await axios.get(`${API_BASE}/api/resources`);
        console.log('   ✅ Resources API working, found:', resourcesResponse.data.resources.length, 'resources');
        
        console.log('\n🎉 All API tests passed! Frontend-Backend communication is working correctly.');
        
    } catch (error) {
        console.error('❌ API test failed:', error.response?.data || error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the server is running with: npm run dev');
        }
    }
}

// Run the test
testAPI();
