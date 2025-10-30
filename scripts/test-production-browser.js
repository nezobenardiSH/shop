const https = require('https');

function testProductionLogin() {
  console.log('🌐 Testing Production Login (Browser Simulation)');
  console.log('=' . repeat(60));
  
  const merchantId = 'a0yQ900000BalYL';
  const pin = '2454';
  
  const postData = JSON.stringify({
    merchantId: merchantId,
    pin: pin
  });
  
  const options = {
    hostname: 'onboarding-portal.onrender.com',
    port: 443,
    path: '/api/auth/merchant-login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  };
  
  console.log('\n📤 Request Details:');
  console.log('URL: https://' + options.hostname + options.path);
  console.log('Method:', options.method);
  console.log('Body:', postData);
  console.log('-' . repeat(60));
  
  const req = https.request(options, (res) => {
    console.log('\n📥 Response Details:');
    console.log('Status Code:', res.statusCode);
    console.log('Status Message:', res.statusMessage);
    console.log('Headers:', JSON.stringify(res.headers, null, 2));
    console.log('-' . repeat(60));
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('\n📄 Response Body:');
      if (res.headers['content-type']?.includes('application/json')) {
        try {
          const json = JSON.parse(data);
          console.log(JSON.stringify(json, null, 2));
          
          if (json.error) {
            console.log('\n❌ Error:', json.error);
            if (json.remainingAttempts !== undefined) {
              console.log('Remaining attempts:', json.remainingAttempts);
            }
            if (json.lockout) {
              console.log('🔒 Account is locked out!');
            }
          }
        } catch (e) {
          console.log('Raw:', data);
        }
      } else {
        console.log('Raw HTML Response (first 500 chars):');
        console.log(data.substring(0, 500));
      }
      
      console.log('\n' + '=' . repeat(60));
      console.log('📊 Diagnosis:');
      console.log('-' . repeat(60));
      
      if (res.statusCode === 404) {
        console.log('❌ API endpoint not found on production');
        console.log('Possible causes:');
        console.log('1. Build failed on Render');
        console.log('2. API routes not included in build');
        console.log('3. Next.js version mismatch');
        console.log('\n🔧 Fix: Check Render build logs for errors');
      } else if (res.statusCode === 401) {
        console.log('❌ Authentication failed');
        console.log('PIN is incorrect or account is locked');
      } else if (res.statusCode === 429) {
        console.log('❌ Rate limited');
        console.log('Too many failed attempts');
      } else if (res.statusCode === 500) {
        console.log('❌ Server error');
        console.log('Check Render logs for details');
      } else if (res.statusCode === 200) {
        console.log('✅ Login successful!');
      }
    });
  });
  
  req.on('error', (e) => {
    console.error('❌ Request error:', e.message);
  });
  
  req.write(postData);
  req.end();
}

testProductionLogin();