import { Client } from "discord.js";
import path from "path";
import { readJSON, writeJSON } from "../utils/db.js";

const MEMBERS_PATH = path.resolve("./data/members.json");

// IDs or tags for HQ & sHQ (replace with real Discord IDs)
const HQ_ROLE_ID = "1361016918001058005";
const SHQ_ROLE_ID = "1420896047839838249";

// ID of the channel where reminders should be sent
const REMINDERS_CHANNEL_ID = "1469057497166905375";

// Time interval to check (e.g., every 1 hour)
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function startReminders(client) {
  setInterval(async () => {
    try {
      const members = readJSON(MEMBERS_PATH, {});
      const now = new Date();

      // Fetch the channel once per interval
      const channel = await client.channels.fetch(REMINDERS_CHANNEL_ID);
      if (!channel?.isTextBased() || !channel.permissionsFor(client.user).has("SendMessages")) return;

      Object.values(members).forEach(member => {
        if (member.rank.toLowerCase() !== "neophyte") return;

        const joined = new Date(member.joinedAt);
        const oneMonthPassed = (now - joined) >= 30 * 24 * 60 * 60 * 1000; // ~30 days

        if (oneMonthPassed && !member.notifiedOneMonth) {
          channel.send(
            `<@&${HQ_ROLE_ID}> & <@&${SHQ_ROLE_ID}> ${member.name} (${member.username}) has completed 1 month probationary as Neophyte.`
          );

          member.notifiedOneMonth = true;
        }
      });
    } catch (err) {
      console.error("Reminder job error:", err);
    }
  }, CHECK_INTERVAL_MS);
}
