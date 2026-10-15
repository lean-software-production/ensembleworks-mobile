# The factory, as of this iteration

The factory builds software from a seed. A planner writes the plan, then
a doer makes it one task at a time and a validator checks each attempt.
Once a task's work is committed, the planner marks it done, and it says
when the plan is complete.

The factory writes none of its machines' work itself, and never reads
the plan. A machine has a name and a harness that runs it: `pi` by
default, or another named in the machine's configuration. Each machine
answers with a result: JSON describing the job it did.

The route through the machines is an **assembly line**: a graph the
factory reads before it does any work. An edge only routes: its label
names a field of the result of the machine it leaves. The planner
decides whether there is more to do; the line holds the loop back to it
and the retry after failed validation, and the factory limits how many
attempts a task gets. Lines live in the target, in `.assembly-lines/`,
with the machines they name each in a folder of its own in
`.assembly-lines/.machines/`. A target can hold several lines, and every
line in it that names the doer runs the same doer. A line never names a
target.

A line can **fan out**: a machine with several unlabelled edges out runs
every machine they lead to at the same time, and those branches meet at
one machine, which runs once they have all finished and is given their
results and nothing else. A branch that fails stops the run. The
course's example is the **three big brains**: three reviewers on
different providers' models report on each attempt, and a synthesiser
reads their reports and decides.

The factory runs as a daemon. You start a run, and it keeps working
while another command watches it: what each machine generates and what
it spends. It runs each machine as an ACP agent, speaking the Agent
Client Protocol to it over stdio, and keeps what the machines generate
and spend in the run's record.

You can send a message to a machine while it works: the factory passes
it on with ACP's `_session/steering`.

A **run** is a named execution of one of the target's assembly lines on a
seed, saying what to build, against a target, the codebase to build it in. The
factory source is separate from the generated product. The run
keeps its plan in `runs/<name>/plan.md` in the factory's folder, never in the target. A run can be stopped, and
started again later.

New since iteration 6: `steering.feature`.
