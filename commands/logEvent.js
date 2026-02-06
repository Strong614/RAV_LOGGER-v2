import { SlashCommandBuilder } from "discord.js";
import path from "path";
import { readJSON, writeJSON } from "../utils/db.js";

const LOGS_PATH = path.resolve("./data/logs.json");
const MEMBERS_PATH = path.resolve("./data/members.json");

// Add member to members.json
function addMember(payload) {
  const members = readJSON(MEMBERS_PATH, {});
  if (!members[payload.username]) {
    const rank = payload.rank?.trim() || "Member";
    members[payload.username] = {
      name: payload.name,
      username: payload.username,
      rank,
      status: "active",
      warnings: 0,
      joinedAt: payload.timestamp || new Date().toISOString()
    };
    writeJSON(MEMBERS_PATH, members);
  }
}

// Remove member from members.json
function kickMember(username) {
  const members = readJSON(MEMBERS_PATH, {});
  if (members[username]) {
    delete members[username];
    writeJSON(MEMBERS_PATH, members);
  }
}

// Mark member as LEFT
function leftMember(username) {
  const members = readJSON(MEMBERS_PATH, {});
  if (members[username]) {
    delete members[username];
    writeJSON(MEMBERS_PATH, members);
  }
}

// Log an event and handle promotions/demotions
function logEvent(type, payload) {
  const logs = readJSON(LOGS_PATH, []);
  const members = readJSON(MEMBERS_PATH, {});

  const event = {
    type,
    name: payload.name,
    username: payload.username,
    by: payload.by,
    timestamp: payload.timestamp || new Date().toISOString()
  };

  if (payload.rank) event.rank = payload.rank;
  if (payload.joinedAt) event.joinedAt = payload.joinedAt;
  else if (type === "JOIN" || type === "LEFT") event.joinedAt = event.timestamp;

  if (payload.warnings !== undefined) event.warnings = payload.warnings;
  else if (type === "JOIN") event.warnings = 0;

  if (payload.extra) event.extra = payload.extra;

  // PROMOTE / DEMOTE handling
  if (type === "PROMOTE" || type === "DEMOTE") {
    event.from = payload.from?.trim() || members[payload.username]?.rank || "Member";
    event.to = payload.to;

    if (payload.username && payload.to) {
      if (!members[payload.username]) {
        members[payload.username] = {
          name: payload.name,
          username: payload.username,
          rank: payload.to,
          status: "active",
          warnings: 0,
          joinedAt: new Date().toISOString()
        };
      } else {
        members[payload.username].rank = payload.to;
      }
      writeJSON(MEMBERS_PATH, members);
    }
  }

  logs.push(event);
  writeJSON(LOGS_PATH, logs);
  return event;
}

export default {
  data: new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add a log event")

    // JOIN
    .addSubcommand(sub =>
      sub.setName("join")
        .setDescription("Add a JOIN event")
        .addStringOption(opt => opt.setName("name").setDescription("Name of the user").setRequired(true))
        .addStringOption(opt => opt.setName("username").setDescription("Username").setRequired(true))
        .addStringOption(opt => opt.setName("by").setDescription("Performed by").setRequired(true))
        .addStringOption(opt => opt.setName("rank").setDescription("Role/Rank").setRequired(false))
        .addStringOption(opt => opt.setName("timestamp").setDescription("ISO timestamp").setRequired(false))
    )

    // KICK
    .addSubcommand(sub =>
      sub.setName("kick")
        .setDescription("Add a KICK event")
        .addStringOption(opt => opt.setName("name").setDescription("Name of the user").setRequired(true))
        .addStringOption(opt => opt.setName("username").setDescription("Username").setRequired(true))
        .addStringOption(opt => opt.setName("by").setDescription("Performed by").setRequired(true))
        .addStringOption(opt => opt.setName("extra").setDescription("Reason").setRequired(false))
        .addStringOption(opt => opt.setName("timestamp").setDescription("ISO timestamp").setRequired(false))
    )

    // LEFT
    .addSubcommand(sub =>
      sub.setName("left")
        .setDescription("Mark a user as LEFT")
        .addStringOption(opt => opt.setName("name").setDescription("Name of the user").setRequired(true))
        .addStringOption(opt => opt.setName("username").setDescription("Username").setRequired(true))
        .addStringOption(opt => opt.setName("by").setDescription("Performed by").setRequired(true))
        .addStringOption(opt => opt.setName("timestamp").setDescription("ISO timestamp").setRequired(false))
    )

    // PROMOTE
    .addSubcommand(sub =>
      sub.setName("promote")
        .setDescription("Add a PROMOTE event")
        .addStringOption(opt => opt.setName("name").setDescription("Name of the user").setRequired(true))
        .addStringOption(opt => opt.setName("username").setDescription("Username").setRequired(true))
        .addStringOption(opt => opt.setName("by").setDescription("Performed by").setRequired(true))
        .addStringOption(opt => opt.setName("to").setDescription("To role").setRequired(true)) // required first
        .addStringOption(opt => opt.setName("from").setDescription("From role").setRequired(false)) // optional last
        .addStringOption(opt => opt.setName("timestamp").setDescription("ISO timestamp").setRequired(false))
    )

    // DEMOTE
  .addSubcommand(sub =>
    sub.setName("demote")
      .setDescription("Add a DEMOTE event")
      .addStringOption(opt => opt.setName("name").setDescription("Name of the user").setRequired(true))
      .addStringOption(opt => opt.setName("username").setDescription("Username").setRequired(true))
      .addStringOption(opt => opt.setName("by").setDescription("Performed by").setRequired(true))
      .addStringOption(opt => opt.setName("to").setDescription("To role").setRequired(true)) // required first
      .addStringOption(opt => opt.setName("from").setDescription("From role").setRequired(false)) // optional last
      .addStringOption(opt => opt.setName("extra").setDescription("Reason").setRequired(false)) // added reason
      .addStringOption(opt => opt.setName("timestamp").setDescription("ISO timestamp").setRequired(false))
  )


    // WARN
    .addSubcommand(sub =>
      sub.setName("warn")
        .setDescription("Add a WARN event")
        .addStringOption(opt => opt.setName("name").setDescription("Name of the user").setRequired(true))
        .addStringOption(opt => opt.setName("username").setDescription("Username").setRequired(true))
        .addStringOption(opt => opt.setName("by").setDescription("Performed by").setRequired(true))
        .addStringOption(opt => opt.setName("extra").setDescription("Reason").setRequired(true))
        .addStringOption(opt => opt.setName("timestamp").setDescription("ISO timestamp").setRequired(false))
    )

    // BLACKLIST
    .addSubcommand(sub =>
      sub.setName("blacklist")
        .setDescription("Add a BLACKLIST event")
        .addStringOption(opt => opt.setName("name").setDescription("Name of the user").setRequired(true))
        .addStringOption(opt => opt.setName("username").setDescription("Username").setRequired(true))
        .addStringOption(opt => opt.setName("by").setDescription("Performed by").setRequired(true))
        .addStringOption(opt => opt.setName("extra").setDescription("Reason").setRequired(true))
        .addStringOption(opt => opt.setName("timestamp").setDescription("ISO timestamp").setRequired(false))
    ),

async execute(interaction) {
  // --- RESTRICTIONS ---
  const ALLOWED_ROLES = ["1361016918001058005", "1420896047839838249"]; // HQ & sHQ
  const ALLOWED_CHANNEL = "1469057497166905375"; // replace with your channel ID

  // Check channel
  if (interaction.channelId !== ALLOWED_CHANNEL) {
    return interaction.reply({
      content: `❌ You can only use this command in <#${ALLOWED_CHANNEL}>.`,
      ephemeral: true
    });
  }

  // Check roles
  const memberRoles = interaction.member.roles.cache.map(r => r.id);
  const hasAccess = memberRoles.some(r => ALLOWED_ROLES.includes(r));
  if (!hasAccess) {
    return interaction.reply({
      content: "❌ You do not have permission to use this command.",
      ephemeral: true
    });
  }

  // --- ORIGINAL LOGIC ---
  try {
    const sub = interaction.options.getSubcommand();
    const options = {};
    interaction.options.data.forEach(opt => {
      opt.options?.forEach(o => options[o.name] = o.value);
    });

    if (sub.toUpperCase() === "JOIN") addMember(options);
    if (sub.toUpperCase() === "KICK") kickMember(options.username);
    if (sub.toUpperCase() === "LEFT") leftMember(options.username);

    const event = logEvent(sub.toUpperCase(), options);

    await interaction.reply({
      content: `✅ Event added:\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``
    });

  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      await interaction.reply({
        content: `❌ Failed to add event: ${err.message}`,
        ephemeral: true
      });
    }
  }
}

};
