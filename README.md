# Disaster Response Coordination Platform

A comprehensive backend-heavy MERN stack disaster response coordination platform with real-time WebSocket updates, geospatial queries, and external API integrations.

## 🏗️ Architecture Overview

### Backend Stack
- **Node.js** with **Express.js** - REST API server
- **Socket.IO** - Real-time WebSocket communication
- **Supabase** (PostgreSQL) - Database with geospatial support
- **PostGIS** - Geospatial queries and indexing

### External Integrations
- **Google Gemini API** - AI-powered location extraction and image verification
- **Mapping Services** - Google Maps, Mapbox, OpenStreetMap for geocoding
- **Mock Twitter API** - Social media disaster monitoring simulation
- **Web Scraping** - Official updates from government sources

### Frontend
- **Minimal HTML/CSS/JS** - Testing interface for backend APIs
- **Tailwind CSS** - Styling framework
- **Real-time Updates** - WebSocket integration

## 🚀 Features

### Core Functionality
- **Disaster Management** - CRUD operations with geolocation
- **Resource Mapping** - Geospatial resource discovery and management
- **Citizen Reports** - User-submitted reports with image verification
- **Real-time Updates** - Live notifications via WebSocket
- **Social Media Monitoring** - AI-powered disaster-related content analysis
- **Official Updates** - Automated scraping and aggregation

### Advanced Features
- **Geospatial Queries** - PostGIS-powered location-based searches
- **Image Verification** - AI-powered authenticity checking
- **Caching System** - Redis-like caching with TTL support
- **Rate Limiting** - Request throttling and abuse prevention
- **Audit Trails** - Complete change history tracking
- **Role-based Access** - Admin, responder, and citizen permissions

## 📁 Project Structure

```
citymall/
├── server.js                 # Main Express server
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables
├── database/
│   └── setup.sql           # Database schema and sample data
├── services/
│   ├── database.js         # Supabase client and utilities
│   ├── gemini.js          # Google Gemini AI integration
│   ├── geocoding.js       # Multi-provider geocoding service
│   ├── socialMedia.js     # Social media monitoring service
│   └── officialUpdates.js # Official updates scraping service
├── routes/
│   ├── disasters.js       # Disaster CRUD endpoints
│   ├── resources.js       # Resource management endpoints
│   ├── reports.js         # Citizen report endpoints
│   ├── socialMedia.js     # Social media API endpoints
│   ├── officialUpdates.js # Official updates endpoints
│   ├── geocoding.js       # Geocoding API endpoints
│   └── imageVerification.js # Image verification endpoints
├── utils/
│   └── logger.js          # Winston logging configuration
└── public/
    ├── index.html         # Frontend testing interface
    └── app.js            # Frontend JavaScript
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- Supabase account
- Google Gemini API key
- (Optional) Google Maps API key
- (Optional) Mapbox access token

### 1. Environment Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and configure:
   ```env
   # Database
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key

   # AI Services
   GEMINI_API_KEY=your_google_gemini_api_key

   # Mapping Services (Optional)
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   MAPBOX_ACCESS_TOKEN=your_mapbox_token

   # Server Configuration
   PORT=3000
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   CACHE_TTL=3600
   ```

### 2. Database Setup

1. Create a new Supabase project
2. Run the SQL setup script in your Supabase SQL editor:
   ```sql
   -- Copy contents of database/setup.sql
   ```
3. Enable PostGIS extension in Supabase dashboard

### 3. Running the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## 📡 API Documentation

### Authentication
All API requests require a mock user ID header:
```
x-user-id: admin1|responder1|citizen1
```

### Core Endpoints

#### Disasters
- `GET /api/disasters` - List all disasters
- `POST /api/disasters` - Create new disaster
- `GET /api/disasters/:id` - Get specific disaster
- `PUT /api/disasters/:id` - Update disaster
- `DELETE /api/disasters/:id` - Delete disaster

#### Resources
- `GET /api/resources` - List resources
- `POST /api/resources` - Create resource
- `GET /api/resources/nearby` - Find nearby resources
- `PUT /api/resources/:id` - Update resource
- `DELETE /api/resources/:id` - Delete resource

#### Reports
- `GET /api/reports` - List reports
- `POST /api/reports` - Submit new report
- `PUT /api/reports/:id/verify` - Verify report (admin only)
- `DELETE /api/reports/:id` - Delete report

#### Social Media
- `GET /api/social-media/:disaster_id` - Get social media reports
- `GET /api/social-media/:disaster_id/stream` - SSE stream
- `GET /api/social-media/:disaster_id/priority` - High priority posts
- `POST /api/social-media/:disaster_id/analyze` - Analyze content

#### Official Updates
- `GET /api/official-updates/:disaster_id` - Get official updates
- `GET /api/official-updates/:disaster_id/critical` - Critical updates only
- `GET /api/official-updates/sources` - Available sources
- `POST /api/official-updates/:disaster_id/scrape` - Manual scraping

#### Geocoding
- `POST /api/geocoding/geocode` - Geocode location
- `POST /api/geocoding/reverse` - Reverse geocode
- `POST /api/geocoding/extract-and-geocode` - Extract + geocode
- `GET /api/geocoding/providers` - Available providers

#### Image Verification
- `POST /api/image-verification/verify` - Verify uploaded image
- `POST /api/image-verification/verify-url` - Verify image URL
- `POST /api/image-verification/batch-verify` - Batch verification
- `GET /api/image-verification/test` - Test verification

## 🧪 Testing the Backend

### Frontend Interface
1. Start the server: `npm start`
2. Open `http://localhost:3000` in your browser
3. Use the testing interface to interact with all APIs

### WebSocket Testing
The interface automatically connects to WebSocket and displays real-time updates for:
- New disasters created
- Resources added
- Reports submitted
- Verification status changes

### API Testing Features
- **Connection Status** - Real-time API and WebSocket status
- **Individual API Testing** - Test each endpoint separately
- **Real-time Updates Feed** - See live events as they happen
- **Keyboard Shortcuts** - Ctrl+Enter (run all tests), Ctrl+Backspace (clear)

## 🔧 Configuration Options

### Rate Limiting
- Default: 100 requests per 15 minutes
- Configurable via environment variables

### Caching
- TTL-based caching for external API calls
- Automatic cleanup of expired entries
- Configurable cache duration

### Logging
- Structured logging with Winston
- Console and file output
- Configurable log levels

### Security
- Helmet.js for security headers
- CORS configuration
- Input validation with Joi
- File upload size limits

## 🌐 External API Integration

### Google Gemini AI
- Location extraction from text
- Image authenticity verification
- Social media content analysis
- Configurable confidence thresholds

### Geocoding Services
- Primary: Google Maps (if API key provided)
- Fallback: Mapbox (if token provided)
- Final fallback: OpenStreetMap (always available)
- Automatic provider switching on failures

### Social Media Monitoring
- Mock Twitter API implementation
- Priority scoring algorithm
- Real-time streaming simulation
- Content relevance analysis

## 📊 Database Schema

### Key Tables
- **disasters** - Main disaster records with geospatial data
- **resources** - Emergency resources with location indexing
- **reports** - Citizen-submitted reports with verification
- **cache** - TTL-based cache for external APIs

### Geospatial Features
- PostGIS GEOGRAPHY columns
- Spatial indexing for fast queries
- Distance-based resource discovery
- Proximity calculations

## 🚀 Deployment

### Production Considerations
- Set `NODE_ENV=production`
- Configure proper database connection pooling
- Set up SSL/TLS certificates
- Configure reverse proxy (nginx)
- Set up monitoring and logging
- Configure backup strategies

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review API documentation
3. Open an issue with detailed information

---

**Built with ❤️ for disaster response and emergency management**
