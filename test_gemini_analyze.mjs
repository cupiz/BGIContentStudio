import http from 'node:http';

const imgBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const payload = JSON.stringify({
  referenceImage: 'data:image/png;base64,' + imgBase64,
  customInstruction: 'Describe this pixel in one word.'
});

const options = {
  hostname: 'localhost', port: 3001,
  path: '/api/analyze-image-gemini', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  timeout: 120000
};

console.log('Sending analyze request with fresh profile...');
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const p = JSON.parse(data);
      console.log('success:', p.success);
      console.log('isBlockedByGoogle:', p.isBlockedByGoogle);
      console.log('isLoginRequired:', p.isLoginRequired);
      if (p.success) {
        console.log('result length:', p.result?.length || 0);
        console.log('result preview:', p.result?.substring(0, 200));
      } else {
        console.log('error:', p.error);
        if (p.detail) console.log('detail:', p.detail?.substring(0, 300));
      }
    } catch(e) {
      console.log('Parse error:', e.message);
      console.log('Raw:', data.substring(0, 500));
    }
  });
});
req.on('error', e => console.log('Error:', e.message));
req.end();
