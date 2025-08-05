# Backend Setup Guide

## Quick Setup

1. **Create Environment File**
   Create a `.env` file in the backend directory with your Supabase credentials:

   ```
   SUPABASE_URL=your_supabase_project_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   PORT=3000
   ```

2. **Get Supabase Credentials**

   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy the "Project URL" and "anon public" key
   - Paste them in the .env file

3. **Start the Server**

   ```bash
   cd backend
   npm start
   ```

4. **Test the Connection**
   ```bash
   curl http://localhost:3000/test
   ```

## Database Tables Required

Make sure you have these tables in your Supabase database:

```sql
create table public.admin_dashboard (
  id serial not null,
  duty_date date not null,
  assigned_staff_name character varying(100) not null,
  reported_staff_name character varying(100) null,
  hall_no character varying(20) null,
  mobile_number character varying(15) not null,
  checkin_time time without time zone null,
  submission_time time without time zone null,
  status character varying(20) null default 'Not Reported'::character varying,
  constraint admin_dashboard_pkey primary key (id)
);

create table public.staff_duty (
  name character varying(100) not null,
  mobile_number character varying(15) not null,
  department character varying(50) null,
  constraint staff_duty_mobile_number_key unique (mobile_number)
);
```

## Troubleshooting

- **"Backend not running"**: Make sure the server is started with `npm start`
- **"Database connection error"**: Check your .env file and Supabase credentials
- **"Staff not found"**: Ensure staff data exists in the admin_dashboard table
- **"Proxy mobile not found"**: The proxy staff must exist in the database

## API Endpoints

- `GET /` - Health check
- `GET /test` - Simple test (no database required)
- `GET /duty/check-mobile/:mobile_number` - Check mobile number status
- `POST /duty/report` - Check-in for duty
- `POST /duty/submit` - Submit papers
- `POST /duty/proxy` - Proxy check-in
- `GET /duty/today` - Get today's duty assignments
- `GET /duty/all` - Get all duty assignments
