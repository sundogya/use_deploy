const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

function extractFieldValue(html, labelPattern) {
    if (!html) return "";
    const regex = new RegExp(`${labelPattern}[\\s\\S]*?<div[^>]*>([\\s\\S]*?)<\\/div>`, 'i');
    const match = html.match(regex);
    if (match && match[1]) {
        return match[1].replace(/<[^>]+>/g, '').trim().replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ');
    }
    return "";
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // 路由判断
    if (parsedUrl.pathname === '/api' || parsedUrl.pathname === '/edge' || parsedUrl.pathname === '/') {
        const sn = parsedUrl.query.sn;
        if (!sn) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: "Missing 'sn' parameter" }));
        }

        const targetUrl = `https://tsdr.uspto.gov/statusview/sn${sn}`;
        const options = {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
                "Accept-Language": "en-US,en;q=0.9"
            }
        };

        https.get(targetUrl, options, (upstreamRes) => {
            let data = '';
            upstreamRes.on('data', (chunk) => { data += chunk; });
            upstreamRes.on('end', () => {
                if (upstreamRes.statusCode === 429) {
                    res.writeHead(429, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ sn, status: 429, error: "Rate limited by USPTO" }));
                }

                const correspondentEmail = extractFieldValue(data, "Correspondent\\s+e-mail:");
                const attorneyEmail = extractFieldValue(data, "Attorney\\s+Primary\\s+Email[\\s\\S]*?Address:");
                const mark = extractFieldValue(data, "Mark:");
                const attorneyName = extractFieldValue(data, "Attorney\\s+Name:");

                const result = {
                    sn,
                    status: upstreamRes.statusCode,
                    correspondent_email: correspondentEmail,
                    attorney_email: attorneyEmail,
                    attorney_name: attorneyName,
                    mark
                };

                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify(result));
            });
        }).on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sn, error: err.message }));
        });

    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Not Found" }));
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
