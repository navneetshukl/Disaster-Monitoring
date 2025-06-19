// Demo startup script for Disaster Response Platform
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Disaster Response Platform Demo...\n');

// Check if .env file exists
const envPath = join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found. Please copy .env.example to .env and configure your API keys.');
    process.exit(1);
}

// Start the server
console.log('📊 Starting backend server on port 3001...');
const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: __dirname
});

server.on('error', (error) => {
    console.error('❌ Failed to start server:', error.message);
});

server.on('exit', (code) => {
    console.log(`\n📊 Server exited with code ${code}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down demo...');
    server.kill('SIGINT');
    process.exit(0);
});

// Show helpful information
setTimeout(() => {
    console.log('\n📱 Demo Information:');
    console.log('   Frontend: http://localhost:3001');
    console.log('   API Base: http://localhost:3001/api');
    console.log('   Health Check: http://localhost:3001/api/health');
    console.log('\n🧪 To test APIs, run: npm run test');
    console.log('🛑 To stop demo, press Ctrl+C');
}, 2000);
