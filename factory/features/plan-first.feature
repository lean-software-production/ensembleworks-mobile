Feature: Review a comprehensive plan before implementing it
  Background:
    Given a copy of the factory
    And a new target, with a seed describing a game of Tetris
    And the target has the plan-first line with four review lenses
    And a run named "tetris", on the "plan-first" line, with that seed and target
    And the planner plans the tasks alpha and beta
    And the doer does the next task in the plan
    And the validator is always satisfied

  Scenario: The entire plan is reviewed once before task execution
    When the factory runs the "tetris" run
    Then the plan-first run committed 2 tasks
    And the four plan reviewers were called 1 times each
    And planning and execution received distinct contracts
    And every task was validated against the accepted plan
    And the plan review decision and reports were saved outside the target

  Scenario: Required planning changes return to the author before implementation
    Given the plan synthesiser rejects the first round
    When the factory runs the "tetris" run
    Then the plan-first run committed 2 tasks
    And the four plan reviewers were called 2 times each
    And the author received the synthesis findings before any implementation
    And the second review focused on the revised plan

  Scenario: The synthesiser can override a reviewer with a recorded reason
    Given a plan reviewer has a blocking objection
    When the factory runs the "tetris" run
    Then the plan-first run committed 2 tasks
    And the accepted decision explains the reviewer's unresolved objection

  Scenario: Three rejected rounds stop implementation and cannot be bypassed by resuming
    Given the plan synthesiser never accepts
    When the factory runs the "tetris" run
    Then plan review stopped after 3 rounds without implementing or committing
    When the factory runs the "tetris" run, given only its name
    Then plan review stopped after 3 rounds without implementing or committing

  Scenario: A plan defect is repaired without committing rejected work
    Given implementation exposes a plan defect on its first validation
    When the factory runs the "tetris" run
    Then the plan-first run committed 2 tasks
    And rejected work stayed uncommitted through plan repair
    And the four plan reviewers were called 2 times each
    And the repair author and reviewers received the affected contracts

  Scenario: Plan repair does not reset the current task's implementation attempt limit
    Given implementation exposes a plan defect on its first validation
    And the factory allows at most one attempt at a task
    When the factory runs the "tetris" run
    Then plan repair exhausted the implementation attempt limit without a commit

  Scenario: An implementation defect stays in the doer-validator loop
    Given the validator is not satisfied the first time
    When the factory runs the "tetris" run
    Then the plan-first run committed 2 tasks
    And the four plan reviewers were called 1 times each
    And implementation retried within the accepted plan

  Scenario: A repair must not advance the doer to another task with rejected work pending
    Given implementation exposes a plan defect on its first validation
    And the repair author incorrectly marks the current task done
    When the factory runs the "tetris" run
    Then switching tasks during repair stopped the run without a commit

  Scenario: Resuming an accepted plan does not spend another planning review round
    When the factory runs the "tetris" run
    And the factory runs the "tetris" run, given only its name
    Then the plan-first run committed 2 tasks
    And the four plan reviewers were called 1 times each
    And the accepted plan was authored only once

  Scenario: A malformed plan report prevents synthesis and implementation
    Given a plan reviewer omits its findings array
    When the factory runs the "tetris" run
    Then a malformed plan report stopped the run before synthesis or implementation

  Scenario: The synthesiser must explain an override before implementation
    Given a plan reviewer has a blocking objection
    And the plan synthesiser omits that finding's disposition
    When the factory runs the "tetris" run
    Then an unexplained plan objection stopped implementation

  Scenario: Factory commit receipts supersede the doer's historical pending notes
    Given the doer reports validation and commit as pending
    When the factory runs the "tetris" run
    Then the plan-first run committed 2 tasks
    And the planner receives authoritative validation and commit receipts
