import { supabase } from '../lib/supabase/supabaseClient';

/**
 * Deletes all demo attendance data from the Supabase instance.
 * Adjust `cutoffDate` if you need to preserve any historical real data.
 */
const cleanup = async () => {
  const cutoffDate = '1970-01-01'; // earliest possible date
  const tables = ['attendance_sessions', 'attendance_records', 'attendance_corrections'];
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .delete()
      .lt('created_at', cutoffDate)
      .select('id', { count: 'exact' });
    if (error) {
      console.error(`Failed to delete from ${table}:`, error);
      process.exit(1);
    }
    console.log(`Deleted ${count} rows from ${table}`);
  }
  console.log('Fake attendance cleanup complete.');
  process.exit(0);
};

cleanup();
