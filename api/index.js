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
  // 1. 获取请求参数 ?sn=xxxx
  const { sn, fields } = request.query;

  if (!sn) {
    return response.status(400).json({ error: "Missing sn parameter" });
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
      return response.status(429).json({ sn, status: 429, error: "Rate limited by USPTO" });
    }

    if (!res.ok) {
      return response.status(res.status).json({ sn, status: res.status, error: `Upstream error: ${res.statusText}` });
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

    // 设置 CORS 跨域并返回 JSON
    response.setHeader("Access-Control-Allow-Origin", "*");
    return response.status(200).json({
      sn: sn,
      status: 200,
      ...filteredData
    });

  } catch (err) {
    return response.status(500).json({ sn, error: err.message || "Unknown error" });
  }
}
