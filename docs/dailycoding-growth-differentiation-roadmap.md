# DailyCoding Growth and Differentiation Roadmap

## Current strengths to emphasize

DailyCoding already has a useful combination that many coding sites separate into different products:

- Daily habit loop: streaks, missions, recommendations, weekly challenges, and grass/activity views.
- Practice formats beyond plain coding: standard coding, fill-in-the-blank, bug-fix style problems, exams, and contests.
- Competitive loop: 1:1 battle, spectator/result sharing, ranking, tiers, profile backgrounds, and public profiles.
- Learning support: AI hints, AI chat, code review, wrong-answer coach, daily quiz, and personalized recommendations.
- Commercial/account foundations: Free/Pro/Team tiers, Stripe hooks, email verification, teams, referrals, and admin tooling.

The clearest positioning is: **"a Korean-friendly daily coding growth platform where learners build a visible routine, get AI coaching, and compete in lightweight battles."**

## Competitor reference points

- HackerRank is moving toward hiring and AI-assisted assessment: AI assistant, AI tutor, AI mock interviews, AI interviewer, proctoring, scorecards, integrity signals, and real-repository interviews.
- Codeforces is strongest at global contest culture: problemsets, tags, difficulty/rating, contests, gyms, groups, standings, and calendars.
- solved.ac/BOJ is strongest in Korea for difficulty/tier trust, class-style curation, profile status, contribution, and community problem metadata.

DailyCoding should not try to beat those sites at their deepest moat. It should make the daily learning loop and friendly competition easier, more guided, and more personal.

## Highest-impact additions

1. Adaptive study path
   - Convert solved history, failed submissions, tags, tier, and streak into a weekly curriculum.
   - Show "today's 3 tasks": warm-up, weakness repair, stretch problem.
   - Add reason labels such as "DP weakness", "recent timeout", or "tier-up target".

2. Wrong-answer recovery center
   - Group failed submissions by cause: compile error, wrong answer, timeout, edge case, complexity.
   - Let users retry from a focused queue instead of browsing the full problem list again.
   - Add AI coach output only after the user has made at least one attempt.

3. Battle differentiation
   - Add modes: same-problem speed duel, territory mode, tag-limited duel, rematch set, async ghost battle.
   - Add battle recap: key turning point, fastest accepted solution, unsolved opportunity, and suggested rematch topic.
   - Highlight this more on landing/dashboard because it is a distinctive DailyCoding feature.

4. Interview and exam readiness
   - Add company-style timed sets without claiming official company affiliation.
   - Add post-exam report: accuracy, average solve time, weak tags, careless mistakes, and next set.
   - Add "AI mock interviewer" later as a premium feature: timed prompt, follow-up questions, structured rubric.

5. Team/classroom features
   - Team dashboard with member streaks, weekly solved count, internal leaderboard, and assigned problem sets.
   - Teacher/admin ability to create private sheets, set deadlines, and review code submissions.
   - This differentiates from solo-only practice sites and supports monetization.

6. Public proof of growth
   - Shareable profile card with tier, streak, solved tags, best battle result, and recent milestones.
   - Submission share already exists; connect it to profile achievements and social sharing.

7. AI quota UX polish
   - When quota is exhausted, show a plain exhausted-state message instead of a motivational fallback.
   - Separate "daily user quota exhausted" from "AI provider temporarily unavailable" in API responses.
   - Keep upgrade prompts nearby but do not mix them into the error sentence itself.

## What to emphasize now

- "Daily growth" over "problem archive": the product should feel like a coach that decides the next useful problem.
- "Battle practice" over generic ranking: most platforms have ranks, fewer make short competitive practice feel easy.
- "AI after effort" over generic AI chat: require attempts/submissions before deeper hints, then make feedback concrete.
- "Korean coding-test prep" over global contest clone: use Korean UX, practical exam sets, and clear local learning paths.

## Practical next feature sequence

1. Add quota exhausted copy cleanup and provider-exhausted handling.
2. Add a weakness-based retry queue from failed submissions.
3. Add battle recap and rematch recommendations.
4. Add weekly adaptive study plan.
5. Add shareable growth card.
6. Add team/classroom dashboard.

## Sources checked

- HackerRank AI features: https://support.hackerrank.com/hc/en-us/articles/35288933801491-HackerRank-s-AI-Features
- HackerRank AI-assisted interviews: https://support.hackerrank.com/articles/5821380141-ai-assisted-interviews
- HackerRank mock interviews: https://www.hackerrank.com/mock-interviews
- Codeforces problemset: https://codeforces.com/problemset
- solved.ac overview: https://solved.ac/en
- solved.ac tiers and AC rating: https://help.solved.ac/en/stats/ac-rating
