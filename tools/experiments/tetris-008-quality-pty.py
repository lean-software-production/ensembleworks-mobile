#!/usr/bin/env python3
"""Uniform real-PTY probes of the frozen production entries, no implementation edits."""
import fcntl,json,os,pty,select,signal,struct,subprocess,termios,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def check(mode,name,chunks,should_exit):
 master,slave=pty.openpty();fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack('HHHH',24,80,0,0));before=termios.tcgetattr(slave)
 proc=subprocess.Popen(['node','src/main.js'],cwd=ROOT/'tetris'/('tetris-008-'+mode),stdin=slave,stdout=slave,stderr=slave,start_new_session=True)
 output=bytearray()
 def drain(seconds):
  end=time.monotonic()+seconds
  while time.monotonic()<end:
   if select.select([master],[],[],min(.02,max(0,end-time.monotonic())))[0]:
    try:output.extend(os.read(master,65536))
    except OSError:break
 try:
  deadline=time.monotonic()+2
  while proc.poll() is None and time.monotonic()<deadline:
   if not termios.tcgetattr(slave)[3]&termios.ICANON:break
   drain(.02)
  ready=proc.poll() is None and not termios.tcgetattr(slave)[3]&termios.ICANON
  for chunk in chunks:os.write(master,chunk);drain(.08)
  drain(.45);observed_exit=proc.poll();condition=observed_exit==0 if should_exit else observed_exit is None
  record={'id':name,'passed':bool(ready and condition),'ready_in_raw_mode':ready,'bytes_hex':[c.hex() for c in chunks],'expected':'exit 0' if should_exit else 'remain running','observed_exit':observed_exit}
  if proc.poll() is None:os.write(master,b'q');drain(.15)
  if proc.poll() is None:os.killpg(proc.pid,signal.SIGTERM)
  proc.wait(timeout=2);record['terminal_restored_after_cleanup']=termios.tcgetattr(slave)==before
  return record
 finally:
  if proc.poll() is None:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
  os.close(master);os.close(slave)
observations=[]
for mode in ['ralph','one-shot','implement-in-batches']:
 checks=[check(mode,'ordinary_quit',[b'q'],True),check(mode,'ordinary_ctrl_c',[b'\x03'],True),check(mode,'ctrl_c_after_escape',[b'\x1b',b'\x03'],True),check(mode,'unknown_osc_q_payload',[b'\x1b]0;q\x07'],False)]
 observations.append({'mode':mode,'checks':checks})
print(json.dumps({'scope':'Same actual node src/main.js production launch in an 80x24 PTY; byte input without Enter. This is a new post-run audit, not an edit to the original acceptance observation.','observations':observations},indent=2))
