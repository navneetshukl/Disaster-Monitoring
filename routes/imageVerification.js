import express from 'express';
import multer from 'multer';
import { GeminiService } from '../services/gemini.js';
import { logger, logAction } from '../utils/logger.js';

const router = express.Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// POST /api/image-verification/verify - Verify disaster image
router.post('/verify', upload.single('image'), async (req, res) => {
  try {
    const { description, image_url } = req.body;
    const uploadedFile = req.file;

    // Validate input
    if (!uploadedFile && !image_url) {
      return res.status(400).json({ 
        error: 'Either upload an image file or provide image_url' 
      });
    }

    if (!description) {
      return res.status(400).json({ 
        error: 'description is required for image verification' 
      });
    }

    let imageData;
    let imageSource;

    if (uploadedFile) {
      // Convert uploaded file to base64
      imageData = uploadedFile.buffer.toString('base64');
      imageSource = 'uploaded_file';
    } else {
      // Use provided URL
      imageData = image_url;
      imageSource = 'url';
    }

    // Verify image with Gemini AI
    const verificationResult = await GeminiService.verifyDisasterImage(imageData, description);

    // Log verification attempt
    logAction('image_verification_requested', {
      image_source: imageSource,
      description_preview: description.substring(0, 100),
      file_size: uploadedFile ? uploadedFile.size : null,
      file_type: uploadedFile ? uploadedFile.mimetype : null,
      authenticity: verificationResult.authenticity,
      confidence: verificationResult.confidence
    });

    const response = {
      verification_result: verificationResult,
      input: {
        description,
        image_source: imageSource,
        file_info: uploadedFile ? {
          size: uploadedFile.size,
          type: uploadedFile.mimetype,
          name: uploadedFile.originalname
        } : null,
        image_url: image_url || null
      },
      verified_at: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    logger.error('Image verification error:', error);
    
    // Handle specific multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed.' });
      }
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ 
      error: 'Image verification failed',
      details: error.message
    });
  }
});

// POST /api/image-verification/verify-url - Verify disaster image from URL
router.post('/verify-url', async (req, res) => {
  try {
    const { image_url, description } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: 'image_url is required' });
    }

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Validate URL format
    try {
      new URL(image_url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid image URL format' });
    }

    // Verify image
    const verificationResult = await GeminiService.verifyDisasterImage(image_url, description);

    logAction('image_url_verification_requested', {
      image_url,
      description_preview: description.substring(0, 100),
      authenticity: verificationResult.authenticity,
      confidence: verificationResult.confidence
    });

    res.json({
      verification_result: verificationResult,
      input: {
        image_url,
        description
      },
      verified_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Image URL verification error:', error);
    res.status(500).json({ 
      error: 'Image verification failed',
      details: error.message
    });
  }
});

// POST /api/image-verification/batch-verify - Batch verify multiple images
router.post('/batch-verify', async (req, res) => {
  try {
    const { images } = req.body;

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ 
        error: 'images array is required' 
      });
    }

    if (images.length > 5) {
      return res.status(400).json({ 
        error: 'Maximum 5 images allowed per batch request' 
      });
    }

    // Validate each image object
    for (const [index, image] of images.entries()) {
      if (!image.image_url) {
        return res.status(400).json({ 
          error: `images[${index}].image_url is required` 
        });
      }
      if (!image.description) {
        return res.status(400).json({ 
          error: `images[${index}].description is required` 
        });
      }
    }

    const verificationPromises = images.map(async (image, index) => {
      try {
        const result = await GeminiService.verifyDisasterImage(
          image.image_url, 
          image.description
        );

        return {
          index,
          image_url: image.image_url,
          description: image.description,
          success: true,
          verification_result: result
        };
      } catch (error) {
        return {
          index,
          image_url: image.image_url,
          description: image.description,
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(verificationPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    // Log batch verification
    logAction('batch_image_verification_completed', {
      total_images: images.length,
      successful_verifications: successful.length,
      failed_verifications: failed.length,
      verified_count: successful.filter(r => r.verification_result?.authenticity === 'verified').length,
      suspicious_count: successful.filter(r => r.verification_result?.authenticity === 'suspicious').length,
      fake_count: successful.filter(r => r.verification_result?.authenticity === 'fake').length
    });

    res.json({
      batch_results: results,
      summary: {
        total_images: images.length,
        successful: successful.length,
        failed: failed.length,
        success_rate: `${Math.round(successful.length / images.length * 100)}%`,
        verification_breakdown: {
          verified: successful.filter(r => r.verification_result?.authenticity === 'verified').length,
          suspicious: successful.filter(r => r.verification_result?.authenticity === 'suspicious').length,
          fake: successful.filter(r => r.verification_result?.authenticity === 'fake').length
        }
      },
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Batch image verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/image-verification/test - Test image verification with sample data
router.get('/test', async (req, res) => {
  try {
    // Sample test cases with mock image URLs
    const testCases = [
      {
        image_url: 'https://example.com/flood-image1.jpg',
        description: 'Severe flooding in downtown area after heavy rainfall',
        expected: 'verified'
      },
      {
        image_url: 'https://example.com/fire-image1.jpg',
        description: 'Wildfire spreading through residential area',
        expected: 'verified'
      },
      {
        image_url: 'https://example.com/suspicious-image1.jpg',
        description: 'Earthquake damage to building',
        expected: 'suspicious'
      }
    ];

    const testResults = [];

    for (const [index, testCase] of testCases.entries()) {
      try {
        const result = await GeminiService.verifyDisasterImage(
          testCase.image_url, 
          testCase.description
        );

        testResults.push({
          test_case: index + 1,
          input: {
            image_url: testCase.image_url,
            description: testCase.description,
            expected: testCase.expected
          },
          success: true,
          verification_result: result,
          matches_expected: result.authenticity === testCase.expected
        });
      } catch (error) {
        testResults.push({
          test_case: index + 1,
          input: {
            image_url: testCase.image_url,
            description: testCase.description,
            expected: testCase.expected
          },
          success: false,
          error: error.message
        });
      }
    }

    const successfulTests = testResults.filter(r => r.success);
    const matchingResults = testResults.filter(r => r.success && r.matches_expected);

    logAction('image_verification_test_completed', {
      total_tests: testResults.length,
      successful_tests: successfulTests.length,
      matching_expected: matchingResults.length
    });

    res.json({
      test_results: testResults,
      summary: {
        total_tests: testResults.length,
        successful: successfulTests.length,
        failed: testResults.length - successfulTests.length,
        matching_expected: matchingResults.length,
        success_rate: `${Math.round(successfulTests.length / testResults.length * 100)}%`,
        accuracy_rate: `${Math.round(matchingResults.length / successfulTests.length * 100)}%`
      },
      tested_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Image verification test error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/image-verification/stats - Get verification statistics
router.get('/stats', async (req, res) => {
  try {
    // In a real implementation, this would query the database
    // For now, return mock statistics
    const stats = {
      total_verifications: 1247,
      verified_images: 892,
      suspicious_images: 203,
      fake_images: 152,
      verification_rate: {
        verified: '71.5%',
        suspicious: '16.3%',
        fake: '12.2%'
      },
      processing_stats: {
        average_processing_time_ms: 2340,
        total_processing_time_hours: 48.7,
        success_rate: '97.8%'
      },
      recent_activity: {
        verifications_last_24h: 156,
        verifications_last_7d: 1089,
        trending_verification_types: [
          { type: 'flood', count: 89 },
          { type: 'fire', count: 67 },
          { type: 'earthquake', count: 45 }
        ]
      },
      generated_at: new Date().toISOString()
    };

    res.json(stats);

  } catch (error) {
    logger.error('Error fetching verification stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handler for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed.' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({ error: 'Only image files are allowed' });
  }
  
  next(error);
});

export default router;
