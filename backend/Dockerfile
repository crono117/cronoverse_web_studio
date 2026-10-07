FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.lock.txt .
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY . .
RUN DJANGO_DEBUG=1 python manage.py collectstatic --noinput \
    && groupadd --system cronoverse \
    && useradd --system --gid cronoverse --home /app cronoverse \
    && chown -R cronoverse:cronoverse /app
USER cronoverse
EXPOSE 8000
CMD ["gunicorn", "cronoverse.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "30", "--access-logfile", "-", "--access-logformat", "%(h)s %(m)s %(U)s %(s)s"]
