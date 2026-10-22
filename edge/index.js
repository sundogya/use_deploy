// edge/index.js

export default async function handler(request, context) {
    const url = new URL(request.url);
    const sn = url.searchParams.get("sn");

    // 1. 校验入参
    if (!sn) {
        return new Response(JSON.stringify({ error: "Missing 'sn' parameter" }), {
            status: 400,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }

    // // 2. 校验密钥请求头（防刷量）
    // const clientToken = request.headers.get("x-auth-token");
    // if (clientToken !== "SpiderSecret_2026_xyz") { // 替换为你的专属密钥
    //     return new Response(JSON.stringify({ error: "Unauthorized" }), {
    //         status: 401,
    //         headers: { "Content-Type": "application/json" }
    //     });
    // }

    try {
        // 3. 发起网络请求
        const targetUrl = `https://tsdr.uspto.gov/statusview/sn${sn}`;
        const response = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });

        if (response.status === 429) {
            return new Response(JSON.stringify({ sn: sn, status: 429, error: "Rate limited" }), {
                status: 429,
                headers: { "Content-Type": "application/json" }
            });
        }

        const htmlText = await response.text();
        const emailMatch = htmlText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        const email = emailMatch ? emailMatch[1] : "";

        return new Response(JSON.stringify({
            sn: sn,
            email: email,
            status: 200
        }), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
