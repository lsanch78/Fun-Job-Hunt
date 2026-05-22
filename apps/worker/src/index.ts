import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

console.log('EffJobHunt worker starting…');

const { error } = await supabase.from('job_postings').select('id').limit(1);
if (error) {
  console.error('Supabase connection failed:', error.message);
  process.exit(1);
}

console.log('Supabase connection OK');
