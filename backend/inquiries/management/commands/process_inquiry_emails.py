import logging
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError, close_old_connections

from inquiries.mail import claim_delivery, deliver

logger = logging.getLogger("inquiries")


class Command(BaseCommand):
    help = "Deliver queued inquiry emails. Run continuously, or use --once from a scheduler."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--limit", type=int, default=100)
        parser.add_argument("--poll-interval", type=float, default=5)

    def handle(self, *args, **options):
        if options["limit"] < 1 or options["poll_interval"] < 0.1:
            raise CommandError("Use a positive limit and a poll interval of at least 0.1 seconds.")
        try:
            while True:
                close_old_connections()
                processed = 0
                try:
                    for _ in range(options["limit"]):
                        delivery = claim_delivery()
                        if not delivery:
                            break
                        deliver(delivery)
                        processed += 1
                except DatabaseError as error:
                    logger.error("inquiry_worker_database_error error_type=%s", type(error).__name__)
                    if options["once"]:
                        raise CommandError("Email worker could not access its database.") from error
                if options["once"]:
                    self.stdout.write(f"Processed {processed} queued email(s).")
                    return
                time.sleep(options["poll_interval"])
        except KeyboardInterrupt:
            self.stdout.write("Email worker stopped.")
