import pg from 'pg';

const connectionString = 'postgresql://postgres:Tarun%40759977@db.obssoojzryqiudllnlkh.supabase.co:5432/postgres';

async function checkColumnTypes() {
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();

    const res = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    const grouped: Record<string, any[]> = {};
    res.rows.forEach(r => {
      if (!grouped[r.table_name]) grouped[r.table_name] = [];
      grouped[r.table_name].push({
        col: r.column_name,
        type: r.data_type,
        default: r.column_default
      });
    });

    for (const [tbl, cols] of Object.entries(grouped)) {
      console.log(`\nTable: [${tbl}]`);
      console.table(cols);
    }

  } catch (err: any) {
    console.error('Postgres error:', err.message);
  } finally {
    await client.end();
  }
}

checkColumnTypes();
