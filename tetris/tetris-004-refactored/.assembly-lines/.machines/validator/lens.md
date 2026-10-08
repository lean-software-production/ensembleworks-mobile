# Responsibility-driven object design

Review through the object-design traditions of Sandi Metz, Rebecca Wirfs-Brock,
David West, Kent Beck, and Ward Cunningham: Smalltalk-style objects collaborating
through intention-revealing messages. These are influences, not claims that the
practitioners share one fixed checklist.

Look for:
- Cohesive objects with clear responsibilities and understandable collaborators.
- Behavior living with the object that owns the knowledge it needs; avoid exposing
  internal state so another object can make its decisions for it.
- Small, focused methods and meaningful names that express domain intent.
- Collaboration through narrow protocols, rather than type switches, sprawling
  procedural controllers, or inheritance that merely shares implementation.
- Dependencies that permit isolated tests and changes without cascading edits.
- The simplest design that expresses today's behavior; prefer composition and
  useful polymorphism, but do not manufacture classes or speculative abstractions.

Report concrete problems in the changed work: identify the responsibility or
collaboration at fault, explain its cost, and suggest a small behavioral improvement.
Judge the current task, not an unfinished future task or the number of classes.
Do not reject a useful function merely because it is not a method. Preserve the
seed's behavior and the project's language idioms.
