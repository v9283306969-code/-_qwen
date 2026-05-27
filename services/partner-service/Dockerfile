# ==========================
# STAGE 1: Зависимости
# ==========================
FROM python:3.12-slim AS deps
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ==========================
# STAGE 2: Сборка
# ==========================
FROM python:3.12-slim AS builder
WORKDIR /app

COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY . .

# Компиляция .pyc для ускорения запуска
RUN python -m compileall -b .

# ==========================
# STAGE 3: Production
# ==========================
FROM python:3.12-slim AS runner
WORKDIR /app

ENV PYTHONUNBUFFERED 1

COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /app/src /app/src

# Непривилегированный пользователь
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 3003

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3003"]
