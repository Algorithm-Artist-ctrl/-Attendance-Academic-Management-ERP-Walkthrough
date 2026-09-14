import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 10000);
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

const prompt = `Extract the uploaded college timetable into JSON. Never invent institution-specific values. Read values from the PDF. Extract every visible timetable cell, including lunch/break/activity cells. Preserve exact start/end times. For merged labs spanning multiple periods, emit one entry per actual period. Blank cells produce no entry. Return ONLY JSON with institution_name, program_name, branch_name, academic_year, semester, section_name, effective_from, room_number, class_incharges, subject_mappings, faculty_mappings, schedule, overall_confidence, confidence_breakdown, warnings. Schedule days use MON,TUE,WED,THU,FRI,SAT. Each period contains period_number,start_time,end_time,subject_code,subject_name,faculty_code,faculty_name,room_number,lecture_type,is_break,confidence. Do not invent missing values.`;

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 25 * 1024 * 1024) throw new Error('Request is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleExtract(req, res) {
  if (!apiKey) return send(res, 503, { error: 'GEMINI_API_KEY is not configured on the server.' });
  const body = await readJson(req);
  if (typeof body?.data !== 'string' || !body.data) return send(res, 400, { error: 'PDF data is required.' });

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: 'application/pdf', data: body.data } },
      { text: prompt }
    ] }],
    config: { responseMimeType: 'application/json', temperature: 0 }
  });

  const text = (response.text || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  if (!text) return send(res, 502, { error: 'Gemini returned no timetable data.' });
  try { return send(res, 200, JSON.parse(text)); }
  catch { return send(res, 502, { error: 'Gemini returned invalid timetable JSON.' }); }
}

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  if (pathname === '/') pathname = '/index.html';
  const requested = path.resolve(dist, `.${pathname}`);
  if (!requested.startsWith(dist + path.sep)) return send(res, 403, { error: 'Forbidden' });

  let file = requested;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(dist, 'index.html');
  if (!fs.existsSync(file)) return send(res, 503, { error: 'Build output is missing.' });

  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/timetable/extract') return await handleExtract(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
    return send(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('Server error:', error);
    return send(res, 500, { error: error?.message || 'Internal server error.' });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`VCTM ERP server listening on ${port}`));
