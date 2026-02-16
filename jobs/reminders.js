import { getAllMembers, saveMember } from "../db/postgres.js";

const HQ_ROLE_ID = "1361016918001058005";
const SHQ_ROLE_ID = "1420896047839838249";
const REMINDERS_CHANNEL_ID = "1469057497166905375";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function startReminders(client) {
  setInterval(async () => {
    try {
      // 👇 Get members from database
      const members = await getAllMembers({ status: "active" });
      const now = Date.now();

      const channel = await client.channels.fetch(REMINDERS_CHANNEL_ID);
      if (!channel?.isTextBased()) return;

      const perms = channel.permissionsFor(client.user);
      if (!perms?.has("SendMessages")) return;

      const completed = [];

      for (const member of members) {
        if (member.rank?.toLowerCase() !== "neophyte") continue;
        if (member.notifiedOneMonth) continue;

        const joinedAt = new Date(member.joinedAt).getTime();
        if (now - joinedAt < ONE_MONTH_MS) continue;

        completed.push(`${member.name} (${member.username})`);
        
        // 👇 Update member in database
        await saveMember({
          ...member,
          notifiedOneMonth: true
        });
      }

      // Nothing new → no ping
      if (!completed.length) return;

      await channel.send(
        `<@&${HQ_ROLE_ID}> <@&${SHQ_ROLE_ID}>\n` +
        `The following members have completed **1 month probationary as Neophyte**:\n` +
        "```" +
        completed.join("\n") +
        "```"
      );

    } catch (err) {
      console.error("Reminder job error:", err);
    }
  }, CHECK_INTERVAL_MS);
}