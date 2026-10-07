import os
from email.utils import parseaddr
from pathlib import Path
from urllib.parse import urlsplit

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from django.core.validators import validate_email
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=False)


def flag(name, default=False):
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes"}


def csv(name, default=""):
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


DEBUG = flag("DJANGO_DEBUG")
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-local-only" if DEBUG else "")
ALLOWED_HOSTS = csv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]" if DEBUG else "")
CSRF_TRUSTED_ORIGINS = csv("DJANGO_CSRF_TRUSTED_ORIGINS")
INQUIRY_API_KEY = os.getenv("INQUIRY_API_KEY", "")
INQUIRY_ALLOW_LOCAL_SUBMISSIONS = DEBUG and not INQUIRY_API_KEY
INQUIRY_MAX_PER_HOUR = 3
PUBLIC_BASE_URL = os.getenv("DJANGO_PUBLIC_BASE_URL", "http://127.0.0.1:8000" if DEBUG else "").rstrip("/")
STUDIO_URL = os.getenv("STUDIO_URL", "https://cronoverse.online").rstrip("/")
INQUIRY_NOTIFICATION_EMAIL = os.getenv("INQUIRY_NOTIFICATION_EMAIL", "").strip()
GA4_PROPERTY_ID = os.getenv("GA4_PROPERTY_ID", "").strip()
GA4_CREDENTIALS_FILE = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = flag("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = flag("EMAIL_USE_SSL")
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "15"))
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Cronoverse Web Studio <info@cronoverse.online>")
INQUIRY_REPLY_TO_EMAIL = os.getenv("INQUIRY_REPLY_TO_EMAIL", "info@cronoverse.online").strip()
EMAIL_MAX_ATTEMPTS = 8
EMAIL_LEASE_SECONDS = max(120, EMAIL_TIMEOUT * 4)

if EMAIL_USE_TLS and EMAIL_USE_SSL:
    raise ImproperlyConfigured("Choose EMAIL_USE_TLS or EMAIL_USE_SSL, not both.")
if INQUIRY_NOTIFICATION_EMAIL:
    validate_email(INQUIRY_NOTIFICATION_EMAIL)
if INQUIRY_REPLY_TO_EMAIL:
    validate_email(INQUIRY_REPLY_TO_EMAIL)
if DEFAULT_FROM_EMAIL:
    if "\n" in DEFAULT_FROM_EMAIL or "\r" in DEFAULT_FROM_EMAIL:
        raise ImproperlyConfigured("Invalid DEFAULT_FROM_EMAIL.")
    validate_email(parseaddr(DEFAULT_FROM_EMAIL)[1])
for setting_name, value in (("STUDIO_URL", STUDIO_URL), ("DJANGO_PUBLIC_BASE_URL", PUBLIC_BASE_URL)):
    if value:
        url = urlsplit(value)
        if (
            not url.hostname or url.username or url.password or url.query or url.fragment
            or url.path not in {"", "/"} or url.scheme not in ({"http", "https"} if DEBUG else {"https"})
        ):
            raise ImproperlyConfigured(f"{setting_name} must be an origin URL (HTTPS in production).")
if not DEBUG:
    if len(SECRET_KEY) < 50 or SECRET_KEY.startswith("django-insecure-"):
        raise ImproperlyConfigured("Set a strong DJANGO_SECRET_KEY of at least 50 characters.")
    if len(INQUIRY_API_KEY) < 32:
        raise ImproperlyConfigured("Set INQUIRY_API_KEY to a random secret of at least 32 characters.")
    if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
        raise ImproperlyConfigured("Set explicit DJANGO_ALLOWED_HOSTS.")
    if not PUBLIC_BASE_URL or not INQUIRY_NOTIFICATION_EMAIL or not DEFAULT_FROM_EMAIL:
        raise ImproperlyConfigured("Set the public backend URL, notification mailbox, and sender.")
    if EMAIL_BACKEND != "django.core.mail.backends.smtp.EmailBackend" or not EMAIL_HOST:
        raise ImproperlyConfigured("Production email delivery requires the SMTP backend and EMAIL_HOST.")

INSTALLED_APPS = [
    "jazzmin",
    "cronoverse.apps.CronoverseAdminConfig",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "inquiries",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "cronoverse.urls"
WSGI_APPLICATION = "cronoverse.wsgi.application"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
(BASE_DIR / "data").mkdir(exist_ok=True)
DATABASES = {"default": dj_database_url.parse(
    os.getenv("DATABASE_URL") or "sqlite:///" + str(BASE_DIR / "data" / "db.sqlite3"), conn_max_age=60
)}
if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    DATABASES["default"]["OPTIONS"] = {"timeout": 20}
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "en-us"
TIME_ZONE = "America/Los_Angeles"
USE_I18N = True
USE_TZ = True
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
DATA_UPLOAD_MAX_MEMORY_SIZE = 24_000
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAdminUser"],
}
SECURE_SSL_REDIRECT = flag("DJANGO_SECURE_SSL_REDIRECT", not DEBUG)
if flag("DJANGO_TRUST_PROXY"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_HSTS_SECONDS = 3600 if not DEBUG else 0
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
JAZZMIN_SETTINGS = {
    "site_title": "Cronoverse Admin",
    "site_header": "Cronoverse Web Studio",
    "site_brand": "Cronoverse",
    "welcome_sign": "Manage project inquiries",
    "icons": {"inquiries.Inquiry": "fas fa-address-card", "inquiries.EmailDelivery": "fas fa-envelope"},
    "custom_links": {"inquiries": [{
        "name": "Website analytics",
        "url": "admin:analytics",
        "icon": "fas fa-chart-line",
        "permissions": ["inquiries.view_inquiry"],
    }]},
}
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"inquiries": {"handlers": ["console"], "level": "INFO", "propagate": False}},
}
