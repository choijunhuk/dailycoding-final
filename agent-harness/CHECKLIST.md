# Agent Checklist

## Before Editing

- [ ] Ran `git status`
- [ ] Checked current modified files
- [ ] Inspected existing reward/badge/title/profile/i18n structure
- [ ] Checked whether badge showcase already exists
- [ ] Checked whether representative title already exists
- [ ] Checked existing translation file structure
- [ ] Checked existing API/routes/models for rewards/profile

## Rewards Inventory

- [ ] Badges and titles are visually separated
- [ ] Badge cards show owned/locked state
- [ ] Title cards show owned/locked state
- [ ] Badge cards show condition
- [ ] Title cards show condition
- [ ] Progress is displayed when available
- [ ] Owner ratio is displayed when available
- [ ] Unknown progress is handled naturally

## Representative Title

- [ ] User can set an owned title as representative title
- [ ] User cannot set an unowned title
- [ ] Only one representative title can be active
- [ ] Representative title appears on profile
- [ ] Representative title appears near username in important screens
- [ ] Existing title structure is reused if present

## Badge Showcase

- [ ] User can showcase owned badges
- [ ] User cannot showcase unowned badges
- [ ] User can remove showcased badges
- [ ] Showcase limit is respected
- [ ] Showcased badges appear on profile
- [ ] Existing showcase structure is reused if present

## i18n

- [ ] All new user-facing text uses i18n keys
- [ ] Korean and English keys match
- [ ] No raw translation key is shown in UI
- [ ] Korean text sounds natural
- [ ] English text is concise and natural
- [ ] Mixed Korean/English UI text has been fixed
- [ ] Common empty states use consistent wording
- [ ] “No record” and “기록 없음” inconsistency is fixed

## Security

- [ ] `.env` not staged
- [ ] API keys not staged
- [ ] DB passwords not staged
- [ ] JWT secrets not staged
- [ ] logs not staged
- [ ] uploads not staged
- [ ] node_modules not staged
- [ ] runtime artifacts not staged

## Verification

- [ ] Frontend build passed
- [ ] Frontend lint passed
- [ ] Backend lint passed or skipped only if script does not exist
- [ ] i18n verification passed
- [ ] rewards verification passed
- [ ] No dangerous staged files detected

## Deployment

- [ ] Changes committed
- [ ] Changes pushed to GitHub
- [ ] SSH deploy command executed
- [ ] Deployed site checked
- [ ] Deployment failure was not ignored
