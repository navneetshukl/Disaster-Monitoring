import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/database.js';
import { logger, logAction } from '../utils/logger.js';

const router = express.Router();

// Simple authentication middleware
const authenticate = (req, res, next) => {
  req.user = {
    id: '550e8400-e29b-41d4-a716-446655440000', // Fixed UUID for testing
    username: 'testuser',
    name: 'Test User',
    role: 'admin',
    email: 'test@disaster.response'
  };
  next();
};

// GET /api/reports - List reports with filtering
router.get('/', async (req, res) => {
  try {
    const { disaster_id, user_id, verification_status, limit = 50, offset = 0 } = req.query;
    
    let query = supabase
      .from('reports')
      .select(`
        *,
        disasters!disaster_id (
          id,
          title,
          location_name
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (disaster_id) {
      query = query.eq('disaster_id', disaster_id);
    }
    
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    
    if (verification_status) {
      query = query.eq('verification_status', verification_status);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Database error fetching reports:', error);
      return res.status(500).json({ error: 'Failed to fetch reports' });
    }

    logAction('reports_fetched', { 
      count: data?.length || 0, 
      filters: { disaster_id, user_id, verification_status } 
    });

    res.json({
      reports: data || [],
      total: count || 0,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });

  } catch (error) {
    logger.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/:id - Get specific report
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        disasters!disaster_id (
          id,
          title,
          location_name,
          description
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Report not found' });
    }

    logAction('report_viewed', { report_id: id });

    res.json(data);

  } catch (error) {
    logger.error('Error fetching report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports - Create new report
router.post('/', authenticate, async (req, res) => {
  try {
    const { disaster_id, content, image_url } = req.body;

    // Validation
    if (!disaster_id || !content) {
      return res.status(400).json({ 
        error: 'disaster_id and content are required' 
      });
    }

    if (content.length < 10) {
      return res.status(400).json({ 
        error: 'Content must be at least 10 characters long' 
      });
    }

    // Check if disaster exists
    const { data: disaster, error: disasterError } = await supabase
      .from('disasters')
      .select('id, title')
      .eq('id', disaster_id)
      .single();

    if (disasterError || !disaster) {
      return res.status(404).json({ error: 'Disaster not found' });
    }

    const reportId = uuidv4();
    
    // Create report record
    const reportData = {
      id: reportId,
      disaster_id,
      user_id: req.user.id,
      content,
      image_url,
      verification_status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('reports')
      .insert(reportData)
      .select(`
        *,
        disasters!disaster_id (
          id,
          title,
          location_name
        )
      `)
      .single();

    if (error) {
      logger.error('Database error creating report:', error);
      return res.status(500).json({ error: 'Failed to create report' });
    }

    logAction('report_created', { 
      report_id: reportId, 
      disaster_id,
      content_preview: content.substring(0, 100),
      has_image: !!image_url,
      created_by: req.user.id 
    });

    // Automatically verify image if provided
    if (image_url) {
      try {
        const verification = await GeminiService.verifyDisasterImage(image_url, content);
        
        // Update verification status based on Gemini analysis
        const newStatus = verification.authenticity === 'verified' ? 'verified' : 
                          verification.authenticity === 'suspicious' ? 'pending' : 'rejected';
        
        await supabase
          .from('reports')
          .update({ verification_status: newStatus })
          .eq('id', reportId);

        data.verification_status = newStatus;
        
        logAction('report_auto_verified', { 
          report_id: reportId, 
          verification_result: verification.authenticity,
          confidence: verification.confidence
        });
      } catch (error) {
        logger.error('Auto-verification error:', error);
      }
    }

    // Emit real-time update
    req.io.emit('report_created', {
      action: 'created',
      report: data,
      disaster_id,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(data);

  } catch (error) {
    logger.error('Error creating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/reports/:id/verify - Update report verification status
router.put('/:id/verify', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_status, notes } = req.body;

    // Only admins can manually verify reports
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Validate verification status
    const validStatuses = ['pending', 'verified', 'rejected'];
    if (!validStatuses.includes(verification_status)) {
      return res.status(400).json({ 
        error: 'Invalid verification status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Check if report exists
    const { data: existingReport, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Update verification status
    const { data, error } = await supabase
      .from('reports')
      .update({ 
        verification_status,
        verified_at: verification_status !== 'pending' ? new Date().toISOString() : null,
        verified_by: verification_status !== 'pending' ? req.user.id : null,
        verification_notes: notes || null
      })
      .eq('id', id)
      .select(`
        *,
        disasters!disaster_id (
          id,
          title,
          location_name
        )
      `)
      .single();

    if (error) {
      logger.error('Database error updating report verification:', error);
      return res.status(500).json({ error: 'Failed to update verification status' });
    }

    logAction('report_verified', { 
      report_id: id, 
      verification_status,
      verified_by: req.user.id,
      notes 
    });

    // Emit real-time update
    req.io.emit('report_verified', {
      action: 'verified',
      report: data,
      verification_status,
      timestamp: new Date().toISOString()
    });

    res.json(data);

  } catch (error) {
    logger.error('Error updating report verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/reports/:id - Delete report
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if report exists
    const { data: existingReport, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Only report owner or admin can delete
    if (existingReport.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Database error deleting report:', error);
      return res.status(500).json({ error: 'Failed to delete report' });
    }

    logAction('report_deleted', { 
      report_id: id, 
      disaster_id: existingReport.disaster_id,
      deleted_by: req.user.id 
    });

    // Emit real-time update
    req.io.emit('report_deleted', {
      action: 'deleted',
      report_id: id,
      disaster_id: existingReport.disaster_id,
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Report deleted successfully' });

  } catch (error) {
    logger.error('Error deleting report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/stats - Get report statistics
router.get('/stats', async (req, res) => {
  try {
    const { disaster_id } = req.query;

    let query = supabase
      .from('reports')
      .select('verification_status, created_at, user_id');

    if (disaster_id) {
      query = query.eq('disaster_id', disaster_id);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Database error fetching report stats:', error);
      return res.status(500).json({ error: 'Failed to fetch report statistics' });
    }

    const reports = data || [];
    
    const stats = {
      total_reports: reports.length,
      verified_reports: reports.filter(r => r.verification_status === 'verified').length,
      pending_reports: reports.filter(r => r.verification_status === 'pending').length,
      rejected_reports: reports.filter(r => r.verification_status === 'rejected').length,
      unique_reporters: [...new Set(reports.map(r => r.user_id))].length,
      reports_last_24h: reports.filter(r => 
        new Date(r.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
      disaster_id: disaster_id || null
    };

    res.json(stats);

  } catch (error) {
    logger.error('Error fetching report stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
