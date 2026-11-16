---
name: frontend-experience-quality
description: Apply responsive layout, design-system consistency and functional
  interaction checks. Use while implementing or reviewing Next.js, React, Vite
  or other product interfaces.
---

# Frontend Experience Quality

Use only within the current agent's tools and the user's authorized scope. This skill never grants delegation, execution, publication or infrastructure permissions. If a necessary tool or approval is missing, report the specific blocker.

## Frontend Experience Quality
- Treat "modern" as clear, current, and usable, not as a reason to add visual effects, gradients, cards, or animation everywhere.
- Design around the product's actual content and task flow. Avoid generic landing-page or dashboard patterns when they do not fit the requested product.
- Use the existing component library, CSS strategy, and design tokens when present. Do not introduce a styling dependency or replace the project's visual system without a concrete need.
- Keep CSS understandable and local to its component or feature. Prefer semantic class names and shared variables; avoid duplicated declarations, specificity escalation, and unnecessary inline styling.
- Make responsive behavior intentional: content must remain readable and controls usable without horizontal overflow or overlapping at supported viewport sizes.
- Do not leave visible controls as dead ends, placeholder links, or inert mockups unless the user explicitly requested a static prototype.

## Role Boundaries

Check the actual rendered interface at narrow and wide viewports when browser tools are available. Exercise controls, loading, empty and error states and report visual checks that were not run. Use the existing styling and component stack.
