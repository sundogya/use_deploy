import re
import os
from fastapi import FastAPI, Response
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession

app = FastAPI()

def extract_field_value(html_text: str, label_pattern: str) -> str:
    soup = BeautifulSoup(html_text, "html.parser")
    tag = soup.find(lambda t: t.name in ["div", "span"] and re.search(label_pattern, t.text, re.IGNORECASE))
    if tag:
        next_div = tag.find_next("div")
        if next_div:
            return next_div.get_text(strip=True)
    return ""

@app.get("/api")
@app.get("/api/sn")
@app.get("/")
async def proxy_uspto(sn: str = None):
    if not sn:
        return Response(content='{"error": "Missing sn parameter"}', status_code=400, media_type="application/json")

    target_url = f"https://tsdr.uspto.gov/statusview/sn{sn}"

    try:
        # 使用 curl_cffi 强制模拟 Chrome 124 的底层 TLS/JA3 指纹与 HTTP/2 特征
        async with AsyncSession(impersonate="chrome124") as session:
            resp = await session.get(target_url, timeout=20.0)

            if resp.status_code == 429:
                return Response(
                    content=f'{{"sn": "{sn}", "status": 429, "error": "Rate limited by USPTO"}}',
                    status_code=429,
                    media_type="application/json"
                )

            if resp.status_code != 200:
                return {
                    "sn": sn,
                    "status": resp.status_code,
                    "error": f"Upstream rejected with status {resp.status_code}"
                }

            html_text = resp.text
            corr_email = extract_field_value(html_text, r"Correspondent\s+e-mail:")
            attorney_email = extract_field_value(html_text, r"Attorney\s+Primary\s+Email.*Address:")

            return {
                "sn": sn,
                "status": 200,
                "correspondent_email": corr_email,
                "attorney_email": attorney_email
            }

    except Exception as e:
        return Response(content=f'{{"sn": "{sn}", "error": "{str(e)}"}}', status_code=500, media_type="application/json")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
