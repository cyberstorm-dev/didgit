import argparse
import os
import sys
from dataclasses import dataclass

import requests


EAS_GQL = "https://base-sepolia.easscan.org/graphql"


@dataclass
class Attestation:
    uid: str
    txid: str | None
    schema: str
    attester: str
    recipient: str | None


def fetch_attestation(uid: str) -> Attestation | None:
    query = {
        "query": """
        query ($id: String!) {
          attestation(where: { id: $id }) {
            id
            txid
            schemaId
            attester
            recipient
          }
        }
        """,
        "variables": {"id": uid},
    }
    r = requests.post(EAS_GQL, json=query, timeout=20)
    r.raise_for_status()
    data = r.json()
    att = data.get("data", {}).get("attestation")
    if not att:
        return None
    return Attestation(
        uid=att["id"],
        txid=att.get("txid"),
        schema=att.get("schemaId"),
        attester=att.get("attester"),
        recipient=att.get("recipient"),
    )


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--uid", required=True)
    args = p.parse_args(argv)
    att = fetch_attestation(args.uid)
    if not att:
        print("Not found", file=sys.stderr)
        return 2
    print(att)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

