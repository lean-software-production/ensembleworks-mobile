#!/usr/bin/env python3
"""Compare recorded factory usage, including retries and failed calls."""

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


def snapshot(name):
    if not re.fullmatch(r"[A-Za-z0-9][\w.-]*", name):
        raise ValueError(f"Invalid run name: {name}")
    folder = ROOT / "factory" / "runs" / name
    record = folder / "record.jsonl"
    # Like factory watch, ignore a final line that is still being written.
    lines = record.read_text().split("\n")[:-1] if record.exists() else []
    events = [json.loads(line) for line in lines if line]
    machines = defaultdict(Counter)
    for event in events:
        if event["type"] == "machine" and event.get("status") == "running":
            machines[event["machine"]]["calls"] += 1
        elif event["type"] == "usage":
            counts = machines[event["machine"]]
            counts["input"] += event["inputTokens"]
            counts["output"] += event["outputTokens"]
            counts["usage_reports"] += 1
    states = [event["status"] for event in events if event["type"] == "run"]
    plan = folder / "plan.md"
    tasks = re.findall(r"^- \[([ xX])\] .+$", plan.read_text(), re.M) if plan.exists() else []
    total = Counter()
    for counts in machines.values():
        total.update(counts)
    return {
        "name": name, "state": states[-1] if states else "not started",
        "tasks": f"{sum(mark.lower() == 'x' for mark in tasks)}/{len(tasks)}" if tasks else "unavailable",
        "segments": states.count("running"), "machines": machines, "total": total,
        "failed_calls": sum(event["type"] == "machine" and event.get("status") == "failed" for event in events),
        "steering": sum(event["type"] == "steering" for event in events),
    }


def tokens(run):
    return run["total"]["input"] + run["total"]["output"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline")
    parser.add_argument("candidate")
    args = parser.parse_args()
    try:
        baseline, candidate = (snapshot(name) for name in (args.baseline, args.candidate))
    except (ValueError, OSError) as error:
        parser.error(str(error))

    width = max(18, len(baseline["name"]), len(candidate["name"]))
    print(f'{"Metric":<25} {baseline["name"]:>{width}} {candidate["name"]:>{width}}')
    rows = [
        ("Run state", "state"), ("Completed/planned tasks", "tasks"),
        ("Run segments", "segments"), ("Failed machine calls", "failed_calls"),
        ("Steering deliveries", "steering"),
    ]
    for label, key in rows:
        print(f'{label:<25} {str(baseline[key]):>{width}} {str(candidate[key]):>{width}}')
    for label, key in [("Machine calls started", "calls"), ("Usage reports", "usage_reports"),
                       ("Recorded input", "input"), ("Recorded output", "output")]:
        print(f'{label:<25} {baseline["total"][key]:>{width},} {candidate["total"][key]:>{width},}')
    print(f'{"Recorded I/O total":<25} {tokens(baseline):>{width},} {tokens(candidate):>{width},}')

    for run in (baseline, candidate):
        print(f'\n{run["name"]}:')
        print(f'{"Machine":<18} {"Calls":>6} {"Input":>12} {"Output":>12} {"I/O total":>12}')
        for name, counts in sorted(run["machines"].items()):
            print(f'{name:<18} {counts["calls"]:>6} {counts["input"]:>12,} '
                  f'{counts["output"]:>12,} {counts["input"] + counts["output"]:>12,}')

    if baseline["state"] == candidate["state"] == "finished" and tokens(baseline):
        change = (tokens(candidate) / tokens(baseline) - 1) * 100
        print(f'\nRecorded I/O token change: {change:+.1f}% (candidate versus baseline).')
    else:
        print("\nComparison is provisional until both runs finish.")
    print("Usage arrives at the end of a machine call; active-call usage is not yet included.")
    print("Totals include recovery and failures with reported usage, but omit separate cache counters.")
    print("Compare acceptance evidence and steering changes alongside tokens; these are not monetary costs.")


if __name__ == "__main__":
    main()
