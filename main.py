import re
import os
import httpx
from fastapi import FastAPI, Response
from bs4 import BeautifulSoup

app = FastAPI()

def extract_field_value(html_text: str, label_pattern: str) -> str:
    soup = BeautifulSoup(html_text, "html.parser")
    # 匹配目标 label
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
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "en-US,en;q=0.9"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(target_url, headers=headers)
            
            if resp.status_code == 429:
                return Response(
                    content=f'{{"sn": "{sn}", "status": 429, "error": "Rate limited by USPTO"}}',
                    status_code=429,
                    media_type="application/json"
                )

            html_text = resp.text
            corr_email = extract_field_value(html_text, r"Correspondent\s+e-mail:")
            attorney_email = extract_field_value(html_text, r"Attorney\s+Primary\s+Email.*Address:")

            return {
                "sn": sn,
                "status": resp.status_code,
                "correspondent_email": corr_email,
                "attorney_email": attorney_email
            }

    except Exception as e:
        return Response(content=f'{{"sn": "{sn}", "error": "{str(e)}"}}', status_code=500, media_type="application/json")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
