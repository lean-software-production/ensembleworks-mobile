Feature: Public entrypoint and commit-boundary regression checks
  Background:
    Given a copy of the factory
    And a new target
    And a seed describing a game of Tetris
    And the planner plans the tasks alpha and beta
    And the doer does the next task in the plan
    And the validator is always satisfied

  Scenario: The selected OO-design lens is the default
    Given a plan with three tasks, none of them done
    When the factory runs
    Then the validator was given "Sandi Metz"
    And the validator was given "Rebecca Wirfs-Brock"
    And the validator was given "David West"
    And the validator was given "Kent Beck"
    And the validator was given "Ward Cunningham"
    And the validator was given "Smalltalk"

  Scenario: A failed commit does not advance the plan
    Given a plan with three tasks, none of them done
    And Git rejects the commit
    When the factory runs
    Then it reports the Git commit failure
    And there are no new commits
    And the plan shows every task as not done
    And the planner has not been asked to record committed work

  Scenario: Unrelated staged changes are not committed with the target
    Given a separate target with an unrelated staged change beside it
    And a plan with one pending task
    When the factory runs
    Then there is one new work commit
    And the committed plan matches the plan on disk
    And the unrelated change remains staged and uncommitted

  Scenario: Existing tracked files can be edited in a nested target
    Given a separate target with an unrelated staged change beside it
    And a plan with one pending task
    And the next task edits an existing tracked file
    When the factory runs
    Then there is one new work commit
    And the tracked task file's change is committed
    And the unrelated change remains staged and uncommitted

  Scenario: A staged rename removes the original tracked path from history
    Given a separate target with an unrelated staged change beside it
    And a plan with one pending task
    And the next task edits an existing tracked file
    And the doer renames the existing tracked task file
    When the factory runs
    Then there is one new work commit
    And the renamed task file is committed without the original path
    And the committed plan matches the plan on disk
    And the target has no uncommitted changes
    And the unrelated change remains staged and uncommitted

  Scenario: A task without committable work does not advance the plan
    Given a plan with three tasks, none of them done
    And the doer produces no file changes
    When the factory runs
    Then it reports that there is no committable work
    And there are no new commits
    And the plan shows every task as not done
    And the planner has not been asked to record committed work

  Scenario: Creating a plan is not committable project work
    Given no plan
    And the doer produces no file changes
    When the factory runs
    Then it reports that there is no committable work
    And there are no new commits
    And the plan shows every task as not done
    And the planner has not been asked to record committed work

  Scenario: An invalid last JSON line does not fall back to an earlier verdict
    Given a plan with three tasks, none of them done
    And the validator follows its verdict with JSON that has no verdict fields
    When the factory runs
    Then it reports that the result of validator has no field "satisfied"
    And there are no new commits
    And the plan shows every task as not done

  Scenario: Alternate result fields route successfully when the machine answers them
    Given a plan with three tasks, none of them done
    And the edges from validator are labelled "approved" and "not approved"
    And the validator explicitly answers with the field "approved"
    When the factory runs
    Then the validator was asked for a result with the fields "approved" and "findings"
    And there are three new work commits
    And each new work commit contains the work for one task
    And the plan shows every task as done
    And the committed plan matches the plan on disk
    And the target has no uncommitted changes

  Scenario: Relative paths are resolved from a different caller through the public symlink
    Given a plan with three tasks, none of them done
    And the caller is in a different folder
    When the factory runs
    Then the public entrypoint is the symlink to the separate factory
    And the doer was pointed at the plan and at the seed
    And there are three new work commits
    And the committed plan matches the plan on disk
    And the target has no uncommitted changes
