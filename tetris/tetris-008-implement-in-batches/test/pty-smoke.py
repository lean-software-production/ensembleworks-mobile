"""Run explicitly: python3 test/pty-smoke.py (POSIX PTY required)."""
import os, pty, termios, fcntl, struct, subprocess, time, select
from pathlib import Path

for mode in ('quit', 'interrupt', 'pending-escape', 'pending-csi', 'pending-ss3'):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))
    before = termios.tcgetattr(slave)
    env = dict(os.environ, NODE_OPTIONS='--import=' + str(Path('test/support/palette.mjs').resolve()))
    proc = subprocess.Popen(['npm', 'start', '--silent'], stdin=slave, stdout=slave, stderr=slave, env=env)
    captured = bytearray()
    def drain(seconds):
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            if select.select([master], [], [], .02)[0]:
                captured.extend(os.read(master, 65536))
    drain(.6)
    assert b'\x1b[?25l' in captured
    assert not termios.tcgetattr(slave)[3] & termios.ICANON
    # Private/colon CSI must not pause or quit, including split delivery.
    os.write(master, b'\x1b[?')
    drain(.03)
    os.write(master, b'1p\x1b[1:')
    drain(.03)
    os.write(master, b'2q')
    drain(.05)
    # Unsupported SS3 finals must not leak pause, quit or restart bindings.
    os.write(master, b'\x1bOp\x1bOr\x1bO')
    drain(.03)
    os.write(master, b'q')
    drain(.05)
    assert proc.poll() is None
    assert b'PAUSED' not in captured
    if mode == 'quit':
        for _ in range(7):
            os.write(master, b'\x1b[B' * 20)
            drain(.05)
        for color in (96, 93, 95, 92, 91, 94, 33):
            assert ('\x1b[%dm' % color).encode() in captured, color
        os.write(master, b'ppq')
    else:
        if mode.startswith('pending-'):
            os.write(master, {'pending-escape': b'\x1b', 'pending-csi': b'\x1b[1:',
                              'pending-ss3': b'\x1bO'}[mode])
            drain(.03)
        os.write(master, b'\x03')
    drain(.3)
    proc.wait(timeout=5)
    assert proc.returncode == 0
    assert termios.tcgetattr(slave) == before, 'termios not restored'
    assert b'\x1b[?25h' in captured
    os.close(master); os.close(slave)
    print('npm start PTY:', mode, 'passed; termios restored', '; seven ANSI colours observed' if mode == 'quit' else '')
