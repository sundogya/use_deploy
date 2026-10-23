FROM python:3.10-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080
EXPOSE 8080

# 使用 gunicorn 启动 main.py 中的 Flask 实例 app
CMD ["gunicorn", "-b", "0.0.0.0:8080", "main:app", "--workers", "1", "--threads", "4", "--timeout", "30"]
