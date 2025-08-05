// index.js

import express from 'express';
import cors from 'cors';
import { supabase } from './supabaseClient.js';

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Root route
app.get('/', (req, res) => {
  res.send('✅ QR Backend API is running');
});

// ✅ Simple test endpoint (no database required)
app.get('/test', (req, res) => {
  res.json({
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    status: 'OK',
  });
});

// ✅ Debug endpoint to check database tables
app.get('/debug/tables', async (req, res) => {
  try {
    // Query to list all tables in the public schema
    const { data, error } = await supabase.rpc('get_tables');

    if (error) {
      console.error('Error fetching tables:', error);
      return res.status(500).json({ message: 'Error fetching tables', error });
    }

    res.json({
      message: 'Available tables in public schema',
      tables: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Debug endpoint to check today's duty data
app.get('/debug/duty-today', async (req, res) => {
  try {
    // Use today's date in YYYY-MM-DD format
    const dutyDate = new Date().toLocaleDateString('en-CA');

    const { data, error } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('duty_date', dutyDate)
      .order('hall_no', { ascending: true });

    if (error) {
      console.error('Error fetching duty data:', error);
      return res
        .status(500)
        .json({ message: 'Error fetching duty data', error });
    }

    res.json({
      message: `Duty data for ${dutyDate}`,
      date: dutyDate,
      count: data?.length || 0,
      data: data || [],
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Debug endpoint to check all duty data
app.get('/debug/duty-all', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_dashboard')
      .select('*')
      .order('duty_date', { ascending: false })
      .order('hall_no', { ascending: true });

    if (error) {
      console.error('Error fetching all duty data:', error);
      return res
        .status(500)
        .json({ message: 'Error fetching all duty data', error });
    }

    res.json({
      message: 'All duty data',
      count: data?.length || 0,
      data: data || [],
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Debug endpoint to search for specific mobile number
app.get('/debug/mobile/:mobile_number', async (req, res) => {
  try {
    const { mobile_number } = req.params;

    // Use today's date in YYYY-MM-DD format
    const dutyDate = new Date().toLocaleDateString('en-CA');

    // Search for mobile number
    const { data, error } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('mobile_number', mobile_number)
      .eq('duty_date', dutyDate);

    if (error) {
      console.error('Error searching for mobile:', error);
      return res
        .status(500)
        .json({ message: 'Error searching for mobile', error });
    }

    res.json({
      message: `Search results for mobile: ${mobile_number}`,
      date: dutyDate,
      count: data?.length || 0,
      data: data || [],
      currentTime: new Date().toTimeString().split(' ')[0],
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Debug endpoint to search for staff by name
app.get('/debug/search-staff/:name', async (req, res) => {
  try {
    const { name } = req.params;
    // Use today's date in YYYY-MM-DD format
    const dutyDate = new Date().toLocaleDateString('en-CA');

    // Search for exact match
    const { data: exactMatch, error: exactError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('assigned_staff_name', name)
      .eq('duty_date', dutyDate);

    // Search for partial match
    const { data: partialMatch, error: partialError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .ilike('assigned_staff_name', `%${name}%`)
      .eq('duty_date', dutyDate);

    res.json({
      message: 'Staff search results',
      searchName: name,
      date: dutyDate,
      exactMatch: {
        count: exactMatch?.length || 0,
        data: exactMatch || [],
        error: exactError,
      },
      partialMatch: {
        count: partialMatch?.length || 0,
        data: partialMatch || [],
        error: partialError,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Check if mobile number already exists in today's duty
app.get('/duty/check-mobile/:mobile_number', async (req, res) => {
  const { mobile_number } = req.params;

  // Use today's date in YYYY-MM-DD format
  const dutyDate = new Date().toLocaleDateString('en-CA');

  try {
    const { data, error } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('mobile_number', mobile_number)
      .eq('duty_date', dutyDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found"
      console.error('Error checking mobile:', error);
      return res
        .status(500)
        .json({ message: 'Error checking mobile number', error });
    }

    if (data) {
      // Mobile number exists - check status and determine next action
      const isProxy =
        data.reported_staff_name &&
        data.reported_staff_name !== data.assigned_staff_name;
      const isSubmitted = data.status === 'Submitted' || data.submission_time;
      const isReported = data.status === 'Reported' || data.checkin_time;

      return res.json({
        exists: true,
        isFirstTime: !isReported,
        isProxy: isProxy,
        isSubmitted: isSubmitted,
        shouldSubmitPapers: isReported && !isSubmitted && !isProxy,
        duty: data,
      });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Get staff by mobile number (for verification)
app.get('/staff/by-mobile/:mobile_number', async (req, res) => {
  const { mobile_number } = req.params;

  // Use today's date in YYYY-MM-DD format
  const dutyDate = new Date().toLocaleDateString('en-CA');

  // Check if this mobile exists in duty
  const { data, error } = await supabase
    .from('admin_dashboard')
    .select('*')
    .eq('mobile_number', mobile_number)
    .eq('duty_date', dutyDate)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res
        .status(404)
        .json({ message: `Staff not found for ${dutyDate}` });
    }
    console.error(error);
    return res.status(500).json({ message: 'Error fetching staff', error });
  }
  if (!data) {
    return res.status(404).json({ message: `Staff not found for ${dutyDate}` });
  }
  if (!data) {
    return res.status(404).json({ message: `Staff not found for ${dutyDate}` });
  }

  res.json({
    name: data.assigned_staff_name,
    department: data.department || 'Not specified',
    mobile_no: data.mobile_number,
    hall: data.hall_no,
    duty_date: data.duty_date,
  });
});

// ✅ Get today's duty assignments
app.get('/duty/today', async (req, res) => {
  // Use today's date in YYYY-MM-DD format
  const dutyDate = new Date().toLocaleDateString('en-CA');

  const { data, error } = await supabase
    .from('admin_dashboard')
    .select('*')
    .eq('duty_date', dutyDate)
    .order('hall_no', { ascending: true });

  if (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: 'Error fetching duty assignments', error });
  }

  // Map results to include department field as 'department' for frontend compatibility
  const mapped = (data || []).map((row) => ({
    ...row,
    department: row.dept || 'Not specified',
  }));
  res.json(mapped);
});

// ✅ Get all duty assignments (for admin dashboard)
app.get('/duty/all', async (req, res) => {
  const { data, error } = await supabase
    .from('admin_dashboard')
    .select('*')
    .order('duty_date', { ascending: false })
    .order('hall_no', { ascending: true });

  if (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: 'Error fetching duty assignments', error });
  }

  // Map results to include department field as 'department' for frontend compatibility
  const mapped = (data || []).map((row) => ({
    ...row,
    department: row.dept || 'Not specified',
  }));
  res.json(mapped);
});

// ✅ Report for duty (check-in) - Mobile number based
app.post('/duty/report', async (req, res) => {
  const { mobile_number } = req.body;
  const now = new Date();
  // Format time as HH:MM:SS for PostgreSQL time type
  const currentTime = now.toTimeString().split(' ')[0];

  // Use today's date in YYYY-MM-DD format
  const dutyDate = new Date().toLocaleDateString('en-CA');

  try {
    // Find the duty assignment by mobile number first
    const { data: dutyAssignment, error: dutyError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('mobile_number', mobile_number)
      .eq('duty_date', dutyDate)
      .single();

    if (dutyError) {
      console.error('Error finding duty assignment:', dutyError);
      return res.status(404).json({
        message: 'Duty assignment not found for this mobile number',
        details: `Mobile: ${mobile_number}, Date: ${dutyDate}`,
        error: dutyError,
      });
    }

    // Check if this staff has already checked in
    if (dutyAssignment.checkin_time) {
      // Already checked in - check if they should submit papers
      const isProxy =
        dutyAssignment.reported_staff_name &&
        dutyAssignment.reported_staff_name !==
          dutyAssignment.assigned_staff_name;
      const isSubmitted =
        dutyAssignment.status === 'Submitted' || dutyAssignment.submission_time;

      if (isSubmitted) {
        return res.status(400).json({
          message: 'Papers already submitted',
          alreadySubmitted: true,
          duty: dutyAssignment,
        });
      }

      // For proxy cases, allow submission (proxy staff can submit papers)
      if (isProxy) {
        return res.status(400).json({
          message: 'Proxy check-in found. Please proceed to submit papers.',
          shouldSubmitPapers: true,
          isProxy: true,
          duty: dutyAssignment,
        });
      }

      // Should submit papers
      return res.status(400).json({
        message: 'Already checked in. Please submit papers.',
        shouldSubmitPapers: true,
        duty: dutyAssignment,
      });
    }

    // Check if another staff from the same hall has already checked in
    const { data: hallCheck, error: hallError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('hall_no', dutyAssignment.hall_no)
      .eq('duty_date', dutyDate)
      .not('mobile_number', 'eq', mobile_number);

    console.log('Checking hall staff:', {
      hall_no: dutyAssignment.hall_no,
      current_mobile: mobile_number,
      hall_staff_count: hallCheck?.length || 0,
      hall_staff: hallCheck?.map((staff) => ({
        mobile: staff.mobile_number,
        name: staff.assigned_staff_name,
        checkin_time: staff.checkin_time,
        status: staff.status,
        reported_staff: staff.reported_staff_name,
      })),
    });

    if (hallCheck && hallCheck.length > 0) {
      const hallStaffCheckedIn = hallCheck.some(
        (staff) =>
          staff.checkin_time ||
          staff.status === 'Reported' ||
          staff.status === 'Proxy Reported' ||
          staff.reported_staff_name
      );

      console.log('Hall staff checked in:', hallStaffCheckedIn);

      if (hallStaffCheckedIn) {
        return res.status(400).json({
          message:
            'Papers have been collected for your hall. Please proceed to the exam centre.',
          papersCollected: true,
          duty: dutyAssignment,
        });
      }
    }

    // Update the duty with check-in information (first time)
    console.log('First time check-in:', {
      id: dutyAssignment.id,
      reported_staff_name: dutyAssignment.assigned_staff_name,
      checkin_time: currentTime,
      mobile_number: mobile_number,
      timestamp: now.toISOString(),
    });

    const { data, error } = await supabase
      .from('admin_dashboard')
      .update({
        reported_staff_name: dutyAssignment.assigned_staff_name, // Same as assigned
        checkin_time: currentTime,
        status: 'Reported',
      })
      .eq('id', dutyAssignment.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating duty:', error);
      return res
        .status(500)
        .json({ message: 'Error reporting for duty', error });
    }

    console.log('Successfully checked in:', data);

    res.json({
      message: 'Successfully checked in for duty',
      isFirstTime: true,
      duty: data,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Submit papers (submission)
app.post('/duty/submit', async (req, res) => {
  const { mobile_number } = req.body;
  const now = new Date();
  // Format time as HH:MM:SS for PostgreSQL time type
  const currentTime = now.toTimeString().split(' ')[0];

  // Use today's date in YYYY-MM-DD format
  const dutyDate = new Date().toLocaleDateString('en-CA');

  try {
    // Find the duty record for this mobile number
    const { data: dutyRecord, error: findError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('mobile_number', mobile_number)
      .eq('duty_date', dutyDate)
      .single();

    if (findError) {
      console.error('Error finding duty record:', findError);
      return res
        .status(404)
        .json({ message: 'Duty record not found for 04-08-2025' });
    }

    // Check if this is a proxy case - proxy staff can now submit papers
    const isProxy =
      dutyRecord.reported_staff_name &&
      dutyRecord.reported_staff_name !== dutyRecord.assigned_staff_name;

    // Note: Proxy staff can now submit papers, so we don't block them

    if (dutyRecord.submission_time) {
      return res.status(400).json({
        message: 'Papers already submitted',
        duty: dutyRecord,
      });
    }

    // Update with submission time
    console.log('Updating submission time:', {
      id: dutyRecord.id,
      submission_time: currentTime,
      mobile_number: mobile_number,
      timestamp: now.toISOString(),
    });

    const { data, error } = await supabase
      .from('admin_dashboard')
      .update({
        submission_time: currentTime,
        status: 'Submitted',
      })
      .eq('id', dutyRecord.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating submission:', error);
      return res
        .status(500)
        .json({ message: 'Error submitting papers', error });
    }

    console.log('Successfully updated submission time:', data);

    res.json({
      message: 'Successfully submitted papers',
      duty: data,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Proxy check-in for absent staff
app.post('/duty/proxy', async (req, res) => {
  const { absent_mobile_number, proxy_staff_name, emergency_reason } = req.body;

  // Use today's date in YYYY-MM-DD format
  const dutyDate = new Date().toLocaleDateString('en-CA');
  const now = new Date();
  // Format time as HH:MM:SS for PostgreSQL time type
  const currentTime = now.toTimeString().split(' ')[0];

  try {
    // Find the duty assignment for the absent staff using their mobile number
    const { data: dutyAssignment, error: dutyError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('mobile_number', absent_mobile_number)
      .eq('duty_date', dutyDate)
      .single();

    if (dutyError) {
      console.error('Error finding duty assignment:', dutyError);
      return res
        .status(404)
        .json({ message: 'Duty assignment not found for this mobile number' });
    }

    // Check if the absent staff's duty is already taken by someone else
    if (
      dutyAssignment.reported_staff_name &&
      dutyAssignment.reported_staff_name !== dutyAssignment.assigned_staff_name
    ) {
      return res
        .status(400)
        .json({ message: 'Duty already taken by another proxy staff' });
    }

    // Update with proxy information - only update reported_staff_name, keep mobile_number as absent staff's
    console.log('Updating proxy check-in:', {
      id: dutyAssignment.id,
      reported_staff_name: proxy_staff_name,
      mobile_number: dutyAssignment.mobile_number, // Keep absent staff's mobile number
      checkin_time: currentTime,
      timestamp: now.toISOString(),
    });

    const { data, error } = await supabase
      .from('admin_dashboard')
      .update({
        reported_staff_name: proxy_staff_name,
        checkin_time: currentTime,
        status: 'Proxy Reported',
        // DO NOT update mobile_number - keep the original absent staff's mobile number
      })
      .eq('id', dutyAssignment.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating duty with proxy:', error);
      return res
        .status(500)
        .json({ message: 'Error processing proxy check-in', error });
    }

    res.json({
      message: 'Successfully processed proxy check-in',
      duty: data,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Test endpoint to manually update check-in time
app.post('/debug/update-checkin/:mobile_number', async (req, res) => {
  try {
    const { mobile_number } = req.params;
    const now = new Date();
    // Format time as HH:MM:SS for PostgreSQL time type
    const currentTime = now.toTimeString().split(' ')[0];

    // Use today's date in YYYY-MM-DD format
    const dutyDate = new Date().toLocaleDateString('en-CA');

    console.log('Manual update attempt:', {
      mobile_number,
      currentTime,
      date: dutyDate,
      timestamp: now.toISOString(),
    });

    // Find the duty record
    const { data: dutyRecord, error: findError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('mobile_number', mobile_number)
      .eq('duty_date', dutyDate)
      .single();

    if (findError) {
      console.error('Error finding duty record:', findError);
      return res.status(404).json({
        message: 'Duty record not found',
        error: findError,
      });
    }

    console.log('Found duty record:', dutyRecord);

    // Update with check-in time
    const { data, error } = await supabase
      .from('admin_dashboard')
      .update({
        reported_staff_name: dutyRecord.assigned_staff_name,
        checkin_time: currentTime,
        status: 'Reported',
      })
      .eq('id', dutyRecord.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating duty:', error);
      return res.status(500).json({ message: 'Error updating duty', error });
    }

    console.log('Successfully updated duty record:', data);

    res.json({
      message: 'Successfully updated check-in time',
      duty: data,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Test endpoint to check database schema
app.get('/debug/schema', async (req, res) => {
  try {
    // Get a sample record to see the field types
    const { data, error } = await supabase
      .from('admin_dashboard')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching schema:', error);
      return res.status(500).json({ message: 'Error fetching schema', error });
    }

    res.json({
      message: 'Database schema sample',
      sampleRecord: data?.[0] || null,
      fieldTypes: data?.[0]
        ? Object.keys(data[0]).map((key) => ({
            field: key,
            value: data[0][key],
            type: typeof data[0][key],
          }))
        : [],
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Test endpoint to manually set check-in time for testing
app.post('/debug/set-checkin/:mobile_number', async (req, res) => {
  try {
    const { mobile_number } = req.params;
    const { checkin_time } = req.body;
    const now = new Date();

    // Use today's date in YYYY-MM-DD format
    const dutyDate = new Date().toLocaleDateString('en-CA');

    console.log('Manual set check-in time:', {
      mobile_number,
      checkin_time,
      timestamp: now.toISOString(),
    });

    // Find the duty record
    const { data: dutyRecord, error: findError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('mobile_number', mobile_number)
      .eq('duty_date', dutyDate)
      .single();

    if (findError) {
      console.error('Error finding duty record:', findError);
      return res.status(404).json({
        message: 'Duty record not found',
        error: findError,
      });
    }

    console.log('Found duty record:', dutyRecord);

    // Update with check-in time
    const { data, error } = await supabase
      .from('admin_dashboard')
      .update({
        reported_staff_name: dutyRecord.assigned_staff_name,
        checkin_time: checkin_time || now.toTimeString().split(' ')[0],
        status: 'Reported',
      })
      .eq('id', dutyRecord.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating duty:', error);
      return res.status(500).json({ message: 'Error updating duty', error });
    }

    console.log('Successfully updated duty record:', data);

    res.json({
      message: 'Successfully set check-in time',
      duty: data,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Test endpoint to verify time format and database connection
app.get('/debug/test-time', async (req, res) => {
  try {
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0];

    console.log('Testing time format:', {
      original: now.toTimeString(),
      formatted: timeString,
      timestamp: now.toISOString(),
    });

    // Test inserting a sample time into database
    const { data, error } = await supabase
      .from('admin_dashboard')
      .select('checkin_time, submission_time')
      .limit(1);

    res.json({
      message: 'Time format test',
      currentTime: timeString,
      databaseSample: data?.[0] || null,
      error: error,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Test endpoint to verify check-in time functionality
app.get('/debug/test-checkin/:mobile_number', async (req, res) => {
  try {
    const { mobile_number } = req.params;
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0];
    const dutyDate = new Date().toLocaleDateString('en-CA');

    console.log('Testing check-in time functionality:', {
      mobile_number,
      currentTime,
      dutyDate,
      timestamp: now.toISOString(),
    });

    // Find the duty record
    const { data: dutyRecord, error: findError } = await supabase
      .from('admin_dashboard')
      .select('*')
      .eq('mobile_number', mobile_number)
      .eq('duty_date', dutyDate)
      .single();

    if (findError) {
      return res.status(404).json({
        message: 'Duty record not found for testing',
        error: findError,
      });
    }

    // Test updating check-in time
    const { data, error } = await supabase
      .from('admin_dashboard')
      .update({
        reported_staff_name: dutyRecord.assigned_staff_name,
        checkin_time: currentTime,
        status: 'Reported',
      })
      .eq('id', dutyRecord.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        message: 'Error testing check-in time update',
        error,
      });
    }

    res.json({
      message: 'Check-in time test successful',
      originalRecord: dutyRecord,
      updatedRecord: data,
      testTime: currentTime,
      dutyDate: dutyDate,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ✅ Export if using server.js
export default app;
