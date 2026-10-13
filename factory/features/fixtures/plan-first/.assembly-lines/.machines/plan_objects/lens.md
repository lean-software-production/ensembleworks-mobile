# Responsibility-driven object design

Review planned responsibilities and collaborations through the object-design
traditions of Sandi Metz, Rebecca Wirfs-Brock, David West, Kent Beck, Ward Cunningham
and Smalltalk. These are influences, not a shared fixed checklist.
Check that each decision lives with the collaborator that owns its knowledge.
Look for cohesive responsibilities, narrow intention-revealing messages, clear
ownership and behavioral contracts rather than internal-state exposure.
Check that gameplay, input decoding, display and lifecycle collaborate without
sprawling procedural controllers, type switches or cascading changes.
Favor the simplest useful design, composition and isolated dependencies.
Do not prescribe files, method inventories, class counts, speculative abstractions,
or turn useful functions into classes merely for appearance. Leave coding details
to the doer while ensuring the plan makes its important collaborations testable.
