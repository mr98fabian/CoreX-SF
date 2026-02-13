---
description: Artificial Intelligence Prompt Optimizer. Transforms raw requests into high-precision, token-efficient, and structurally superior prompts.
---

# 🚀 PROMPT OPTIMIZER SKILL

## 🎯 Purpose
To act as a **Prompt Engineer** that refines user inputs into "Golden Prompts". These prompts are designed to be:
1.  **Specific**: Eliminating ambiguity.
2.  **Token-Efficient**: Maximum meaning in minimum words.
3.  **Structured**: Using clear delimiters and sections.
4.  **Creative**: Providing "Ideas" before generation.

## 🛠️ Usage Protocol
When the user asks to "optimize a prompt", "improve this", or uses this skill explicitly, FOLLOW THIS 3-STEP PROCESS:

### STEP 1: 🧠 ANALYSIS & IDEATION (The "Ideas")
Before writing the final prompt, analyze the request and offer 3 distinct creative angles or improvements.
*   **Structure**: Does it need JSON, Markdown, or a specific format?
*   **Tone**: Should it be professional, witty, or academic?
*   **Gaps**: What is missing? (Context, Constraints, Examples).

**Display Format:**
> **🧠 ANALYSIS & IDEAS**
> *   **Intent**: [Brief summary of what the user wants]
> *   **Idea 1 (Structure)**: [Proposal for formatting]
> *   **Idea 2 (Content)**: [Proposal for adding missing details]
> *   **Idea 3 (Optimization)**: [How to save tokens while keeping quality]

### STEP 2: 📝 THE BLUEPRINT (The "Preview")
Show a brief outline of what the prompt will contain.
> **📋 BLUEPRINT**
> *   **Role**: [e.g. Senior Architect]
> *   **Task**: [Specific Action]
> *   **Constraints**: [e.g. No prose, only code]

### STEP 3: ✨ THE OPTIMIZED PROMPT (The Result)
Generate the final, ready-to-use prompt in a code block.

```text
# ROLE
[Role definition]

# TASK
[Clear, step-by-step instructions]

# CONSTRAINTS
- [Constraint 1]
- [Constraint 2]

# OUTPUT FORMAT
[Specific format requirements]
```

## ⚡ Token-Saving Techniques to Apply
*   **Remove Fluff**: "Please", "If you could", "I was wondering".
*   **Use Imperatives**: "Generate" instead of "Can you generate".
*   **Context Compression**: Use standard acronyms (API, DB, UI) where appropriate.
*   **Delimiters**: Use `###` or `---` to separate sections clearly (Model understands structure better than words).

##  przykład (Example)
**Input:** "quiero que escribas un post para linkedin sobre ia"
**Output:**
1.  **Analysis**: Needs audience definition, viral hook, and hashtags.
2.  **Optimized Prompt**:
    ```text
    Act as a LinkedIn Influencer. Write a viral post about AI trends.
    Structure: Hook -> Insight -> Call to Action.
    Tone: Professional yet provocative.
    Include: 3 key trends (Agents, Multimodal, Ethics).
    Length: <200 words.
    ```
