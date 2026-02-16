import { SlashCommandBuilder } from "discord.js";
import { saveMember, deleteMember, addLog, updateMemberRank, getMember } from "../db/postgres.js";

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
        .addStringOption(opt => opt.setName("to").setDescription("To role").setRequired(true))
        .addStringOption(opt => opt.setName("from").setDescription("From role").setRequired(false))
        .addStringOption(opt => opt.setName("timestamp").setDescription("ISO timestamp").setRequired(false))
    )

    // DEMOTE
    .addSubcommand(sub =>
      sub.setName("demote")
        .setDescription("Add a DEMOTE event")
        .addStringOption(opt => opt.setName("name").setDescription("Name of the user").setRequired(true))
        .addStringOption(opt => opt.setName("username").setDescription("Username").setRequired(true))
        .addStringOption(opt => opt.setName("by").setDescription("Performed by").setRequired(true))
        .addStringOption(opt => opt.setName("to").setDescription("To role").setRequired(true))
        .addStringOption(opt => opt.setName("from").setDescription("From role").setRequired(false))
        .addStringOption(opt => opt.setName("extra").setDescription("Reason").setRequired(false))
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
    const ALLOWED_ROLES = ["1361016918001058005", "1420896047839838249"];
    const ALLOWED_CHANNEL = "1469057497166905375";

    if (interaction.channelId !== ALLOWED_CHANNEL) {
      return interaction.reply({
        content: `❌ You can only use this command in <#${ALLOWED_CHANNEL}>.`,
        ephemeral: true
      });
    }

    const memberRoles = interaction.member.roles.cache.map(r => r.id);
    const hasAccess = memberRoles.some(r => ALLOWED_ROLES.includes(r));
    if (!hasAccess) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true
      });
    }

    // --- LOGIC ---
    try {
      const sub = interaction.options.getSubcommand();
      const options = {};
      interaction.options.data.forEach(opt => {
        opt.options?.forEach(o => options[o.name] = o.value);
      });

      const timestamp = options.timestamp || new Date().toISOString();
      const type = sub.toUpperCase();

      // Prepare log data
      const logData = {
        type,
        name: options.name,
        username: options.username,
        by: options.by,
        timestamp,
        rank: options.rank,
        extra: options.extra,
        from: options.from,
        to: options.to
      };

      // Handle specific event types
      switch (type) {
        case "JOIN":
          // Add member to members table
          await saveMember({
            username: options.username,
            name: options.name,
            rank: options.rank?.trim() || "Member",
            status: "active",
            warnings: 0,
            joinedAt: timestamp
          });
          logData.joinedAt = timestamp;
          logData.warnings = 0;
          break;

        case "KICK":
        case "LEFT":
          // Remove member from members table
          await deleteMember(options.username);
          break;

        case "PROMOTE":
        case "DEMOTE":
          // Get current member to find "from" rank if not provided
          const member = await getMember(options.username);
          if (!logData.from && member) {
            logData.from = member.rank;
          }
          
          // Update member's rank
          if (options.username && options.to) {
            await updateMemberRank(options.username, options.to);
          }
          break;

        case "WARN":
          // Could increment warnings count here if needed
          break;
      }

      // Add log entry
      const event = await addLog(logData);

      await interaction.reply({
        content: `✅ Event added:\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``
      });

    } catch (err) {
      console.error("Error in add command:", err);
      if (!interaction.replied) {
        await interaction.reply({
          content: `❌ Failed to add event: ${err.message}`,
          ephemeral: true
        });
      }
    }
  }
};