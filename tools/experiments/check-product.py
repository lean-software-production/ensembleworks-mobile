#!/usr/bin/env python3
"""Independent, interface-neutral launch checks; not a full gameplay oracle."""
import argparse, json, os, pty, re, select, signal, subprocess, termios, time
from pathlib import Path

def verify(target, plan):
    checks = {}
    suite = subprocess.run(['npm', 'test'], cwd=target, text=True, capture_output=True, timeout=180)
    checks['suite'] = {'passed': suite.returncode == 0, 'output': (suite.stdout + suite.stderr)[-24000:]}
    plain = subprocess.run(['npm', '--silent', 'start'], cwd=target, text=True, capture_output=True, timeout=15)
    visible = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', plain.stdout)
    rows = visible.split('\n')
    colours = set()
    for sgr in re.findall(r'\x1b\[([0-9;]+)m', plain.stdout):
        parts = sgr.split(';')
        for i, part in enumerate(parts):
            if part in [str(x) for x in list(range(30,38))+list(range(90,98))]: colours.add(part)
            if part == '38' and i+2 < len(parts): colours.add(';'.join(parts[i:i+(5 if parts[i+1]=='2' else 3)]))
    checks['bounded_non_tty'] = {'passed': plain.returncode == 0 and 1 <= len(rows) <= 24, 'rows': len(rows), 'exit': plain.returncode}
    checks['retro_palette'] = {'passed': len(colours) >= 3, 'distinct_colours': len(colours)}
    text = Path(plan).read_text()
    frozen = (Path(__file__).resolve().parents[2]/'docs/experiments/tetris-007/inputs/plan.md').read_text()
    names = lambda value: re.findall(r'^- \[[ xX]\] (\d+\..+)$', value, re.M)
    checks['tasks_complete'] = {'passed': names(text) == names(frozen) and len(names(text)) == 13 and not re.search(r'^\s*- \[ \]', text, re.M)}
    review = Path(plan).with_name('plan-review.json')
    checkpoint = json.loads(review.read_text()) if review.exists() else {}
    checks['accepted_plan'] = {'passed': checkpoint.get('status') == 'accepted'}
    master, slave = pty.openpty()
    import fcntl, struct
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))
    before = termios.tcgetattr(slave)
    proc = subprocess.Popen(['npm', 'start'], cwd=target, stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
    output = bytearray()
    def drain(seconds):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            if select.select([master], [], [], min(.1, max(0, end-time.monotonic())))[0]:
                try: output.extend(os.read(master, 65536))
                except OSError: break
    try:
        drain(2)
        launched = proc.poll() is None
        os.write(master, b'\x1b[D\x1b[A\x1b[Bp')
        drain(.3)
        os.write(master, b'p')
        drain(.3)
        os.write(master, b'q')
        drain(2)
        exited = proc.poll() == 0
        restored = termios.tcgetattr(slave) == before
        checks['actual_npm_start_pty'] = {'passed': launched and exited and restored, 'launched': launched, 'exit': proc.poll(), 'termios_restored': restored, 'output_tail': output.decode(errors='replace')[-4000:]}
    finally:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGTERM)
            try: proc.wait(timeout=3)
            except subprocess.TimeoutExpired: os.killpg(proc.pid, signal.SIGKILL); proc.wait()
        os.close(master); os.close(slave)
    checks['documentation'] = {'passed': (Path(target)/'README.md').exists() and (Path(target)/'VERIFICATION.md').exists()}
    return {'passed': all(c['passed'] for c in checks.values()), 'checks': checks, 'scope': 'Launch, final suite, palette, completion and documentation presence. Gameplay contracts rely on frozen per-task criteria and independent factory validators; PTY input dispatch here is a smoke check.'}

if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('target'); p.add_argument('plan'); args=p.parse_args()
    try: result=verify(args.target,args.plan)
    except Exception as e: result={'passed':False,'error':str(e)}
    print(json.dumps(result, indent=2)); raise SystemExit(0 if result['passed'] else 1)
