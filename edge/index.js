// edge/index.js

// 正则字段提取辅助函数
function extractFieldValue(html, labelPattern) {
    if (!html) return "";
    const regex = new RegExp(`${labelPattern}[\\s\\S]*?<div[^>]*>([\\s\\S]*?)<\\/div>`, 'i');
    const match = html.match(regex);
    if (match && match[1]) {
        return match[1].replace(/<[^>]+>/g, '').trim().replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ');
    }
    return "";
}

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

    // 可选字段筛选参数 (如 ?fields=correspondent_email,mark)
    const fieldsParam = url.searchParams.get("fields");
    const requestedFields = fieldsParam ? fieldsParam.split(",").map(f => f.trim()) : null;

    const targetUrl = `https://tsdr.uspto.gov/statusview/sn${sn}`;
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "en-US,en;q=0.9"
    };

    try {
        const res = await fetch(targetUrl, { headers });

        if (res.status === 429) {
            return new Response(JSON.stringify({ sn, status: 429, error: "Rate limited by USPTO" }), {
                status: 429,
                headers: { 
                    "Content-Type": "application/json; charset=utf-8",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        if (!res.ok) {
            return new Response(JSON.stringify({ sn, status: res.status, error: `Upstream error: ${res.statusText}` }), {
                status: res.status,
                headers: { 
                    "Content-Type": "application/json; charset=utf-8",
                    "Access-Control-Allow-Origin": "*"
                }
            });
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

        // 统一返回纯标准 Web Response
        return new Response(JSON.stringify(resultData), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (err) {
        return new Response(JSON.stringify({ sn, error: err.message || "Unknown error" }), {
            status: 500,
            headers: { 
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
