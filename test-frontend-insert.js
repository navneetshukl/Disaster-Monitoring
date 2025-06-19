// EXACT WORKING CODE FOR FRONTEND TO DATABASE INSERTION
// Run this to test real-time insertion: node test-frontend-insert.js

async function testRealTimeInsertion() {
  console.log('🚀 Testing REAL-TIME Frontend to Database Insertion...');
  
  const disasterData = {
    title: 'Real-Time Test Disaster',
    description: 'Testing frontend to database insertion',
    location_name: 'Test Location',
    severity: 'moderate',
    status: 'active'
  };

  try {
    const response = await fetch('http://localhost:3003/api/disasters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(disasterData)
    });

    const result = await response.json();
    
    console.log('📊 Status:', response.status);
    console.log('📊 Response:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ SUCCESS: Data inserted into database!');
      console.log('🆔 Disaster ID:', result.disaster?.id);
    } else {
      console.log('❌ FAILED:', result.error || result.message);
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

// Run the test
testRealTimeInsertion();
