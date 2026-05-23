import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const rewardModel = read('dailycoding-server/src/models/Reward.js');
const rewardRoutes = read('dailycoding-server/src/routes/rewards.js');
const badgeRoutes = read('dailycoding-server/src/routes/badges.js');
const profileRoute = read('dailycoding-server/src/routes/auth/profile.js');
const badgesPage = read('dailycoding/src/pages/BadgesPage.jsx');
const profilePage = read('dailycoding/src/pages/ProfilePage.jsx');
const publicProfilePage = read('dailycoding/src/pages/PublicProfilePage.jsx');

const checks = [
  ['existing reward_items reused', /reward_items/.test(rewardModel) && /reward_items/.test(badgeRoutes)],
  ['existing user_rewards reused', /user_rewards/.test(rewardModel) && /user_rewards/.test(badgeRoutes)],
  ['existing equipped_title reused', /equipped_title/.test(rewardRoutes) && /equippedTitle/.test(badgesPage)],
  ['badge showcase endpoint present', /router\.post\('\/showcase'/.test(rewardRoutes)],
  ['badge showcase ownership validation present', /hasReward\(userId, rewardCode\)/.test(rewardModel)],
  ['badge showcase limit present', /BADGE_SHOWCASE_LIMIT/.test(rewardModel)],
  ['profile returns showcased badges', /showcasedBadges/.test(profileRoute)],
  ['profile page renders showcased badges', /profile\.showcasedBadges|showcasedBadges/.test(profilePage + publicProfilePage)],
  ['reward progress included', /progress: resolveRewardProgress/.test(badgeRoutes)],
  ['owner stats included', /ownerStats/.test(badgeRoutes) && /ownerRatio/.test(badgeRoutes)],
  ['badges and titles tab separated', /key: 'badges'/.test(badgesPage) && /key: 'titles'/.test(badgesPage)],
  ['new rewards UI uses i18n keys', /t\('rewards\.inventory'\)/.test(badgesPage) && !/보상 보관함|Reward Collection/.test(badgesPage)],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  console.error('Rewards verification failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`rewards verified: ${checks.length} checks passed.`);
