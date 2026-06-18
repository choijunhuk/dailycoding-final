export function normalizeSearchResults(payload) {
  return {
    problems: Array.isArray(payload?.problems) ? payload.problems : [],
    posts: Array.isArray(payload?.posts) ? payload.posts : [],
  };
}
