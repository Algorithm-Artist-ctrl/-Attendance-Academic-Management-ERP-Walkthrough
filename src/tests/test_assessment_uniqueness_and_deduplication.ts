import { supabase } from '../lib/supabase/supabaseClient';
import { supabaseService } from '../lib/services/supabaseService';

async function runTests() {
  console.log('🚀 Starting Assessment Uniqueness & Deduplication Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // Authenticate as Super Admin for DB access
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'tarunkushwah798@gmail.com',
      password: 'VctmAdmin@2026',
    });
    if (authErr || !authData.user) {
      throw new Error('Super admin authentication failed: ' + authErr?.message);
    }
    console.log('✓ Authenticated as Super Admin\n');

    // -------------------------------------------------------------
    // Test 1: Verify 0 Duplicates in Live Database
    // -------------------------------------------------------------
    console.log('1. Verifying Zero Duplicates in Live Supabase Database...');
    const { data: allQuizzes, error: qErr } = await supabase
      .from('quizzes')
      .select('id, title, subject_id, section_id, status');
    assert(!qErr, 'Fetched quizzes without DB error');

    const quizGroups: Record<string, string[]> = {};
    for (const q of allQuizzes || []) {
      const key = `${q.subject_id}_${q.section_id}_${(q.title || '').trim().toLowerCase()}`;
      if (!quizGroups[key]) quizGroups[key] = [];
      quizGroups[key].push(q.id);
    }
    const dupQuizzes = Object.entries(quizGroups).filter(([_, ids]) => ids.length > 1);
    assert(dupQuizzes.length === 0, `0 duplicate quiz groups found across database (found: ${dupQuizzes.length})`);

    const { data: allSessionals, error: sErr } = await supabase
      .from('sessional_assessments')
      .select('id, title, subject_id, section_id, status');
    assert(!sErr, 'Fetched sessional assessments without DB error');

    const sessionalGroups: Record<string, string[]> = {};
    for (const sa of allSessionals || []) {
      const key = `${sa.subject_id}_${sa.section_id}_${(sa.title || '').trim().toLowerCase()}`;
      if (!sessionalGroups[key]) sessionalGroups[key] = [];
      sessionalGroups[key].push(sa.id);
    }
    const dupSessionals = Object.entries(sessionalGroups).filter(([_, ids]) => ids.length > 1);
    assert(dupSessionals.length === 0, `0 duplicate sessional groups found across database (found: ${dupSessionals.length})`);

    // -------------------------------------------------------------
    // Test 2: Verify Idempotency of ensureDefaultAssessments
    // -------------------------------------------------------------
    console.log('\n2. Testing Idempotency of ensureDefaultAssessments...');
    // Find an active subject, section, and faculty
    const { data: testFSA } = await supabase
      .from('faculty_subject_assignments')
      .select('faculty_id, subject_id, section_id')
      .eq('active', true)
      .limit(1);

    if (testFSA && testFSA.length > 0) {
      const { faculty_id, subject_id, section_id } = testFSA[0];

      // Run ensureDefaultAssessments twice
      const run1 = await supabaseService.ensureDefaultAssessments({
        subjectId: subject_id,
        sectionId: section_id,
        facultyId: faculty_id,
      });

      const run2 = await supabaseService.ensureDefaultAssessments({
        subjectId: subject_id,
        sectionId: section_id,
        facultyId: faculty_id,
      });

      assert(run1.sessionals.length >= 3, `Run 1 ensured at least 3 sessionals (got ${run1.sessionals.length})`);
      assert(run1.quizzes.length >= 5, `Run 1 ensured at least 5 quizzes (got ${run1.quizzes.length})`);
      assert(run2.sessionals.length === run1.sessionals.length, `Run 2 did not create new sessionals (${run2.sessionals.length} === ${run1.sessionals.length})`);
      assert(run2.quizzes.length === run1.quizzes.length, `Run 2 did not create new quizzes (${run2.quizzes.length} === ${run1.quizzes.length})`);

      // Verify each assessment has a unique title
      const sessionalTitles = new Set(run2.sessionals.map(s => (s.title || '').trim().toLowerCase()));
      assert(sessionalTitles.size === run2.sessionals.length, 'All sessionals have unique titles');

      const quizTitles = new Set(run2.quizzes.map(q => (q.title || '').trim().toLowerCase()));
      assert(quizTitles.size === run2.quizzes.length, 'All quizzes have unique titles');

      // Verify Quiz 1-5 and Sessional 1-3 have distinct IDs
      const allIds = new Set([...run2.sessionals.map(s => s.id), ...run2.quizzes.map(q => q.id)]);
      assert(allIds.size === (run2.sessionals.length + run2.quizzes.length), 'All sessionals and quizzes have mutually distinct IDs');
    } else {
      console.warn('  ⚠️ Skipping live ensureDefaultAssessments test: No faculty subject assignment found.');
    }

    // -------------------------------------------------------------
    // Test 3: Verify Duplicate Rejection on Direct Create
    // -------------------------------------------------------------
    console.log('\n3. Testing Duplicate Rejection on createQuiz and createSessionalAssessment...');
    if (testFSA && testFSA.length > 0) {
      const { faculty_id, subject_id, section_id } = testFSA[0];

      // Attempting to create an existing quiz (e.g. Quiz 1) should return the existing record or throw duplicate error
      try {
        const createdAgain = await supabaseService.createQuiz({
          title: 'Quiz 1',
          faculty_id,
          subject_id,
          section_id,
          max_marks: 20,
          quiz_date: new Date().toISOString().split('T')[0],
          google_form_url: 'https://vctm.in/quizzes',
          status: 'draft',
          active: true,
        });
        // If it returns, verify it returned the existing ID
        const existingQuiz1 = allQuizzes?.find(
          q => q.subject_id === subject_id && q.section_id === section_id && q.title.toLowerCase().trim() === 'quiz 1'
        );
        if (existingQuiz1) {
          assert(createdAgain.id === existingQuiz1.id, 'Duplicate create safely returned existing canonical Quiz ID');
        } else {
          assert(true, 'Quiz created');
        }
      } catch (err: any) {
        assert(
          err.message.includes('already exists') || err.code === '23505',
          `Duplicate quiz was properly rejected: ${err.message}`
        );
      }

      // Check count didn't increase
      const { data: checkQuizzes } = await supabase
        .from('quizzes')
        .select('id')
        .eq('subject_id', subject_id)
        .eq('section_id', section_id)
        .ilike('title', 'Quiz 1');
      assert((checkQuizzes?.length || 0) === 1, 'Exactly 1 Quiz 1 exists in DB');
    }

    // -------------------------------------------------------------
    // Test 4: Assessment Marks Isolation
    // -------------------------------------------------------------
    console.log('\n4. Testing Assessment Marks Isolation...');
    // Verify sessional_marks have foreign keys to distinct sessional_assessment_ids
    const { data: marksSample } = await supabase
      .from('sessional_marks')
      .select('id, sessional_assessment_id, marks_obtained')
      .limit(10);

    if (marksSample && marksSample.length > 0) {
      const hasValidAssessmentIds = marksSample.every(m => Boolean(m.sessional_assessment_id));
      assert(hasValidAssessmentIds, 'All sample sessional marks are tied to specific assessment IDs');
    } else {
      assert(true, 'No sessional marks to check yet or checked empty');
    }

  } catch (err) {
    console.error('Test run failed with uncaught exception:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
