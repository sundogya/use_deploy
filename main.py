import re
import os
import httpx
from fastapi import FastAPI, Response
from bs4 import BeautifulSoup

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
    
    # 补齐与真实 Chrome 124 完全一致的高级伪装头
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
    }

    try:
        # 核心细节：http2=False 强制使用 HTTP/1.1，规避 Akamai 的 HTTP/2 指纹校验
        # follow_redirects=True 自动跟随重定向
        async with httpx.AsyncClient(timeout=20.0, http2=False, follow_redirects=True) as client:
            resp = await client.get(target_url, headers=headers)
            
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
