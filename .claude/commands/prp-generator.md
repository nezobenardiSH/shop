# PRP Generator Command

You are a software requirements specialist creating a Lean PRP document using the skeleton-first approach.

## Your Task
Transform the project idea into a structured, technical requirements document.

## Input Source
1. **First, check if `docs/idea-summary.md` exists**
   - If it exists, read it to get the project context from the /start command
   - Use this as the foundation for your PRP document
   
2. **If idea-summary doesn't exist or user has additional requirements:**
   - Ask for any missing information:
     - Core software idea (if not in summary)
     - Preferred tech stack (or say "recommend") 
     - Complexity level (simple: 5-8 tasks, medium: 8-12 tasks)
     - Any specific constraints

**Always reference the idea-summary if it exists to maintain consistency.**

## Output Structure
Create this exact structure:

### 1. Core Identity
[1-2 sentences describing what this software does]

### 2. Single Success Scenario  
- User does: [specific action]
- System responds: [expected response]
- User verifies: [observable result]

### 3. User Flows
**PRIMARY FLOW:**
1. User starts at [initial state]
2. User performs [action] → system shows [response]
3. Result: [end state that proves it works]

**ERROR HANDLING:** [Basic error scenarios only]

### 4. Technical Stack & Architecture
**STACK:**
- Frontend: [specific choice]
- Backend: [specific choice or "None"]
- Data Storage: [localStorage/files/simple database]  
- Deployment: [Local/cloud platform]

**FILE STRUCTURE:** [List 3-5 key files]

### 5. API Design & Data Models
**DATA MODELS:** [1-2 core structures with fields]
**ENDPOINTS:** [2-3 essential endpoints if applicable]
**STORAGE:** [How data gets saved/retrieved]

### 6. Core Functions & Data Flow
**FUNCTIONS:** [4-6 essential functions]
**FLOW:** [How data moves through system]
**INTEGRATION:** [How components connect]

### 7. Dependencies & Constraints
**ALLOWED:** [Max 3 specific libraries]
**FORBIDDEN FOR SKELETON:** [What to avoid initially]
**LIMITS:** [Specific skeleton constraints]

### 8. Code Quality Requirements
- Verbose, readable code over compact solutions
- Maximum 15 lines per function
- Descriptive variable names
- Comments explaining business logic
- No nested ternary operators
- Separate files for different concerns

### 9. Definition of Done
**SKELETON COMPLETE WHEN:**
- All core functions work manually testable
- Single success scenario passes
- Code is verbose and readable
- Foundation ready for expansion

## Output
Save the completed PRP document to `docs/prp.md`

## Requirements
- Keep total PRP under 1,200 tokens
- Be specific, not generic
- Focus on skeleton/MVP functionality only
- Use concrete examples in each section
- Build on the context from `docs/idea-summary.md` if it exists
- Ask clarifying questions only for missing information

Begin by checking for `docs/idea-summary.md` and then proceed with PRP generation.