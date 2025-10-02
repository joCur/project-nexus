\# Implement Command



You are tasked with implementing a plan Step-by-Step in an organized and methodical fashion. Follow these steps:



\## Implementation Process



1\. \*\*Load the Plan\*\*: First, look for the plan and read it

2\. \*\*Architecture Compliance Review\*\*: Before implementation, reference `.claude/workflows/architecture-compliance.md` and:

&nbsp;   - Review relevant sections of `project-documentation/architecture-guide.md`

&nbsp;   - Verify enum standardization requirements (Section 4: use TypeScript enums with lowercase values)

&nbsp;   - Plan state management approach (Apollo vs Zustand)

&nbsp;   - Add "Run architecture compliance verification" as final todo task

3\. \*\*Set Up Tracking\*\*: Use the TodoWrite tool to create a todo list based on the plan's implementation tasks

4\. \*\*Implement Step-by-Step\*\*: Work through each task systematically using TDD:

&nbsp;   - Mark current task as in\_progress

&nbsp;   - **Write tests FIRST** following TDD approach (RED phase)

&nbsp;   - Implement the task to make tests pass (use the most appropriate subagent) (GREEN phase)

&nbsp;   - Refactor for quality while keeping tests green (REFACTOR phase)

&nbsp;   - **Run ALL related tests** to verify no regression (VERIFY phase)

&nbsp;   - You MUST update the plan as you go

&nbsp;   - Mark task as completed before moving to next

5\. \*\*Validate Progress\*\*: After each major task, ensure the implementation works as expected

6\. \*\*Architecture Compliance Verification\*\*: Before marking implementation complete:

&nbsp;   - Run all quality gates: `npm run type-check && npm run lint && npm test`

&nbsp;   - Verify enum standardization compliance (no string literal unions)

&nbsp;   - Check state management follows guide (server data in Apollo, UI state in Zustand)

&nbsp;   - Confirm error handling uses structured logging (no console.log)

&nbsp;   - Reference Architecture Compliance Checklist in `architecture-guide.md`



\## Implementation Guidelines



\- \*\*Follow the Plan\*\*: Stick to the tasks outlined in the plan unless you discover issues that require deviation

\- \*\*One Task at a Time\*\*: Only work on one task at a time, completing it fully before moving on

\- \*\*Orchestration First\*\*: Orchestrate implementation tasks to the appropriate subagent, don't write code yourself

\- \*\*Test as You Go\*\*: Run tests, lints, and basic validation after each significant change

\- \*\*Update Documentation\*\*: Keep any relevant documentation updated as you implement

\- \*\*Handle Blockers\*\*: If you encounter issues not anticipated in the plan, create additional todos to track resolution

\- \*\*Keep Track\*\*: Use the plan as a living document, updating as needed



\## Task Management



\- Use TodoWrite tool to track all implementation tasks

\- Mark tasks as in\_progress when starting work

\- Mark tasks as completed immediately after finishing

\- Add new tasks if you discover additional work needed

\- Break down large tasks into smaller ones if needed



\## Quality Assurance



\- Make sure the code builds after code changes

\- Execute relevant tests to ensure nothing breaks

\- Follow existing code patterns and conventions

\- Ensure proper error handling and edge case coverage

\- \*\*Architecture Compliance\*\*: All implementations must conform to standards in `project-documentation/architecture-guide.md`:

&nbsp;   - Use TypeScript enums with lowercase values (Section 4)

&nbsp;   - Follow state management strategy (Section 2)

&nbsp;   - Implement proper error handling (Section 3)

&nbsp;   - Reference `.claude/workflows/architecture-compliance.md` for detailed checklist



\## Communication



\- Keep the user informed of progress without being verbose

\- Report any deviations from the original plan and why

\- Ask for clarification if plan details are unclear

\- Summarize what was accomplished at the end



---



\*\*Plan to implement\*\*: {{ARGS}}



If no plan name is provided, ask the user to specify which plan to implement. 

Then implement the plan following the step-by-step process above.

