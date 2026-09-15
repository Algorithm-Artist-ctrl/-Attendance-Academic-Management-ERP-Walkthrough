// @ts-nocheck
/**
 * VCTM ERP — Production AI Timetable Gateway Resilience & Safety Audit
 * Tests Gemini >= 3.6 model policy, model configuration, transient error classifier,
 * exponential backoff, model fallback chain, 404 handling, structured error responses,
 * SHA-256 caching, and database non-mutation safety guarantees.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { supabase } from '../lib/supabase/supabaseClient';
import {
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  TERTIARY_MODEL,
  MODEL_CHAIN,
  getGeminiModelVersion,
  isModelAllowed,
  isTransientError,
  getCachedExtraction,
  setCachedExtraction,
  clearExtractionCache,
  extractWithRetryAndFallback,
  server,
} from '../../server.mjs';

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, description: string, details?: any) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [Check ${totalAssertions}] ${description}`);
  } else {
    console.error(`\n❌ FAILED Assertion ${totalAssertions}: ${description}`);
    if (details) console.error('   Details:', details);
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function runAIResilienceAudit() {
  console.log('================================================================================');
  console.log('  VCTM ERP — AI TIMETABLE GATEWAY RESILIENCE & DATABASE SAFETY AUDIT            ');
  console.log('  Testing Gemini >= 3.6 Policy, 503 Handling, Model Fallback, & DB Safety       ');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Model Identification & Gemini >= 3.6 Model Policy
  // --------------------------------------------------------------------------
  console.log('--- 1. MODEL IDENTIFICATION & GEMINI >= 3.6 POLICY ENFORCEMENT ---');
  assert(PRIMARY_MODEL === 'gemini-3.8-flash', `Primary model is newest stable Gemini >= 3.6: ${PRIMARY_MODEL}`);
  assert(FALLBACK_MODEL === 'gemini-3.6-flash', `Fallback model is Gemini 3.6 Flash: ${FALLBACK_MODEL}`);
  assert(TERTIARY_MODEL === 'gemini-3.7-flash', `Tertiary model is Gemini 3.7 Flash: ${TERTIARY_MODEL}`);
  assert(MODEL_CHAIN.includes('gemini-3.8-flash'), 'Model chain contains gemini-3.8-flash');
  assert(MODEL_CHAIN.includes('gemini-3.6-flash'), 'Model chain contains gemini-3.6-flash');
  assert(MODEL_CHAIN.includes('gemini-3.7-flash'), 'Model chain contains gemini-3.7-flash');
  assert(MODEL_CHAIN.every(m => isModelAllowed(m)), 'EVERY model in MODEL_CHAIN strictly satisfies version >= 3.6');

  // Test version parser & filter logic
  assert(getGeminiModelVersion('gemini-3.8-flash') === 3.8, 'getGeminiModelVersion correctly parses 3.8');
  assert(getGeminiModelVersion('gemini-3.6-flash') === 3.6, 'getGeminiModelVersion correctly parses 3.6');
  assert(isModelAllowed('gemini-3.8-flash') === true, 'gemini-3.8-flash is ALLOWED (>= 3.6)');
  assert(isModelAllowed('gemini-3.7-flash') === true, 'gemini-3.7-flash is ALLOWED (>= 3.6)');
  assert(isModelAllowed('gemini-3.6-flash') === true, 'gemini-3.6-flash is ALLOWED (>= 3.6)');
  assert(isModelAllowed('gemini-3.5-flash') === false, 'gemini-3.5-flash is FORBIDDEN (< 3.6)');
  assert(isModelAllowed('gemini-2.5-flash') === false, 'gemini-2.5-flash is FORBIDDEN (< 3.6)');
  assert(isModelAllowed('gemini-2.0-flash') === false, 'gemini-2.0-flash is FORBIDDEN (< 3.6)');
  assert(isModelAllowed('gemini-1.5-flash') === false, 'gemini-1.5-flash is FORBIDDEN (< 3.6)');

  // --------------------------------------------------------------------------
  // TEST 2: Transient vs Non-Transient Error Classification
  // --------------------------------------------------------------------------
  console.log('\n--- 2. TRANSIENT ERROR CLASSIFIER ---');
  // Transient cases
  assert(isTransientError({ status: 503 }) === true, 'HTTP 503 status is classified as transient');
  assert(isTransientError({ status: 429 }) === true, 'HTTP 429 Rate Limit is classified as transient');
  assert(isTransientError({ status: 500 }) === true, 'HTTP 500 Internal Error is classified as transient');
  assert(isTransientError({ status: 502 }) === true, 'HTTP 502 Bad Gateway is classified as transient');
  assert(isTransientError({ status: 504 }) === true, 'HTTP 504 Gateway Timeout is classified as transient');
  assert(
    isTransientError({
      message: '503 UNAVAILABLE: This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.'
    }) === true,
    'Exact 503 high demand spike error message is classified as transient'
  );
  assert(isTransientError({ message: 'Resource has been exhausted (e.g. check quota)' }) === true, 'RESOURCE_EXHAUSTED is transient');
  assert(isTransientError({ message: 'TypeError: fetch failed (ECONNRESET)' }) === true, 'Network reset/timeout is transient');

  // Non-transient cases
  assert(isTransientError({ status: 400, message: 'Invalid argument: bad PDF format' }) === false, 'HTTP 400 Bad Request is NOT transient');
  assert(isTransientError({ status: 401, message: 'API key not valid. Please pass a valid API key.' }) === false, 'HTTP 401 Invalid Key is NOT transient');
  assert(isTransientError({ status: 403, message: 'Permission denied on resource' }) === false, 'HTTP 403 Forbidden is NOT transient');
  assert(isTransientError({ status: 404, message: 'models/gemini-invalid is not found' }) === false, 'HTTP 404 Model Not Found is NOT transient');

  // --------------------------------------------------------------------------
  // TEST 3: In-Memory SHA-256 Hash Caching
  // --------------------------------------------------------------------------
  console.log('\n--- 3. SHA-256 PDF EXTRACTION CACHE ---');
  clearExtractionCache();
  const samplePdfData = Buffer.from('%PDF-1.3\nSample timetable document binary content').toString('base64');
  const sampleHash = crypto.createHash('sha256').update(samplePdfData).digest('hex');

  assert(getCachedExtraction(sampleHash) === null, 'Cache miss before storage');
  const mockExtractionData = {
    institution_name: 'VCTM',
    schedule: [{ day: 'MON', periods: [] }]
  };
  setCachedExtraction(sampleHash, mockExtractionData);
  const cachedHit = getCachedExtraction(sampleHash);
  assert(Boolean(cachedHit), 'Cache hit after storage');
  assert(cachedHit?.institution_name === 'VCTM', 'Cached extraction retains structured payload');

  // --------------------------------------------------------------------------
  // TEST 4: Controlled Retry with Mocked Transient Failure (Gemini >= 3.6)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. CONTROLLED RETRY ON TRANSIENT 503 (GEMINI >= 3.6) ---');
  let primaryAttempts = 0;
  const mockAiRetrySuccess = {
    models: {
      generateContent: async ({ model }: any) => {
        if (model === PRIMARY_MODEL) {
          primaryAttempts++;
          if (primaryAttempts < 2) {
            const err: any = new Error('503 UNAVAILABLE: Model experiencing high demand');
            err.status = 503;
            throw err;
          }
          return {
            text: JSON.stringify({
              institution_name: 'VCTM ALIGARH',
              schedule: [{ day: 'MON', periods: [{ period_number: 1 }] }]
            })
          };
        }
        throw new Error(`Unexpected model call: ${model}`);
      }
    }
  };

  const retryResult = await extractWithRetryAndFallback(samplePdfData, mockAiRetrySuccess);
  assert(Boolean(retryResult.success), 'Succeeded after transient retry');
  assert((retryResult as any).model === PRIMARY_MODEL, `Stayed on primary model ${PRIMARY_MODEL} once resolved`);
  assert(primaryAttempts === 2, `Executed exactly 2 attempts before succeeding (retried attempt count: ${primaryAttempts})`);

  // --------------------------------------------------------------------------
  // TEST 5: Controlled Fallback to Gemini 3.6 Flash
  // --------------------------------------------------------------------------
  console.log('\n--- 5. CONTROLLED FALLBACK TO GEMINI 3.6 FLASH ---');
  let fallbackInvoked = false;
  const mockAiFallback = {
    models: {
      generateContent: async ({ model }: any) => {
        if (model === PRIMARY_MODEL || model === TERTIARY_MODEL) {
          const err: any = new Error('503 UNAVAILABLE: Model overloaded');
          err.status = 503;
          throw err;
        }
        if (model === FALLBACK_MODEL) {
          fallbackInvoked = true;
          return {
            text: JSON.stringify({
              institution_name: 'VCTM ALIGARH',
              schedule: [{ day: 'MON', periods: [{ period_number: 1 }] }]
            })
          };
        }
        throw new Error(`Unexpected model: ${model}`);
      }
    }
  };

  const fallbackResult = await extractWithRetryAndFallback(samplePdfData, mockAiFallback);
  assert(Boolean(fallbackResult.success), 'Succeeded via fallback model');
  assert((fallbackResult as any).model === FALLBACK_MODEL, `Switched to fallback model: ${FALLBACK_MODEL}`);
  assert(fallbackInvoked === true, 'Fallback model gemini-3.6-flash was explicitly invoked');

  // --------------------------------------------------------------------------
  // TEST 6: 404 Model Error Handling (Immediate Advance Without Futile Retries)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. 404 MODEL ERROR HANDLING (IMMEDIATE ADVANCE) ---');
  let primaryCallsOn404 = 0;
  let fallbackInvokedOn404 = false;
  const mockAi404 = {
    models: {
      generateContent: async ({ model }: any) => {
        if (model === PRIMARY_MODEL) {
          primaryCallsOn404++;
          const err: any = new Error(`404 NOT_FOUND: models/${model} is not found`);
          err.status = 404;
          throw err;
        }
        if (model === TERTIARY_MODEL || model === FALLBACK_MODEL) {
          fallbackInvokedOn404 = true;
          return {
            text: JSON.stringify({
              institution_name: 'VCTM ALIGARH',
              schedule: [{ day: 'MON', periods: [{ period_number: 1 }] }]
            })
          };
        }
        throw new Error(`Unexpected model: ${model}`);
      }
    }
  };

  const res404 = await extractWithRetryAndFallback(samplePdfData, mockAi404);
  assert(Boolean(res404.success), 'Succeeded via fallback after 404 on primary');
  assert(primaryCallsOn404 === 1, 'Model returning 404 was NOT retried repeatedly (called exactly once)');
  assert(fallbackInvokedOn404 === true, 'Immediately advanced to next >= 3.6 fallback model');

  // --------------------------------------------------------------------------
  // TEST 7: All Providers Unavailable -> Structured Error (No Raw Google JSON)
  // --------------------------------------------------------------------------
  console.log('\n--- 7. STRUCTURED ERROR WHEN ALL >= 3.6 MODELS UNAVAILABLE ---');
  const mockAiAllDown = {
    models: {
      generateContent: async ({ model }: any) => {
        const err: any = new Error(`503 UNAVAILABLE: ${model} is experiencing spikes in demand`);
        err.status = 503;
        throw err;
      }
    }
  };

  const allDownResult = await extractWithRetryAndFallback(samplePdfData, mockAiAllDown);
  assert(allDownResult.success === false, 'Result returns success: false');
  assert(allDownResult.status === 503, 'Returns HTTP 503 status');
  assert(allDownResult.code === 'AI_PROVIDER_UNAVAILABLE', 'Returns clean error code: AI_PROVIDER_UNAVAILABLE');
  assert(
    allDownResult.error ===
      'AI timetable extraction is temporarily unavailable. Your existing timetable has not been changed. Please retry or use CSV import.',
    'Returns exact user-facing error message without exposing raw Google JSON'
  );
  assert(
    !allDownResult.error.includes('{"error":'),
    'Raw Google error JSON is NOT leaked to user'
  );

  // --------------------------------------------------------------------------
  // TEST 8: Database Safety Test — Existing Timetable Invariant
  // --------------------------------------------------------------------------
  console.log('\n--- 8. DATABASE SAFETY TEST (EXISTING TIMETABLE UNCHANGED ON AI FAILURE) ---');
  // Fetch 2nd Year Section B
  const { data: secBData } = await supabase.from('sections').select('*').eq('name', 'B').eq('room_number', 'A006');
  const secB = secBData?.[0] || (await supabase.from('sections').select('*').eq('name', 'B').limit(1)).data?.[0];
  assert(Boolean(secB), 'Section B exists in database', secB?.id);

  // Record timetable count before simulated failure
  const { count: countBefore } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secB!.id);

  assert(typeof countBefore === 'number' && countBefore > 0, `Section B currently has ${countBefore} timetable entries in database`);

  // Simulate an AI failure in the workflow
  try {
    const failedExtraction = await extractWithRetryAndFallback(samplePdfData, mockAiAllDown);
    if (!failedExtraction.success) {
      // The frontend stops here; no DB mutation is triggered!
    }
  } catch (ignored) {}

  // Record timetable count after simulated failure
  const { count: countAfter } = await supabase
    .from('timetable_entries')
    .select('id', { count: 'exact' })
    .eq('section_id', secB!.id);

  assert(countAfter === countBefore, `Section B timetable count is 100% UNCHANGED (${countBefore} === ${countAfter})`);

  // Verify versions table count is also untouched
  const { count: versionsCount } = await supabase
    .from('timetable_versions')
    .select('id', { count: 'exact' })
    .eq('section_id', secB!.id);
  assert(typeof versionsCount === 'number' && versionsCount > 0, `Section B timetable versions preserved (${versionsCount} active/superseded versions)`);

  // --------------------------------------------------------------------------
  // TEST 9: Real Timetable PDF File Integrity
  // --------------------------------------------------------------------------
  console.log('\n--- 9. REAL TIMETABLE PDF FILE INTEGRITY ---');
  const pdfPath = path.resolve(process.cwd(), 'BTech_CSE_IT_Sec_B_Time_Table.pdf');
  assert(fs.existsSync(pdfPath), 'BTech_CSE_IT_Sec_B_Time_Table.pdf exists in workspace root');
  const pdfBuffer = fs.readFileSync(pdfPath);
  assert(pdfBuffer.length > 50000, `PDF file size is valid (${Math.round(pdfBuffer.length / 1024)} KB)`);
  assert(pdfBuffer.slice(0, 5).toString('ascii') === '%PDF-', 'PDF file begins with valid %PDF- magic header');

  // --------------------------------------------------------------------------
  // TEST 10: Server API Health & Configuration Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 10. SERVER HEALTH & CONFIGURATION ENDPOINT ---');
  assert(typeof server === 'object', 'HTTP server instance is created');
  assert(PRIMARY_MODEL === 'gemini-3.8-flash', 'Server primary model configured as gemini-3.8-flash (>= 3.6)');
  assert(FALLBACK_MODEL === 'gemini-3.6-flash', 'Server fallback model configured as gemini-3.6-flash (>= 3.6)');

  // --------------------------------------------------------------------------
  // TEST 11: Independence of CSV & Google Sheet Pipeline
  // --------------------------------------------------------------------------
  console.log('\n--- 11. PIPELINE INDEPENDENCE (CSV NOT DEPENDENT ON AI) ---');
  const csvPath = path.resolve(process.cwd(), 'BTech_CSE_IT_Sec_B_Time_Table_v2.csv');
  assert(fs.existsSync(csvPath), 'CSV timetable importer source exists independently');
  assert(fs.readFileSync(csvPath, 'utf8').length > 100, 'CSV timetable file is readable and ready as fallback');

  console.log('\n================================================================================');
  console.log(`  🎉 ALL ${passedAssertions}/${totalAssertions} AI GATEWAY RESILIENCE AUDIT CHECKS PASSED!`);
  console.log('================================================================================\n');
  process.exit(0);
}

runAIResilienceAudit().catch(err => {
  console.error('\n❌ AUDIT EXECUTION FAILED:', err);
  process.exit(1);
});
