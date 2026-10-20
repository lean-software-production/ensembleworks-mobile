"""Real npm launch on a 52x24 PTY; verify ANSI palette and termios restoration."""
import os
import subprocess
import termios
import fcntl
import struct
import select
import time
import signal
import re


def smoke(piece, interrupt=False):
    master, slave = os.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 52, 0, 0))
    before = termios.tcgetattr(slave)
    env = dict(os.environ, TETRIS_PIECES=piece)
    proc = subprocess.Popen(['npm', 'start', '--silent'], stdin=slave, stdout=slave,
                            stderr=slave, env=env, start_new_session=True)
    data = bytearray()

    def read_until(predicate, seconds=5):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            if predicate(bytes(data)):
                return
            if select.select([master], [], [], 0.05)[0]:
                data.extend(os.read(master, 65536))
        raise AssertionError(('PTY timeout', bytes(data)[-500:]))

    try:
        read_until(lambda b: b'Arrows:' in b)
        during = termios.tcgetattr(slave)
        assert not during[3] & termios.ICANON
        assert not during[3] & termios.ECHO
        color = dict(I=96, O=93, T=95, S=92, Z=91, J=94, L=33)[piece]
        assert ('\x1b[%dm[]' % color).encode() in data
        # Unsupported Alt+p/q/r, combined and split, must not dispatch.
        # A following direct arrow provides an observable recovery barrier.
        for chunks in [(b'\x1bp\x1bq\x1br',),
                       (b'\x1b', b'p\x1b', b'q\x1b', b'r')]:
            count = bytes(data).count(b'\x1b[H\x1b[2J')
            for chunk in chunks:
                os.write(master, chunk)
                time.sleep(0.03)
            os.write(master, b'\x1b[D')
            read_until(lambda b: b.count(b'\x1b[H\x1b[2J') > count)
            assert proc.poll() is None, 'Alt key terminated session'
            assert b'PAUSED' not in data, 'Alt+p paused session'
            assert bytes(data).count(b'\x1b[H\x1b[2J') == count + 1
        # Single-byte/split real arrow input, rotation, soft drop, pause/resume.
        os.write(master, b'\x1b[')
        time.sleep(0.03)
        os.write(master, b'D\x1b[C\x1b[A\x1b[Bp')
        read_until(lambda b: b'PAUSED' in b)
        os.write(master, b'p')
        time.sleep(0.03)
        if interrupt:
            os.killpg(proc.pid, signal.SIGINT)
        else:
            os.write(master, b'q')
        read_until(lambda b: b'\x1b[?25h' in b and b'\x1b[?1049l' in b)
        status = proc.wait(timeout=5)
        if not interrupt:
            assert status == 0, status
        assert termios.tcgetattr(slave) == before, 'termios not restored'
        frames = bytes(data).split(b'\x1b[H\x1b[2J')[1:]
        assert len(frames) >= 5
        for frame in frames:
            frame = frame.split(b'\x1b[0m\x1b[?25h')[0]
            plain = re.sub(rb'\x1b\[[0-9;?]*[A-Za-z]', b'', frame).replace(b'\r', b'')
            rows = plain.split(b'\n')
            assert len(rows) == 24, len(rows)
            assert all(len(row) < 52 for row in rows)
        print('PTY npm start:', piece, 'ANSI %d' % color,
              'SIGINT' if interrupt else 'quit', 'raw/cursor/termios restored;', len(frames), 'bounded frames')
    finally:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait()
        os.close(master)
        os.close(slave)


for piece in 'IOTSZJL':
    smoke(piece)
smoke('O', interrupt=True)
