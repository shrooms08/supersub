// Anonymous local identity: a uuid minted on first visit and kept in
// localStorage. No auth in this phase; this id is what "one entry per
// user per fixture" keys on.

const KEY = "supersub:userId";

export function getUserId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
