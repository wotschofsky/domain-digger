import https from 'https';

export async function GET(request) {
  const { searchParams } = new URL(
    request.url,
    `http://${request.headers.host}`
  );
  const domain = searchParams.get('domain');
  const file = searchParams.get('file');
  let redirectCount = 0;

  async function checkFile(domain, file) {
    return new Promise((resolve, reject) => {
      const protocol = 'https:'; // oder 'http:' je nach Bedarf

      const options = {
        hostname: domain,
        path: `/${file}`,
        method: 'GET',
        protocol: protocol,
      };

      const req = https.request(options, (res) => {
        if (
          (res.statusCode === 301 || res.statusCode === 302) &&
          redirectCount < 1
        ) {
          const redirectURL = res.headers.location;
          const redirectDomain = new URL(redirectURL).hostname;
          redirectCount++;
          checkFile(redirectDomain, file).then(resolve).catch(reject);
        } else if (res.statusCode === 301 && redirectCount === 1) {
          const wwwDomain = `www.${domain}`;
          redirectCount++;
          checkFile(wwwDomain, file).then(resolve).catch(reject);
        } else {
          resolve(res.statusCode);
        }
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  if (!domain) {
    return new Response(
      JSON.stringify({
        error: true,
        message: '"domain" param missing or invalid',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  if (!file) {
    return new Response(
      JSON.stringify({
        fileResponse: '301',
        hsts: false,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  let targetHSTS;

  const hstsRequest = https.get(`https://${domain}`, (res) => {
    const hsts = res.headers['strict-transport-security'];
    if (hsts) {
      targetHSTS = hsts;
    } else {
      targetHSTS = false;
    }
  });

  hstsRequest.on('error', (err) => {
    targetHSTS = false;
  });

  const fileResponse = await checkFile(domain, file);

  return new Response(
    JSON.stringify({
      fileResponse,
      hsts: targetHSTS,
      file,
      domain,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
