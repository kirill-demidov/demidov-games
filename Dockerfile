FROM python:3.12-slim

WORKDIR /app
COPY server/requirements.txt /app/server/requirements.txt
RUN pip install --no-cache-dir -r /app/server/requirements.txt

COPY server /app/server
COPY index.html portal.css favicon.svg 404.html /app/
COPY mines /app/mines
COPY pentix /app/pentix
COPY lines /app/lines

ENV PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8080"]
