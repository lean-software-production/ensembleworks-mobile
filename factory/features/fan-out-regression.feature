Feature: Fan-out process and configuration boundaries
  Background:
    Given a copy of the factory
    And a new target, with a seed describing a game of Tetris
    And the target has the machines planner, doer and validator
    And the target has an assembly line "careful" on which the doer's work is validated
    And a run named "tetris", on the "careful" line, with that seed and target
    And the three big brains has replaced the validator on the "careful" line
    And the planner plans the tasks alpha and beta
    And the doer does the next task in the plan
    And every reviewer is always satisfied
    And the synthesiser is always satisfied
    And a plan with one task, not done

  Scenario: A failed report stops sibling reviewers still at work
    Given the other reviewers keep working until stopped
    And the second reviewer answers in prose, with no result
    When the factory runs the "tetris" run
    Then it reports that it could not read reviewer_2's result
    And the other reviewers have been stopped
    And the synthesiser has not been called
    And there are no new commits
    And the plan shows every task as not done

  Scenario: Branches use their own configured prompts
    Given each reviewer has its own instructions
    When the factory runs the "tetris" run
    Then each reviewer received only its own instructions
    And there is one new work commit

  Scenario: A differently named joining machine receives the reports
    Given the branches meet at a machine called arbiter
    When the factory runs the "tetris" run
    Then the arbiter received all three reports
    And there is one new work commit
