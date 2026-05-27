# ========================================
# Partner Service — Multi-stage Dockerfile (Python)
# ========================================
# Сборка: docker build -t mlecp-partner-service .
# Запуск: docker run -p 3003:3003 mlecp-partner-service
# ========================================

# ---------- STAGE 1: Зависимости ----------
FROM python:3.12-slim AS deps
WORKDIR /app

# Системные зависимости (если нужны для psycopg2 и т.д.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --compile -r requirements.txt

# ---------- STAGE 2: Production ----------
FROM python:3.12-slim AS runner
WORKDIR /app

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

# Непривилегированный пользователь
RUN useradd -m -u 1001 appuser && chown -R appuser /app

# Копируем зависимости и исходный код
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY --chown=appuser:appuser src ./src

USER appuser

EXPOSE 3003

# Health check — python так как wget/curl нет в slim
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3003/health')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3003"]
