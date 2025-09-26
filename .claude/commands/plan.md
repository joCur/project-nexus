\# Plan Command



You are tasked with creating a detailed phased implementation plan for the given input. Follow these steps:



\## Planning Process



1\. \*\*Analyze the Request\*\*: Carefully examine the user's input to understand what they want to implement

2\. \*\*Gather Information\*\*: 

&nbsp;  - Seek clarification from the user if any information is ambiguous or unclear

&nbsp;  - Research the topic as needed to ensure accuracy

3\. \*\*Create a Plan\*\*: Develop a detailed phased implementation plan that includes:

&nbsp;  - Clear objective and scope (think MVP, don't overplan)

&nbsp;  - Technical approach and reasoning

&nbsp;  - Broken down phases with tasks

&nbsp;  - Dependencies and prerequisites

&nbsp;  - Potential challenges and considerations



3\. \*\*Write the Plan\*\*: Save the plan to `.claude/plans/{PLAN\_NAME}.md` where PLAN\_NAME is a descriptive name based on the request



4\. \*\*Request Review\*\*: After writing the plan:

&nbsp;  - Present it to the user 

&nbsp;  - You MUST NOT implement the plan



\## Plan Structure



Your plan should follow this markdown structure:



```markdown

\# \[Plan Title]



\## Objective and Scope

Brief description of what we're implementing



\## Technical Approach and Reasoning

High-level technical approach and reasoning behind decisions



\## Implementation Phases



\### Phase 1: Brief description

\- \[ ] Task 1.1: Brief description

&nbsp; - Detailed actionable implementation step 1

&nbsp; - Detailed actionable implementation step 2

&nbsp; - Detailed actionable implementation step 3

\- \[ ] Task 1.2: Brief description

&nbsp; - Detailed actionable implementation step 1



\### Phase 2: Brief description

\- \[ ] Task 2.1: Brief description

&nbsp; - Detailed actionable implementation step 1

&nbsp; - Detailed actionable implementation step 2

\- \[ ] Task 2.2: Brief description

&nbsp; - Detailed actionable implementation step 1

&nbsp; - Detailed actionable implementation step 2

&nbsp; - Detailed actionable implementation step 3

\- \[ ] Task 2.3: Brief description

&nbsp; - Detailed actionable implementation step 1

&nbsp; - Detailed actionable implementation step 2



\### Phase 3: Brief description

\- \[ ] Task 3.1: Brief description

&nbsp; - Detailed actionable implementation step 1



\## Dependencies and Prerequisites

\- List any dependencies or prerequisites

\- External libraries, APIs, etc.



\## Challenges and Considerations

\- Potential challenges

\- Edge cases to handle

```



\## Important Guidelines

\- Think MVP first - avoid overplanning

\- Break down complex tasks into smaller, manageable pieces

\- Focus on implementation details, not just high-level concepts

\- Determine the appropriate level of detail based on requirement complexity

\- Consider existing codebase patterns and conventions

\- Include reasoning for technical decisions

\- Do not care about backwards compatibility when considering a design or implementation



---



\*\*Input to plan\*\*: {{ARGS}}



Create an implementation plan for the above input following the guidelines above.

