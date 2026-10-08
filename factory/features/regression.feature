Feature: Public entrypoint and commit-boundary regression checks
  Background:
    Given a copy of the factory
    And a new target, with a seed describing a game of Tetris
    And the target has the machines planner, doer and validator
    And the target has an assembly line "careful" on which the doer's work is validated
    And a run named "tetris", on the "careful" line, with that seed and target
    And the planner plans the tasks alpha and beta
    And the doer does the next task in the plan
    And the validator is always satisfied

  Scenario: A lens file beside the validator's configuration goes to the validator
    Given a plan with three tasks, none of them done
    And the validator's lens is kept in a file beside its configuration, saying "object-oriented design"
    When the factory runs the "tetris" run
    Then the validator was given "object-oriented design"

  Scenario: A run's plan and the target's lines stay out of the work commits
    Given a plan with three tasks, none of them done
    When the factory runs the "tetris" run
    Then there are three new work commits
    And each new work commit contains the work for one task
    And there is no plan in the target
    And the target has no uncommitted changes

  Scenario: A large generated lockfile can be validated and committed
    Given a plan with one pending task
    And the next task generates a large lockfile
    When the factory runs the "tetris" run
    Then the validator receives the entire lockfile diff through stdin
    And there is one new work commit
    And the plan shows every task as done
    And the target has no uncommitted changes

  Scenario: A failed commit does not advance the plan
    Given a plan with three tasks, none of them done
    And Git rejects the commit
    When the factory runs the "tetris" run
    Then it reports the Git commit failure
    And there are no new commits
    And the plan shows every task as not done
    And the planner has not been asked to record committed work

  Scenario: Unrelated staged changes are not committed with the target
    Given a separate target with an unrelated staged change beside it
    And a plan with one pending task
    When the factory runs the "tetris" run
    Then there is one new work commit
    And the unrelated change remains staged and uncommitted

  Scenario: Existing tracked files can be edited in a nested target
    Given a separate target with an unrelated staged change beside it
    And a plan with one pending task
    And the next task edits an existing tracked file
    When the factory runs the "tetris" run
    Then there is one new work commit
    And the tracked task file's change is committed
    And the unrelated change remains staged and uncommitted

  Scenario: A staged rename removes the original tracked path from history
    Given a separate target with an unrelated staged change beside it
    And a plan with one pending task
    And the next task edits an existing tracked file
    And the doer renames the existing tracked task file
    When the factory runs the "tetris" run
    Then there is one new work commit
    And the renamed task file is committed without the original path
    And the target has no uncommitted changes
    And the unrelated change remains staged and uncommitted

  Scenario: A task without committable work does not advance the plan
    Given a plan with three tasks, none of them done
    And the doer produces no file changes
    When the factory runs the "tetris" run
    Then it reports that there is no committable work
    And there are no new commits
    And the plan shows every task as not done
    And the planner has not been asked to record committed work

  Scenario: Creating a plan is not committable project work
    Given no plan
    And the doer produces no file changes
    When the factory runs the "tetris" run
    Then it reports that there is no committable work
    And there are no new commits
    And the plan shows every task as not done
    And the planner has not been asked to record committed work

  Scenario: An invalid last JSON line does not fall back to an earlier verdict
    Given a plan with three tasks, none of them done
    And the validator follows its verdict with JSON that has no verdict fields
    When the factory runs the "tetris" run
    Then it reports that the result of validator has no field "satisfied"
    And there are no new commits
    And the plan shows every task as not done

  Scenario: Alternate result fields route successfully when the machine answers them
    Given a plan with three tasks, none of them done
    And the edges from validator are labelled "approved" and "not approved"
    And the validator explicitly answers with the field "approved"
    When the factory runs the "tetris" run
    Then the validator was asked for a result with the fields "approved" and "findings"
    And there are three new work commits
    And each new work commit contains the work for one task
    And the plan shows every task as done
    And the target has no uncommitted changes

  Scenario: Relative paths are resolved from a different caller through the public symlink
    Given a plan with three tasks, none of them done
    And the caller is in a different folder
    When the factory runs the "tetris" run
    Then the public entrypoint is the symlink to the separate factory
    And the doer was pointed at the plan and at the seed
    And there are three new work commits
    And the target has no uncommitted changes
