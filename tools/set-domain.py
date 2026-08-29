#!/usr/bin/env python3
"""Move the site to a custom domain (or back) in one command.

The canonical host is spelled out in ~20 places — canonical links, og:url,
the JSON-LD @ids, sitemap.xml, robots.txt — and the support address in four
more. Hand-editing that is how a stale canonical tag survives a rename and
quietly splits your search ranking across two hostnames.

    # see what would change, touching nothing
    python3 tools/set-domain.py siraj.app --email support@siraj.app --dry-run

    # do it, and write the CNAME file GitHub Pages needs
    python3 tools/set-domain.py siraj.app --email support@siraj.app --write-cname

    # go back
    python3 tools/set-domain.py siraj-muslim-hub.github.io --remove-cname

Run tools/gen-cities.py afterwards so the generated city pages and the
sitemap pick up the new host too.

IMPORTANT: only pass a domain you actually control and have pointed at
GitHub Pages. A CNAME naming a domain you do not own takes the live site
down — github.io starts redirecting to a host that will not answer. Set the
DNS records first (see README), then run this.
"""

import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Every file that can name the host or the support address.
# README.md is deliberately excluded: it names the github.io host on purpose
# — as the CNAME *target* (which stays github.io forever, custom domain or
# not) and in the rollback command. Rewriting those would corrupt the
# instructions for undoing this very change.
TARGETS = ["index.html", "privacy.html", "terms.html", "support.html",
           "robots.txt", "sitemap.xml"]

# Anything host-shaped we might be migrating *from*. A bare regex for "any
# domain" would rewrite apple.com and googleapis.com too, so we match only
# hosts we know are ours.
KNOWN_HOSTS = re.compile(
    r"(?:siraj-muslim-hub\.github\.io|siraj\.app|www\.siraj\.app)")

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
HOSTNAME = re.compile(r"^(?!-)[A-Za-z0-9-]{1,63}(?<!-)"
                      r"(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("domain", help="bare hostname, e.g. siraj.app (no scheme, no trailing slash)")
    ap.add_argument("--email", help="support address to switch to, e.g. support@siraj.app")
    ap.add_argument("--write-cname", action="store_true",
                    help="write the CNAME file GitHub Pages needs (only with DNS already pointed)")
    ap.add_argument("--remove-cname", action="store_true",
                    help="delete CNAME (use when moving back to github.io)")
    ap.add_argument("--dry-run", action="store_true", help="report changes, write nothing")
    args = ap.parse_args()

    domain = args.domain.strip().rstrip("/")
    for scheme in ("https://", "http://"):
        if domain.startswith(scheme):
            domain = domain[len(scheme):]
    if not HOSTNAME.match(domain):
        print(f"error: {args.domain!r} is not a bare hostname (want e.g. siraj.app)", file=sys.stderr)
        return 2
    if args.email and not EMAIL.fullmatch(args.email):
        print(f"error: {args.email!r} is not an email address", file=sys.stderr)
        return 2
    if args.write_cname and args.remove_cname:
        print("error: --write-cname and --remove-cname are mutually exclusive", file=sys.stderr)
        return 2
    if args.write_cname and domain.endswith(".github.io"):
        print("error: a github.io host is served without a CNAME file; drop --write-cname",
              file=sys.stderr)
        return 2

    total = 0
    for name in TARGETS:
        path = ROOT / name
        if not path.exists():
            continue
        original = path.read_text(encoding="utf-8")
        updated = KNOWN_HOSTS.sub(domain, original)
        if args.email:
            # Only rewrite the address currently used for support, so we never
            # touch an unrelated address that shows up in prose later.
            updated = re.sub(r"akhbrnatoday@gmail\.com", args.email, updated)
            updated = re.sub(r"support@(?:siraj\.app|siraj-muslim-hub\.github\.io)",
                             args.email, updated)
        if updated == original:
            continue
        hits = sum(1 for a, b in zip(original.splitlines(), updated.splitlines()) if a != b)
        total += hits
        print(f"  {name}: {hits} line(s)")
        if not args.dry_run:
            path.write_text(updated, encoding="utf-8")

    cname = ROOT / "CNAME"
    if args.write_cname:
        print(f"  CNAME: -> {domain}")
        if not args.dry_run:
            cname.write_text(domain + "\n", encoding="utf-8")
    elif args.remove_cname and cname.exists():
        print("  CNAME: removed")
        if not args.dry_run:
            cname.unlink()

    verb = "would change" if args.dry_run else "changed"
    print(f"\n{verb} {total} line(s) across the site; canonical host is now {domain}")
    if not args.dry_run:
        print("next: python3 tools/gen-cities.py   (regenerates city pages + sitemap)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
