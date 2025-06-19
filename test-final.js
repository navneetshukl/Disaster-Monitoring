import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3003';

async function testDisasterCreation() {
  console.log('🧪 Testing Disaster Creation API...');
  
  try {
    // Test disaster creation
    const disasterData = {
      title: 'Test Earthquake',
      description: 'Magnitude 6.5 earthquake in downtown area',
      location_name: 'Downtown Area',
      severity: 'high',
      status: 'active'
    };

    const response = await fetch(`${API_BASE}/api/disasters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(disasterData)
    });

    const result = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Disaster created successfully!');
      
      // Test fetching disasters
      console.log('\n🔍 Fetching all disasters...');
      const fetchResponse = await fetch(`${API_BASE}/api/disasters`);
      const fetchResult = await fetchResponse.json();
      
      console.log('📊 Fetch Response:', JSON.stringify(fetchResult, null, 2));
      
      if (fetchResponse.ok) {
        console.log(`✅ Found ${fetchResult.disasters?.length || 0} disasters in database`);
      } else {
        console.log('❌ Failed to fetch disasters');
      }
      
    } else {
      console.log('❌ Failed to create disaster');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDisasterCreation();
