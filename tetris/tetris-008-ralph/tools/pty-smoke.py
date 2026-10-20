#!/usr/bin/env python3
"""Actual npm start PTY smoke; Linux/Python stdlib, no production hooks."""
import fcntl
import os
import pathlib
import pty
import select
import signal
import struct
import subprocess
import tempfile
import termios
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]

def drain(fd, seconds):
    result = b''
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if select.select([fd], [], [], 0.03)[0]:
            result += os.read(fd, 65536)
    return result

# Inject only randomness before the unmodified actual entry point runs.
with tempfile.TemporaryDirectory(dir=ROOT) as directory:
    preload = pathlib.Path(directory) / 'random.mjs'
    for index, (piece, colour) in enumerate(zip('IOTSZJL', [96, 93, 95, 92, 91, 94, 33])):
        preload.write_text(f'Math.random = () => {(index + 0.5) / 7};\n')
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))
        before = termios.tcgetattr(slave)
        env = dict(os.environ, NODE_OPTIONS=f'--import={preload}')
        process = subprocess.Popen(['npm', 'start'], cwd=ROOT, env=env,
                                   stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
        try:
            output = drain(master, 0.8)
            assert f'\x1b[{colour}m[]\x1b[0m'.encode() in output, (piece, output)
            os.write(master, b'\x1b[Bp')
            output += drain(master, 0.1)
            assert b'Paused' in output
            if piece == 'O':
                # Starting y=1 from the earlier legal down; tile five O pieces.
                keys = b'p'
                for target in [0, 2, 4, 6, 8]:
                    delta = target - 4
                    keys += (b'\x1b[D' if delta < 0 else b'\x1b[C') * abs(delta)
                    keys += b'\x1b[B' * (18 if target == 0 else 19)
                keys += b'\x1b[B' * 210 + b'r'
                os.write(master, keys)
                output += drain(master, 0.2)
                assert b'Score: 300' in output
                assert b'Game over' in output
                # Restart is the last rendered frame before quit.
                assert b'Score: 0' in output.split(b'\x1b[H')[-1]
                os.write(master, b'q')
            else:
                os.write(master, b'pq')
            output += drain(master, 0.2)
            process.wait(timeout=5)
            assert process.returncode == 0
            assert b'\x1b[?25h' in output
            assert termios.tcgetattr(slave) == before
            print(f'{piece}: npm start, ANSI {colour}, down/pause/resume/quit, termios restored')
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=5)
            os.close(master)
            os.close(slave)
