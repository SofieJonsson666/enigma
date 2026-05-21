// ══════════════════════════════════════════════
//  SUPABASE CONFIG
//  All database connection setup lives here.
//  To change your Supabase project, update
//  SUPA_URL and SUPA_KEY below.
// ══════════════════════════════════════════════

const SUPA_URL = 'https://nzqqbigzuxdqyjszpnpy.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56cXFiaWd6dXhkcXlqc3pwbnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTIwNjYsImV4cCI6MjA5NDE2ODA2Nn0.87RRIFXvn34Au_denSm5W_XvIaxcwr6gMmSYXC_BOGc';
const EDGE_FUNCTION_URL = 'https://nzqqbigzuxdqyjszpnpy.supabase.co/functions/v1/admin-auth';

const db = supabase.createClient(SUPA_URL, SUPA_KEY);
