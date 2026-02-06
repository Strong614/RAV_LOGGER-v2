import { readJSON, writeJSON } from "./db.js";
import { logEvent } from "./logEvent.js";

const PATH = "./data/members.json";

export function addMember(name, username, by) {
  const members = readJSON(PATH, {});

  members[username] = {
    name,
    username,
    joinedAt: new Date().toISOString(),
    rank: "Recruit",
    status: "active",
    warnings: 0
  };

  writeJSON(PATH, members);
  logEvent("JOIN", { username, by });
}
