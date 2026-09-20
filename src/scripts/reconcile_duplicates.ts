import { supabase } from '../lib/supabase/supabaseClient';

export async function runDataReconciliation() {
  console.log('========================================================================');
  console.log('VCTM ERP: RECONCILING DUPLICATE QUIZZES & ASSESSMENTS');
  console.log('========================================================================\n');

  // Authenticate as super admin
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tarunkushwah798@gmail.com',
    password: 'VctmAdmin@2026',
  });

  if (authErr || !auth.user) {
    throw new Error(`Authentication failed: ${authErr?.message}`);
  }
  console.log('✓ Authenticated as Super Admin:', auth.user.email);

  // ---------------------------------------------------------
  // 1. RECONCILE QUIZZES
  // ---------------------------------------------------------
  const { data: allQuizzes, error: qErr } = await supabase
    .from('quizzes')
    .select('*')
    .order('created_at', { ascending: true });

  if (qErr) throw qErr;

  const { data: allQuizResults } = await supabase.from('quiz_results').select('*');
  const resultsByQuizId = new Map<string, any[]>();
  for (const r of allQuizResults || []) {
    if (!resultsByQuizId.has(r.quiz_id)) resultsByQuizId.set(r.quiz_id, []);
    resultsByQuizId.get(r.quiz_id)!.push(r);
  }

  // Group quizzes by canonical key: subject_id :: section_id :: lower(trim(title))
  const quizGroups = new Map<string, any[]>();
  for (const q of allQuizzes || []) {
    const key = `${q.subject_id}::${q.section_id}::${(q.title || '').trim().toLowerCase()}`;
    if (!quizGroups.has(key)) quizGroups.set(key, []);
    quizGroups.get(key)!.push(q);
  }

  let deletedQuizzesCount = 0;
  for (const [key, items] of quizGroups.entries()) {
    if (items.length <= 1) continue;

    console.log(`\nReconciling duplicate quiz group: "${key}" (${items.length} records)`);

    // Pick canonical: prefer item with quiz_results, then published, then earliest created_at
    const sorted = [...items].sort((a, b) => {
      const aResults = resultsByQuizId.get(a.id)?.length || 0;
      const bResults = resultsByQuizId.get(b.id)?.length || 0;
      if (aResults !== bResults) return bResults - aResults;

      const aPub = a.status === 'published' ? 1 : 0;
      const bPub = b.status === 'published' ? 1 : 0;
      if (aPub !== bPub) return bPub - aPub;

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    console.log(`  -> Canonical ID: ${canonical.id} (status: ${canonical.status}, results: ${resultsByQuizId.get(canonical.id)?.length || 0})`);

    for (const dup of duplicates) {
      const dupResults = resultsByQuizId.get(dup.id) || [];
      if (dupResults.length > 0) {
        console.log(`  -> Migrating ${dupResults.length} quiz_results from ${dup.id} to ${canonical.id}...`);
        for (const res of dupResults) {
          // Re-link to canonical
          await supabase
            .from('quiz_results')
            .update({ quiz_id: canonical.id })
            .eq('id', res.id);
        }
      }

      console.log(`  -> Safely deleting redundant duplicate quiz: ${dup.id} (${dup.title})`);
      const { error: delErr } = await supabase.from('quizzes').delete().eq('id', dup.id);
      if (delErr) {
        console.warn(`    Warning deleting ${dup.id}:`, delErr.message);
      } else {
        deletedQuizzesCount++;
      }
    }
  }

  console.log(`\n✓ Quizzes reconciliation complete: ${deletedQuizzesCount} redundant rows removed.`);

  // ---------------------------------------------------------
  // 2. RECONCILE SESSIONAL ASSESSMENTS
  // ---------------------------------------------------------
  const { data: allSessionals, error: sErr } = await supabase
    .from('sessional_assessments')
    .select('*')
    .order('created_at', { ascending: true });

  if (sErr) throw sErr;

  const { data: allSessionalMarks } = await supabase.from('sessional_marks').select('*');
  const marksBySessionalId = new Map<string, any[]>();
  for (const m of allSessionalMarks || []) {
    if (!marksBySessionalId.has(m.sessional_assessment_id)) marksBySessionalId.set(m.sessional_assessment_id, []);
    marksBySessionalId.get(m.sessional_assessment_id)!.push(m);
  }

  // Group sessionals by canonical key: subject_id :: section_id :: lower(trim(title))
  const sessionalGroups = new Map<string, any[]>();
  for (const s of allSessionals || []) {
    const key = `${s.subject_id}::${s.section_id}::${(s.title || '').trim().toLowerCase()}`;
    if (!sessionalGroups.has(key)) sessionalGroups.set(key, []);
    sessionalGroups.get(key)!.push(s);
  }

  let deletedSessionalsCount = 0;
  for (const [key, items] of sessionalGroups.entries()) {
    if (items.length <= 1) continue;

    console.log(`\nReconciling duplicate sessional group: "${key}" (${items.length} records)`);

    // Pick canonical: prefer item with marks, then published, then earliest created_at
    const sorted = [...items].sort((a, b) => {
      const aMarks = marksBySessionalId.get(a.id)?.length || 0;
      const bMarks = marksBySessionalId.get(b.id)?.length || 0;
      if (aMarks !== bMarks) return bMarks - aMarks;

      const aPub = a.status === 'published' ? 1 : 0;
      const bPub = b.status === 'published' ? 1 : 0;
      if (aPub !== bPub) return bPub - aPub;

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    console.log(`  -> Canonical ID: ${canonical.id} (status: ${canonical.status}, marks: ${marksBySessionalId.get(canonical.id)?.length || 0})`);

    for (const dup of duplicates) {
      const dupMarks = marksBySessionalId.get(dup.id) || [];
      if (dupMarks.length > 0) {
        console.log(`  -> Migrating ${dupMarks.length} sessional_marks from ${dup.id} to ${canonical.id}...`);
        for (const m of dupMarks) {
          await supabase
            .from('sessional_marks')
            .update({ sessional_assessment_id: canonical.id })
            .eq('id', m.id);
        }
      }

      console.log(`  -> Safely deleting redundant duplicate sessional: ${dup.id} (${dup.title})`);
      const { error: delErr } = await supabase.from('sessional_assessments').delete().eq('id', dup.id);
      if (delErr) {
        console.warn(`    Warning deleting ${dup.id}:`, delErr.message);
      } else {
        deletedSessionalsCount++;
      }
    }
  }

  console.log(`\n✓ Sessionals reconciliation complete: ${deletedSessionalsCount} redundant rows removed.`);

  // ---------------------------------------------------------
  // 3. VERIFY ZERO DUPLICATES REMAIN
  // ---------------------------------------------------------
  const { data: finalQuizzes } = await supabase.from('quizzes').select('*');
  const finalQuizMap = new Map();
  for (const q of finalQuizzes || []) {
    const key = `${q.subject_id}::${q.section_id}::${q.title?.trim().toLowerCase()}`;
    finalQuizMap.set(key, (finalQuizMap.get(key) || 0) + 1);
  }
  const remainingQuizDups = Array.from(finalQuizMap.entries()).filter(([_, count]) => count > 1);

  const { data: finalSessionals } = await supabase.from('sessional_assessments').select('*');
  const finalSessMap = new Map();
  for (const s of finalSessionals || []) {
    const key = `${s.subject_id}::${s.section_id}::${s.title?.trim().toLowerCase()}`;
    finalSessMap.set(key, (finalSessMap.get(key) || 0) + 1);
  }
  const remainingSessDups = Array.from(finalSessMap.entries()).filter(([_, count]) => count > 1);

  console.log('\n========================================================================');
  console.log(`RECONCILIATION SUMMARY:`);
  console.log(`Remaining duplicate quiz groups: ${remainingQuizDups.length}`);
  console.log(`Remaining duplicate sessional groups: ${remainingSessDups.length}`);
  console.log(`Total canonical quizzes: ${finalQuizzes?.length}`);
  console.log(`Total canonical sessionals: ${finalSessionals?.length}`);
  console.log('========================================================================\n');

  if (remainingQuizDups.length > 0 || remainingSessDups.length > 0) {
    throw new Error('Reconciliation failed: duplicate groups still exist!');
  }
}

if (process.argv[1]?.includes('reconcile_duplicates')) {
  runDataReconciliation().catch(err => {
    console.error('Reconciliation error:', err);
    process.exit(1);
  });
}
