# Battle And Arcade Experience Design

## Goal

Improve DailyCoding's algorithm battle and arcade surfaces directly, not just the competition hub. The work should make players understand what to do next before, during, and after play.

## Scope

- Battle lobby guidance for current active battles and personal history.
- Algorithm battle room guidance for waiting, drafting, playing, spectator, and finished states.
- Arcade hub recommendations using existing best-score and leaderboard data.
- Arcade result goals that give a concrete next target after each game.

## Constraints

- No new dependencies.
- No database or API schema changes.
- Do not change battle scoring, judge, socket, or game engine rules.
- Keep Korean-first copy with English fallback.
- Use pure helper functions for decision logic and test them before UI wiring.
- Keep UI dense and useful; this is a product tool, not a landing page.

## Design Direction

The battle and arcade areas should feel like a control room for competitive practice. The visual signature is a compact "next move" strip: one strong recommendation, supporting metrics, and short action labels. This fits the product because users are choosing between live pressure, replay/rematch, and quick games.

The palette should stay inside the existing DailyCoding token system (`var(--blue)`, `var(--red)`, `var(--green)`, `var(--yellow)`, `var(--purple)`) instead of introducing a new theme. The aesthetic risk is structural: add tactical command strips to game surfaces rather than decorative banners.

## Battle Improvements

The classic battle lobby should compute one coaching message:

- If active battles exist, suggest spectating to learn live pacing.
- If recent history has losses, suggest a rematch or shorter practice.
- If recent history is strong, suggest a harder mode or longer duration.
- If no history exists, suggest sending the first invite.

The algorithm battle room should compute a phase helper:

- Waiting: show ready/invite/rules as next actions.
- Drafting: explain that draft choices are blocking start.
- Playing: show the win condition and current next action.
- Spectating: reinforce that actions are disabled.
- Finished: show replay/rematch/recovery direction.

## Arcade Improvements

The arcade hub should add a recommendation strip:

- Continue best game when the user has a best score.
- Try a quick game for short sessions.
- Chase a leaderboard when top data exists.

The game result screen should show one next target:

- Score games: beat current best or set first benchmark.
- Time games: shave a small amount off the last time.
- Survival games: survive a little longer.

## Verification

- Add helper tests for battle lobby guidance, algorithm room guidance, arcade recommendations, and arcade result goals.
- Run targeted Vitest tests.
- Run frontend lint/build or `npm run verify`.
- Use local browser smoke where possible; authenticated/socket flows may require local API state, so route/render proof is separate from full match proof.
