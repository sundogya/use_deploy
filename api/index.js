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

    // 2. 校验密钥请求头（防刷量）
    const clientToken = request.headers.get("x-auth-token");
    if (clientToken !== "SpiderSecret_2026_xyz") { // 替换为你的专属密钥
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

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
        const html = await response.text();
        const correspondentEmail = extractFieldValue(html, "Correspondent\\s+e-mail:");
        const attorneyEmail = extractFieldValue(html, "Attorney\\s+Primary\\s+Email[\\s\\S]*?Address:");
        const mark = extractFieldValue(html, "Mark:");
        const attorneyName = extractFieldValue(html, "Attorney\\s+Name:");

        const allData = {
            correspondent_email: correspondentEmail,
            attorney_email: attorneyEmail,
            attorney_name: attorneyName,
            mark: mark
        };

        let filteredData = {};
        if (requestedFields && requestedFields.length > 0) {
        for (const f of requestedFields) {
            if (f in allData) filteredData[f] = allData[f];
        }
        } else {
        filteredData = allData;
        }

        return new Response(JSON.stringify({
            sn: sn,
            ...filteredData,
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
