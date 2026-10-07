"""Exercise the Worker proxy, Django storage, and SMTP over loopback only.

Run with backend/.venv/bin/python after installing frontend dependencies.
Uses an isolated temporary database and a local SMTP receiver. No external mail.
"""
import json
import os
from pathlib import Path
import secrets
import socket
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
from email import policy
from email.parser import BytesParser
from io import StringIO
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


class SMTPReceiver(socketserver.StreamRequestHandler):
    def handle(self):
        self.wfile.write(b"220 local-test ESMTP\r\n")
        while True:
            line = self.rfile.readline()
            if not line:
                break
            command = line.split(b" ", 1)[0].strip().upper()
            if command in {b"EHLO", b"HELO"}:
                self.wfile.write(b"250-local-test\r\n250 SIZE 24000\r\n")
            elif command == b"DATA":
                self.wfile.write(b"354 Send message\r\n")
                lines = []
                while True:
                    part = self.rfile.readline()
                    if not part or part == b".\r\n":
                        break
                    lines.append(part[1:] if part.startswith(b"..") else part)
                self.server.messages.append(BytesParser(policy=policy.default).parsebytes(b"".join(lines)))
                self.wfile.write(b"250 Accepted\r\n")
            elif command == b"QUIT":
                self.wfile.write(b"221 Goodbye\r\n")
                break
            else:
                self.wfile.write(b"250 OK\r\n")


class SMTPServer(socketserver.ThreadingTCPServer):
    daemon_threads = True


def main():
    smtp = SMTPServer(("127.0.0.1", 0), SMTPReceiver)
    smtp.messages = []
    smtp_thread = threading.Thread(target=smtp.serve_forever, daemon=True)
    smtp_thread.start()
    with socket.socket() as unused:
        unused.bind(("127.0.0.1", 0))
        http_port = unused.getsockname()[1]
    web = None
    try:
        with tempfile.TemporaryDirectory(prefix="cronoverse-inquiry-smoke-") as temp:
            environment = {
                **os.environ,
                "DJANGO_SETTINGS_MODULE": "cronoverse.settings",
                "DJANGO_DEBUG": "1",
                "DJANGO_SECRET_KEY": secrets.token_urlsafe(48),
                "DJANGO_ALLOWED_HOSTS": "127.0.0.1,localhost",
                "DJANGO_PUBLIC_BASE_URL": f"http://127.0.0.1:{http_port}",
                "DJANGO_SECURE_SSL_REDIRECT": "0",
                "DJANGO_TRUST_PROXY": "0",
                "DATABASE_URL": "sqlite:///" + str(Path(temp) / "smoke.sqlite3"),
                "INQUIRY_API_KEY": secrets.token_urlsafe(32),
                "INQUIRY_NOTIFICATION_EMAIL": "smoke-owner@example.com",
                "INQUIRY_REPLY_TO_EMAIL": "smoke-owner@example.com",
                "DEFAULT_FROM_EMAIL": "Cronoverse <smoke-sender@example.com>",
                "STUDIO_URL": "https://studio.example.com",
                "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
                "EMAIL_HOST": "127.0.0.1",
                "EMAIL_PORT": str(smtp.server_address[1]),
                "EMAIL_HOST_USER": "",
                "EMAIL_HOST_PASSWORD": "",
                "EMAIL_USE_TLS": "0",
                "EMAIL_USE_SSL": "0",
            }
            os.environ.update(environment)
            sys.path.insert(0, str(ROOT / "backend"))
            import django
            django.setup()
            from django.core.management import call_command
            from django.db import connections
            from inquiries.models import EmailDelivery, Inquiry
            call_command("migrate", verbosity=0, stdout=StringIO())
            with open(Path(temp) / "web.log", "w") as log:
                web = subprocess.Popen(
                    [sys.executable, str(ROOT / "backend/manage.py"), "runserver", f"127.0.0.1:{http_port}", "--noreload"],
                    env=environment, cwd=ROOT, stdout=log, stderr=log,
                )
                for _ in range(100):
                    if web.poll() is not None:
                        raise RuntimeError("Local Django test server stopped before becoming ready.")
                    try:
                        with urlopen(f"http://127.0.0.1:{http_port}/health/", timeout=0.2) as response:
                            if response.status == 200:
                                break
                    except OSError:
                        time.sleep(0.1)
                else:
                    raise RuntimeError("Local Django test server did not become ready.")
                node_source = """
import { submitInquiry } from './lib/inquiry-intake.ts';
import { randomUUID } from 'node:crypto';
const config = {INQUIRY_BACKEND_URL: process.env.DJANGO_PUBLIC_BASE_URL, INQUIRY_API_KEY: process.env.INQUIRY_API_KEY};
const data = {id:randomUUID(), name:'Smoke Customer', email:'smoke-customer@example.com', business:'Smoke Studio', service:'new', language:'es', message:'I would like a website for my business.', website:''};
const results=[];
for(let attempt=0; attempt<2; attempt++) {
 const request=new Request('https://studio.example.com/api/inquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://studio.example.com'},body:JSON.stringify(data)});
 const response=await submitInquiry(request,config);
 const body=await response.json();
 if(body.ok!==true)throw new Error('Proxy did not acknowledge the inquiry.');
 results.push(response.status);
}
process.stdout.write(JSON.stringify(results));
"""
                result = subprocess.run(
                    ["node", "--experimental-strip-types", "--input-type=module", "-e", node_source],
                    cwd=ROOT, env=environment, capture_output=True, text=True, check=True, timeout=30,
                )
                assert json.loads(result.stdout) == [201, 200]
                for _ in range(2):
                    subprocess.run(
                        [sys.executable, str(ROOT / "backend/manage.py"), "process_inquiry_emails", "--once"],
                        cwd=ROOT, env=environment, capture_output=True, text=True, check=True, timeout=30,
                    )
                connections.close_all()
                assert Inquiry.objects.count() == 1
                assert EmailDelivery.objects.filter(state=EmailDelivery.State.SENT).count() == 2
                assert len(smtp.messages) == 2
                by_recipient = {str(message["To"]): message for message in smtp.messages}
                welcome = by_recipient["smoke-customer@example.com"]
                notification = by_recipient["smoke-owner@example.com"]
                assert "Bienvenido" in str(welcome["Subject"])
                assert "alguien de nuestro equipo te contactará" in welcome.get_body(preferencelist=("plain",)).get_content()
                assert welcome.get_body(preferencelist=("html",)) is not None
                assert str(notification["Reply-To"]) == "smoke-customer@example.com"
                assert "/admin/inquiries/inquiry/" in notification.get_body(preferencelist=("plain",)).get_content()
                assert notification.get_body(preferencelist=("html",)) is not None
                print("SMTP smoke passed: proxy 201/200, one inquiry, two accepted multipart emails, no duplicate sends.")
                connections.close_all()
                web.terminate()
                web.wait(timeout=10)
                web = None
    finally:
        if web is not None:
            web.terminate()
            web.wait(timeout=10)
        smtp.shutdown()
        smtp.server_close()
        smtp_thread.join(timeout=5)


if __name__ == "__main__":
    main()
