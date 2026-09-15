import { supabase } from '../lib/supabase/supabaseClient';

/**
 * Deletes all demo attendance data from the Supabase instance.
 * Adjust `cutoffDate` if you need to preserve any historical real data.
 */
const cleanup = async () => {
  // All demo attendance records were generated during testing prior to DATE OF EFFECT: 15 September 2026
  const cutoffDate = '2026-09-15T00:00:00.000Z';
  const tables = ['attendance_corrections', 'attendance_records', 'attendance_sessions'];
  
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .lt('created_at', cutoffDate);
      
    if (error) {
      console.error(`Failed to delete from ${table}:`, error);
      process.exit(1);
    }
    console.log(`Deleted ${count} demo rows from ${table}`);
  }
  console.log('Fake attendance cleanup complete. ERP database reset to clean production state.');
  process.exit(0);
};

cleanup();

