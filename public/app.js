// Base API URL
const API_BASE = 'http://localhost:3003';

// Global variables
let socket;
let lastDisasterId = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeWebSocket();
    testAPIConnection();
    
    // Auto-test APIs after a brief delay
    setTimeout(() => {
        console.log('Running comprehensive API tests...');
        testBasicAPIs();
    }, 2000);
});

// Initialize WebSocket connection
function initializeWebSocket() {
    socket = io(API_BASE);
    
    socket.on('connect', function() {
        updateConnectionStatus('ws', 'connected', 'Connected');
        addRealtimeUpdate('WebSocket connected successfully', 'info');
    });
    
    socket.on('disconnect', function() {
        updateConnectionStatus('ws', 'disconnected', 'Disconnected');
        addRealtimeUpdate('WebSocket disconnected', 'error');
    });
    
    socket.on('connect_error', function(error) {
        updateConnectionStatus('ws', 'disconnected', 'Connection Error');
        addRealtimeUpdate(`WebSocket connection error: ${error.message}`, 'error');
    });
    
    // Listen for real-time events
    socket.on('disaster_created', function(data) {
        addRealtimeUpdate(`🚨 New disaster created: ${data.disaster.title}`, 'disaster');
    });
    
    socket.on('disaster_updated', function(data) {
        addRealtimeUpdate(`📝 Disaster updated: ${data.disaster.title}`, 'disaster');
    });
    
    socket.on('resource_created', function(data) {
        addRealtimeUpdate(`🏥 New resource added: ${data.resource.name}`, 'resource');
    });
    
    socket.on('report_created', function(data) {
        addRealtimeUpdate(`📋 New report submitted for disaster: ${data.disaster_id}`, 'report');
    });
    
    socket.on('report_verified', function(data) {
        addRealtimeUpdate(`✅ Report verified: ${data.verification_status}`, 'report');
    });
}

// Update connection status indicators
function updateConnectionStatus(type, status, text) {
    const statusElement = document.getElementById(`${type}-status`);
    const textElement = document.getElementById(`${type}-status-text`);
    
    statusElement.className = `status-indicator status-${status}`;
    textElement.textContent = text;
    
    // Update last update timestamp
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
}

// Add real-time update to the feed
function addRealtimeUpdate(message, type = 'info') {
    const updatesContainer = document.getElementById('realtime-updates');
    const timestamp = new Date().toLocaleTimeString();
    
    const icons = {
        info: 'ℹ️',
        error: '❌',
        disaster: '🚨',
        resource: '🏥',
        report: '📋',
        success: '✅'
    };
    
    const colors = {
        info: 'text-blue-600',
        error: 'text-red-600',
        disaster: 'text-red-700',
        resource: 'text-green-600',
        report: 'text-purple-600',
        success: 'text-green-700'
    };
    
    const updateDiv = document.createElement('div');
    updateDiv.className = `mb-2 p-2 rounded ${colors[type] || 'text-gray-600'}`;
    updateDiv.innerHTML = `
        <span class="font-mono text-xs text-gray-500">[${timestamp}]</span>
        <span class="ml-2">${icons[type] || ''} ${message}</span>
    `;
    
    updatesContainer.appendChild(updateDiv);
    updatesContainer.scrollTop = updatesContainer.scrollHeight;
}

// Test API connection
async function testAPIConnection() {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        if (response.ok) {
            updateConnectionStatus('api', 'connected', 'Connected');
            addRealtimeUpdate('API server connection successful', 'success');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        updateConnectionStatus('api', 'disconnected', 'Connection Failed');
        addRealtimeUpdate(`API connection failed: ${error.message}`, 'error');
    }
}

// Generic API request function
async function makeAPIRequest(method, endpoint, data = null, headers = {}) {
    const config = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'netrunnerX', // Use existing mock user
            ...headers
        }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const result = await response.json();
        
        return {
            status: response.status,
            data: result,
            success: response.ok
        };
    } catch (error) {
        return {
            status: 0,
            data: { error: error.message },
            success: false
        };
    }
}

// Display API response
function displayResponse(elementId, response) {
    const element = document.getElementById(elementId);
    const statusColor = response.success ? 'text-green-600' : 'text-red-600';
    
    element.innerHTML = `
        <div class="mb-2">
            <span class="font-semibold ${statusColor}">Status: ${response.status}</span>
        </div>
        <pre class="whitespace-pre-wrap">${JSON.stringify(response.data, null, 2)}</pre>
    `;
}

// Disasters API functions
async function testDisastersAPI(method, endpoint) {
    const response = await makeAPIRequest(method, endpoint);
    displayResponse('disasters-response', response);
}

async function createDisaster() {
    const title = document.getElementById('disaster-title').value;
    const description = document.getElementById('disaster-description').value;
    const location = document.getElementById('disaster-location').value;
    
    if (!title || !description) {
        alert('Title and description are required');
        return;
    }
    
    console.log('🚀 Creating disaster in real-time...');
    
    const data = {
        title,
        description,
        location_name: location || 'Unknown Location',
        severity: 'moderate',
        status: 'active'
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/disasters`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        console.log('📊 Response Status:', response.status);
        console.log('📊 Response Data:', result);
        
        displayResponse('disasters-response', {
            status: response.status,
            data: result,
            success: response.ok
        });
        
        if (response.ok) {
            lastDisasterId = result.disaster?.id;
            addRealtimeUpdate(`✅ SUCCESS: Disaster "${title}" inserted into database!`, 'success');
            
            // Clear the form
            document.getElementById('disaster-title').value = '';
            document.getElementById('disaster-description').value = '';
            document.getElementById('disaster-location').value = '';
            
        } else {
            addRealtimeUpdate(`❌ FAILED: ${result.error || result.message}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Network Error:', error);
        addRealtimeUpdate(`❌ Network Error: ${error.message}`, 'error');
    }
}

// Resources API functions
async function testResourcesAPI(method, endpoint) {
    const response = await makeAPIRequest(method, endpoint);
    displayResponse('resources-response', response);
}

async function createResource() {
    const name = document.getElementById('resource-name').value;
    const type = document.getElementById('resource-type').value;
    const location = document.getElementById('resource-location').value;
    
    if (!name || !location) {
        alert('Name and location are required');
        return;
    }
    
    const data = {
        name,
        type,
        location_name: location,
        capacity: 100,
        available: true,
        disaster_id: lastDisasterId // Use last created disaster ID if available
    };
    
    const response = await makeAPIRequest('POST', '/api/resources', data);
    displayResponse('resources-response', response);
    
    if (response.success) {
        addRealtimeUpdate(`Resource created: ${name}`, 'success');
    }
}

// Reports API functions
async function testReportsAPI(method, endpoint) {
    const response = await makeAPIRequest(method, endpoint);
    displayResponse('reports-response', response);
}

async function createReport() {
    const disasterId = document.getElementById('report-disaster-id').value;
    const content = document.getElementById('report-content').value;
    const imageUrl = document.getElementById('report-image-url').value;
    
    if (!content) {
        alert('Report content is required');
        return;
    }
    
    const data = {
        disaster_id: disasterId || lastDisasterId,
        content,
        image_url: imageUrl || null
    };
    
    const response = await makeAPIRequest('POST', '/api/reports', data);
    displayResponse('reports-response', response);
    
    if (response.success) {
        addRealtimeUpdate(`Report created`, 'success');
    }
}

// Social Media API functions
async function testSocialMediaAPI(method, endpoint) {
    const response = await makeAPIRequest(method, endpoint);
    displayResponse('social-response', response);
}

async function fetchSocialMedia() {
    const disasterId = document.getElementById('social-disaster-id').value;
    
    if (!disasterId) {
        alert('Disaster ID is required');
        return;
    }
    
    const response = await makeAPIRequest('GET', `/api/social-media/${disasterId}`);
    displayResponse('social-response', response);
}

// Official Updates API functions
async function testOfficialUpdatesAPI(method, endpoint) {
    const response = await makeAPIRequest(method, endpoint);
    displayResponse('updates-response', response);
}

async function fetchOfficialUpdates() {
    const disasterId = document.getElementById('updates-disaster-id').value;
    
    if (!disasterId) {
        alert('Disaster ID is required');
        return;
    }
    
    const response = await makeAPIRequest('GET', `/api/official-updates/${disasterId}`);
    displayResponse('updates-response', response);
}

// Geocoding API functions
async function testGeocodingAPI(method, endpoint) {
    const response = await makeAPIRequest(method, endpoint);
    displayResponse('geocoding-response', response);
}

async function geocodeLocation() {
    const location = document.getElementById('geocode-location').value;
    
    if (!location) {
        alert('Location is required');
        return;
    }
    
    const data = { location_name: location };
    
    const response = await makeAPIRequest('POST', '/api/geocoding/geocode', data);
    displayResponse('geocoding-response', response);
}

// Image Verification API functions
async function testImageVerificationAPI(method, endpoint) {
    const response = await makeAPIRequest(method, endpoint);
    displayResponse('verification-response', response);
}

async function verifyImage() {
    const imageUrl = document.getElementById('verify-image-url').value;
    const description = document.getElementById('verify-description').value;
    
    if (!imageUrl || !description) {
        alert('Image URL and description are required');
        return;
    }
    
    const data = {
        image_url: imageUrl,
        description: description
    };
    
    const response = await makeAPIRequest('POST', '/api/image-verification/verify-url', data);
    displayResponse('verification-response', response);
}

// Utility functions
function clearAllResponses() {
    const responseElements = [
        'disasters-response',
        'resources-response', 
        'reports-response',
        'social-response',
        'updates-response',
        'geocoding-response',
        'verification-response'
    ];
    
    responseElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = '';
        }
    });
}

// Test basic APIs to verify communication
async function testBasicAPIs() {
    try {
        // Test disasters API
        const response = await makeAPIRequest('GET', '/api/disasters');
        if (response.success) {
            addRealtimeUpdate('✅ Disasters API is working', 'success');
            displayResponse('disasters-response', response);
        }
        
        // Test health endpoint
        const healthResponse = await makeAPIRequest('GET', '/api/health');
        if (healthResponse.success) {
            addRealtimeUpdate('✅ Server health check passed', 'success');
        }
        
        // Test social media API
        const socialResponse = await makeAPIRequest('GET', '/api/social-media/mock');
        if (socialResponse.success) {
            addRealtimeUpdate('✅ Social Media API is working', 'success');
        }
        
    } catch (error) {
        addRealtimeUpdate(`❌ API testing failed: ${error.message}`, 'error');
    }
}

// Auto-test all APIs
async function runAllTests() {
    addRealtimeUpdate('Starting comprehensive API tests...', 'info');
    
    // Test each API endpoint
    await testDisastersAPI('GET', '/api/disasters');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testResourcesAPI('GET', '/api/resources');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testReportsAPI('GET', '/api/reports');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testSocialMediaAPI('GET', '/api/social-media/mock');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testOfficialUpdatesAPI('GET', '/api/official-updates/sources');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGeocodingAPI('GET', '/api/geocoding/providers');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testImageVerificationAPI('GET', '/api/image-verification/test');
    
    addRealtimeUpdate('All API tests completed', 'success');
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey) {
        switch(event.key) {
            case 'Enter':
                event.preventDefault();
                runAllTests();
                break;
            case 'Backspace':
                event.preventDefault();
                clearAllResponses();
                break;
        }
    }
});

// Add helpful tips
setTimeout(() => {
    addRealtimeUpdate('💡 Tips: Use Ctrl+Enter to run all tests, Ctrl+Backspace to clear responses', 'info');
}, 2000);
