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
  const targetUrl = `https://tsdr.uspto.gov/statusview/sn${sn}`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
    "Accept-Language": "en-US,en;q=0.9"
  };

    try {
    const res = await fetch(targetUrl, { headers });

    if (res.status === 429) {
      const body429 = JSON.stringify({ sn, status: 429, error: "Rate limited by USPTO" });
      if (response && response.status) {
        return response.status(429).json({ sn, status: 429, error: "Rate limited by USPTO" });
      }
      return new Response(body429, { status: 429, headers: { "Content-Type": "application/json" } });
    }

    if (!res.ok) {
      const errBody = JSON.stringify({ sn, status: res.status, error: `Upstream error: ${res.statusText}` });
      if (response && response.status) {
        return response.status(res.status).json({ sn, status: res.status, error: `Upstream error: ${res.statusText}` });
      }
      return new Response(errBody, { status: res.status, headers: { "Content-Type": "application/json" } });
    }

    const html = await res.text();

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

    const resultData = {
      sn: sn,
      status: 200,
      ...filteredData
    };

    // 针对 Vercel 模式返回
    if (response && response.setHeader && response.status) {
      response.setHeader("Access-Control-Allow-Origin", "*");
      return response.status(200).json(resultData);
    }

    // 针对 Netlify 模式返回标准 Response
    return new Response(JSON.stringify(resultData), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    const catchBody = JSON.stringify({ sn, error: err.message || "Unknown error" });
    if (response && response.status) {
      return response.status(500).json({ sn, error: err.message || "Unknown error" });
    }
    return new Response(catchBody, { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
}
