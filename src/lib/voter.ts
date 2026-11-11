const VOTER_KEY = 'sparkboard_voter_id';

export function getVoterId(): string {
  let id = localStorage.getItem(VOTER_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(VOTER_KEY, id);
  }
  return id;
}
