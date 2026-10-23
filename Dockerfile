FROM python:3.10-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 暴露 10000 端口
EXPOSE 10000

# 直接运行 main.py（触发内部的 uvicorn.run）
CMD ["python", "main.py"]
