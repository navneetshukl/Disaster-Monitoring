# Disaster Response Coordination Platform

A **real-time disaster response coordination platform** built with Node.js, Express, and Supabase. Features complete CRUD operations, real-time WebSocket communication, geospatial queries, and external API integrations for comprehensive disaster management.

## 🏗️ Architecture Overview

### Backend Stack
- **Node.js** with **Express.js** - REST API server
- **Socket.IO** - Real-time WebSocket communication  
- **Supabase** (PostgreSQL + PostGIS) - Database with geospatial support
- **Winston** - Advanced logging system

### External Integrations
- **Google Gemini API** - AI-powered location extraction and analysis
- **Mapping Services** - Google Maps, Mapbox, OpenStreetMap for geocoding
- **Mock Social Media API** - Social media disaster monitoring simulation

### Frontend
- **Vanilla HTML/CSS/JS** - Clean testing interface for backend APIs
- **Tailwind CSS** - Modern styling framework
- **Real-time Updates** - WebSocket integration

## 🚀 Features

### ✅ **CORE FEATURES (IMPLEMENTED)**
- **🔥 Complete CRUD Operations** - Create, Read, Update, Delete disasters
- **📍 Geospatial Support** - Location-based queries with PostGIS
- **⚡ Real-time Updates** - Live notifications via Socket.IO
- **🗂️ Resource Management** - Emergency resources tracking
- **📋 Report System** - Citizen-submitted reports
- **🔍 Advanced Filtering** - Filter by severity, status, location
- **📊 Activity Logging** - Complete audit trails
- **🌐 RESTful API** - Clean, documented endpoints

### 🔧 **TECHNICAL FEATURES**
- **UUID-based Authentication** - Simplified auth for development
- **Environment-based Configuration** - Secure credential management
- **Error Handling** - Comprehensive error responses
- **Input Validation** - Data integrity enforcement
- **Logging System** - Detailed request/response logging

## 📁 Project Structure

```
citymall/
├── server.js                 # Main Express server
├── start.js                  # Environment loader and startup script
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables (not in repo)
├── .gitignore               # Git ignore rules
├── routes/
│   ├── disasters.js         # Disaster CRUD operations
│   ├── resources.js         # Resource management
│   └── reports.js           # Report handling
├── services/
│   ├── database.js          # Supabase connection and queries
│   ├── geocoding.js         # Location services
│   └── social-media.js      # Social media mock API
├── public/
│   ├── index.html           # Main dashboard
│   ├── crud.html            # CRUD operations interface
│   └── app.js               # Frontend JavaScript
├── logs/                    # Application logs
└── test-frontend-insert.js  # API testing script
```

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js** (v16+ recommended)
- **Supabase Account** (for database)
- **Git** (for version control)

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd citymall
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:

```env
# Database Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Server Configuration
PORT=3003
NODE_ENV=development

# API Keys (Optional - for enhanced features)
GOOGLE_MAPS_API_KEY=your_google_maps_key
MAPBOX_ACCESS_TOKEN=your_mapbox_token
GOOGLE_GEMINI_API_KEY=your_gemini_key
```

### 4. Start the Application
```bash
# Start with environment validation
node start.js

# Or directly start server
npm start
```

### 5. Verify Installation
- **Health Check**: http://localhost:3003/api/health
- **Main Dashboard**: http://localhost:3003
- **CRUD Interface**: http://localhost:3003/crud.html

## 🌐 API Endpoints

### **Disasters** 🔥
```bash
# Get all disasters
GET /api/disasters

# Get disasters with filters
GET /api/disasters?severity=high&status=active&location=lat,lng&radius=50

# Get single disaster
GET /api/disasters/:id

# Create new disaster
POST /api/disasters
Body: {
  "title": "Emergency Title",
  "description": "Detailed description",
  "location_name": "Location Name",
  "severity": "high|moderate|low|critical",
  "status": "active|monitoring|resolved"
}

# Update disaster
PUT /api/disasters/:id
Body: { /* same as create */ }

# Delete disaster
DELETE /api/disasters/:id
```

### **Resources** 🏥
```bash
# Get all resources
GET /api/resources

# Create resource
POST /api/resources
Body: {
  "name": "Resource Name",
  "type": "shelter|medical|food|transport",
  "location_name": "Location",
  "capacity": 100,
  "contact_info": "Contact details",
  "availability_status": "available|limited|unavailable"
}
```

### **Reports** 📋
```bash
# Get all reports
GET /api/reports

# Submit new report
POST /api/reports
Body: {
  "title": "Report Title",
  "description": "What you observed",
  "location_name": "Where it happened",
  "report_type": "damage|need|resource",
  "priority": "high|medium|low"
}
```

### **Utility Endpoints** 🛠️
```bash
# Health check
GET /api/health

# Geocoding
POST /api/geocoding
Body: { "location": "Address or place name" }

# Social media simulation
GET /api/social-media/mock
```

## 💻 Testing the API

### PowerShell (Windows)
```powershell
# Health check
Invoke-WebRequest -Uri "http://localhost:3003/api/health" -Method GET

# Get disasters
Invoke-WebRequest -Uri "http://localhost:3003/api/disasters" -Method GET

# Create disaster
$body = @{
    title = "Test Disaster"
    description = "Testing API"
    severity = "high"
    status = "active"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3003/api/disasters" -Method POST -Body $body -ContentType "application/json"
```

### cURL (Linux/Mac/Windows with curl.exe)
```bash
# Health check
curl -X GET http://localhost:3003/api/health

# Get disasters
curl -X GET http://localhost:3003/api/disasters

# Create disaster
curl -X POST http://localhost:3003/api/disasters \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Disaster","description":"Testing","severity":"high","status":"active"}'
```

### Browser Testing
1. **Open**: http://localhost:3003/crud.html
2. **Use the interface** to:
   - ✏️ Create new disasters
   - 📋 View all disasters
   - ✏️ Edit existing disasters
   - 🗑️ Delete disasters

## 🔐 Authentication

**Current Implementation**: Simplified UUID-based authentication for development.

```javascript
// Fixed user UUID for all requests (development only)
const FIXED_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
```

**Production Recommendation**: Implement JWT or session-based authentication.

## 📊 Database Schema

### Disasters Table
```sql
CREATE TABLE disasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location_name VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  severity VARCHAR(50) CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  status VARCHAR(50) CHECK (status IN ('active', 'monitoring', 'resolved')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  audit_trail JSONB DEFAULT '[]'::jsonb
);
```

## 🚀 Real-time Features

### WebSocket Events
```javascript
// Client-side event listeners
socket.on('disaster_created', (data) => {
  console.log('New disaster:', data);
});

socket.on('disaster_updated', (data) => {
  console.log('Updated disaster:', data);
});

socket.on('disaster_deleted', (data) => {
  console.log('Deleted disaster:', data);
});
```

## 🧪 Testing Scripts

### Automated API Test
```bash
node test-frontend-insert.js
```

### Manual Testing Checklist
- [ ] Server starts without errors
- [ ] Database connection works
- [ ] All API endpoints respond
- [ ] CRUD operations function correctly
- [ ] Real-time events emit properly
- [ ] Frontend interface loads and works

## 🔧 Development

### Start Development Server
```bash
node start.js
```

### View Logs
```bash
# Real-time logs
tail -f logs/combined.log

# Error logs
tail -f logs/error.log
```

### Environment Variables Check
The startup script validates all required environment variables and provides clear error messages if any are missing.

## 🐛 Troubleshooting

### Common Issues

**1. "Database not configured" Error**
- Check `.env` file exists and has correct Supabase credentials
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set

**2. Server Won't Start**
- Ensure port 3003 is available
- Check Node.js version (v16+ recommended)
- Verify all dependencies are installed: `npm install`

**3. API Returns 500 Errors**
- Check server logs in `logs/error.log`
- Verify database connection
- Ensure Supabase project is active

**4. PowerShell curl Issues**
- Use `Invoke-WebRequest` instead of `curl`
- Or use `curl.exe` for actual curl syntax

## 📈 Future Enhancements

### Planned Features
- [ ] JWT Authentication system
- [ ] Advanced role-based permissions
- [ ] Real social media integration
- [ ] Mobile app support
- [ ] Advanced geospatial analytics
- [ ] ML-powered disaster prediction
- [ ] Multi-language support

### Performance Optimizations
- [ ] Redis caching implementation
- [ ] Database query optimization
- [ ] CDN integration
- [ ] Load balancing setup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

## 🎯 Quick Start Summary

```bash
# 1. Install dependencies
npm install

# 2. Setup environment file (.env)
# Add your Supabase credentials

# 3. Start the server
node start.js

# 4. Test the API
# Visit: http://localhost:3003/crud.html
# Or use PowerShell/curl commands above

# 5. Monitor logs
tail -f logs/combined.log
```

**🔥 Your disaster response platform is ready for action!** 🚀
