/**
 * Vercel serverless proxy: GET /api/ics?url=<LMS calendar subscription URL>
 *
 * Browsers cannot read lms.inu.ac.kr directly from our page (CORS), so this
 * fetches the .ics on the player's behalf. Safety rules:
 *  - only https://lms.inu.ac.kr/calendar/export_execute.php is allowed (no open proxy)
 *  - the URL (it contains the player's token) is never stored or logged
 *  - responses are capped in size and time, and never cached
 */
const ALLOWED_HOST = 'lms.inu.ac.kr';
const ALLOWED_PATH = '/calendar/export_execute.php';
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10000;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let target;
  try {
    target = new URL(String((req.query && req.query.url) || ''));
  } catch (e) {
    res.status(400).send('bad url');
    return;
  }
  if (target.protocol !== 'https:' || target.hostname !== ALLOWED_HOST || target.pathname !== ALLOWED_PATH) {
    res.status(403).send('url not allowed');
    return;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(target.toString(), { signal: ctrl.signal, redirect: 'error' });
    if (!upstream.ok) {
      res.status(502).send('lms responded ' + upstream.status);
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      res.status(413).send('too large');
      return;
    }
    const text = buf.toString('utf8');
    if (!text.includes('BEGIN:VCALENDAR')) {
      res.status(502).send('not a calendar (is the URL/token valid?)');
      return;
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.status(200).send(text);
  } catch (e) {
    res.status(504).send(e.name === 'AbortError' ? 'lms timeout' : 'fetch failed');
  } finally {
    clearTimeout(timer);
  }
};
