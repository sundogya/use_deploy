// 通用 HTML 字段值提取辅助函数
function extractFieldValue(html, labelPattern) {
  const regex = new RegExp(
    `${labelPattern}[\\s\\S]*?<div[^>]*>([\\s\\S]*?)<\\/div>`,
    "i"
  );
  const match = html.match(regex);
  if (match && match[1]) {
    return match[1].replace(/<[^>]+>/g, "").trim();
  }
  return "";
}

export default async function handler(request, response) {
  // 1. 同时兼容 Netlify (Web Request) 和 Vercel (Node.js Request) 获取参数
  let sn = "";
  let fields = "";

  if (request.query) {
    // 兼容 Vercel 风格
    sn = request.query.sn;
    fields = request.query.fields;
  } else if (request.url) {
    // 兼容 Netlify / Web API 标准风格
    const url = new URL(request.url, "http://localhost");
    sn = url.searchParams.get("sn");
    fields = url.searchParams.get("fields");
  }

  // 校验缺少参数的情况
  if (!sn) {
    const errorBody = JSON.stringify({ error: "Missing sn parameter" });
    if (response && response.status) {
      return response.status(400).json({ error: "Missing sn parameter" });
    }
    return new Response(errorBody, {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const requestedFields = fields ? fields.split(",").map(f => f.trim()) : null;
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
