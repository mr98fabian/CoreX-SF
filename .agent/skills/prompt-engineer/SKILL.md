---
description: A specialized skill for optimizing and extending prompts to be more specific, token-efficient, and structured.
---

# Prompt Optimizer Skill

This skill transforms vague or simple user requests into highly engineered, specific, and token-efficient prompts. It follows a "Preview-first" approach to ensure alignment before generation.

## When to Use
- When the user asks to "optimize this prompt".
- When a request is ambiguous and needs expansion.
- When the user wants "ideas" or "strategies" for their request before execution.

## The Process

### Phase 1: The Blueprint (Preview)
Before generating the final prompt, you must output a "Blueprint" block.
1.  **Analyze Intent**: Briefly state what the user *really* wants.
2.  **Strategy Ideas**: Propose 3 distinct angles or "Modes" for the prompt.
    *   *Example: "Mode A: Python Script", "Mode B: Full Web App", "Mode C: CLI Tool".*
3.  **Token Efficiency Check**: Identify fluff words to remove.

### Phase 2: The Optimized Prompt
Generate the final prompt using the following structure:
1.  **Role/Persona**: Define who the AI should be.
2.  **Context/Constraints**: specificy the environment, tools, and limitations.
3.  **The Task**: Clear, actionable steps.
4.  **Output Format**: Define exactly how the result should look.

## Example Interaction

**User:** "Help me write a prompt to create a snake game in python."

**Agent (Using Skill):**

### 🧠 Blueprint & Ideas
**Intent:** Create a functional Snake game.
**Token Efficiency:** Remove "Help me write...", focus on "Create Snake Game Python".

**Strategic Angles:**
1.  **Classic Arcade**: Simple, no libraries (Curses or Pygame).
2.  **Modern GUI**: Uses Pygame with sound and sprites.
3.  **AI Researcher**: Snake game with an RL agent capabilities.

---

### 🚀 Optimized Prompt (Option 2 - Modern GUI)

```markdown
**Role:** Senior Python Game Developer.
**Task:** Create a production-ready 'Snake' game using `pygame`.
**Requirements:**
1.  **OOP Design:** Separate `Snake`, `Food`, and `Game` classes.
2.  **Features:** Score tracking, increasing speed, game over screen, restart mechanic.
3.  **Visuals:** Dark mode aesthetic, neon colors for snake/food.
**Constraints:** Single file implementation (<300 lines). Document with docstrings.
**Output:** Full Python code block ready to run.
```
