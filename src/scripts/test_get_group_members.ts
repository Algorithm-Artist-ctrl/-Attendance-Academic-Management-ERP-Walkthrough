import pg from "pg";
import path from "path";
import fs from "fs";

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      if (line.startsWith('DATABASE_URL=')) {
        connectionString = line.split('DATABASE_URL=')[1].trim().replace(/['"]/g, '');
      }
    }
  }
}

async function check() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const groupId = '88bf42e7-d461-45d9-a4a9-68d9d03a1356';
  const authId = '4743eb90-0e7e-4ba6-875e-ee3348a1de72';

  await client.query('BEGIN');
  await client.query(`SET LOCAL "request.jwt.claim.sub" = '${authId}';`);
  await client.query(`SET LOCAL "request.jwt.claim.role" = 'authenticated';`);
  
  try {
    const res = await client.query(`SELECT public.get_group_members($1) as members;`, [groupId]);
    const members = res.rows[0].members;
    console.log(`✅ get_group_members returned ${members ? members.length : 0} members!`);
    if (members && members.length > 0) {
      console.log("Sample member:", members[0]);
    }
  } catch (err: any) {
    console.error("Error in get_group_members:", err.message);
  }
  await client.query('ROLLBACK');

  await client.end();
}

check().catch(console.error);
