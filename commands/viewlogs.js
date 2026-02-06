import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { readJSON } from "../utils/db.js";
import path from "path";

const LOGS_PATH = path.resolve("./data/logs.json");
const PAGE_SIZE = 5;

const LOG_TYPES = [
  "ALL",
  "JOIN",
  "LEFT",
  "WARN",
  "KICK",
  "BLACKLIST",
  "PROMOTE",
  "DEMOTE",
];

export default {
  data: new SlashCommandBuilder()
    .setName("viewlogs")
    .setDescription("Displays logs with pagination and filtering"),

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
    const logs = readJSON(LOGS_PATH, []);
    if (!logs.length)
      return interaction.reply({ content: "No logs found.", ephemeral: true });

    let page = 0;
    let selectedType = "ALL";

    const getFilteredLogs = () =>
      selectedType === "ALL" ? logs : logs.filter((l) => l.type === selectedType);

    const formatLog = (log, type) => {
      const date = new Date(log.timestamp);
      const timeStr = `${date.toLocaleDateString("en-GB")} ${date
        .toLocaleTimeString("en-GB", { hour12: false })
        .slice(0, 5)}`;

      const fields = [`Type: ${log.type ?? "-"}`];

      switch (type) {
        case "ALL":
        case "JOIN":
          fields.push(`Username: ${log.username ?? "-"}`);
          fields.push(`Name: ${log.name ?? "-"}`);
          fields.push(`By: ${log.by ?? "-"}`);
          fields.push(`Time: ${timeStr}`);
          break;
        case "LEFT":
          fields.push(`Username: ${log.username ?? "-"}`);
          fields.push(`Name: ${log.name ?? "-"}`);
          fields.push(`Reason: ${log.extra ?? "-"}`);
          fields.push(`Time: ${timeStr}`);
          break;
        case "WARN":
        case "KICK":
          fields.push(`Username: ${log.username ?? "-"}`);
          fields.push(`Name: ${log.name ?? "-"}`);
          fields.push(`By: ${log.by ?? "-"}`);
          fields.push(`Reason: ${log.extra ?? "-"}`);
          fields.push(`Time: ${timeStr}`);
          break;
        case "BLACKLIST":
          fields.push(`Username: ${log.username ?? "-"}`);
          fields.push(`Name: ${log.name ?? "-"}`);
          fields.push(`By: ${log.by ?? "-"}`);
          fields.push(`Reason: ${log.extra ?? "-"}`);
          break;
        case "PROMOTE":
        case "DEMOTE":
          fields.push(`Username: ${log.username ?? "-"}`);
          fields.push(`Name: ${log.name ?? "-"}`);
          fields.push(`From: ${log.from ?? "-"}`);
          fields.push(`To: ${log.to ?? "-"}`);
          fields.push(`By: ${log.by ?? "-"}`);
          if (type === "DEMOTE") fields.push(`Reason: ${log.extra ?? "-"}`);
          fields.push(`Time: ${timeStr}`);
          break;
      }

      return `--------------------------------------------------
${fields.join("\n")}
--------------------------------------------------`;
    };


      const getTable = () => {
        const filtered = getFilteredLogs();
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (page >= totalPages) page = totalPages - 1;

        const slice = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
        if (!slice.length) return "No logs for this category.";

        const body = slice
          .map((log) =>
            formatLog(selectedType === "ALL" ? log : log, selectedType === "ALL" ? log.type : selectedType)
          )
          .join("\n");

        return `\`\`\`
${body}
Page ${page + 1}/${totalPages} | Filter: ${selectedType}
\`\`\``;
      };

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("log_filter")
        .setPlaceholder("Filter logs by type")
        .addOptions(LOG_TYPES.map((t) => ({ label: t, value: t })));

      const getComponents = () => {
        const totalPages = Math.max(1, Math.ceil(getFilteredLogs().length / PAGE_SIZE));

        return [
          new ActionRowBuilder().addComponents(selectMenu),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("prev")
              .setLabel("⬅️ Prev")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page === 0),
            new ButtonBuilder()
              .setCustomId("goto")
              .setLabel("Go to page")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId("next")
              .setLabel("Next ➡️")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(page >= totalPages - 1)
          ),
        ];
      };

      const message = await interaction.reply({
        content: getTable(),
        components: getComponents(),
        fetchReply: true,
      });

      // SINGLE collector for buttons and select menu
      const collector = message.createMessageComponentCollector({ time: 5 * 60 * 1000 });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id)
          return i.reply({ content: "These controls aren't for you.", ephemeral: true });

        const totalPages = Math.max(1, Math.ceil(getFilteredLogs().length / PAGE_SIZE));

        if (i.isStringSelectMenu()) {
          selectedType = i.values[0];
          page = 0;
          await i.update({ content: getTable(), components: getComponents() });
          return;
        }

        if (i.isButton()) {
          if (i.customId === "prev" && page > 0) page--;
          if (i.customId === "next" && page < totalPages - 1) page++;
          if (i.customId === "goto") {
            const modal = new ModalBuilder()
              .setCustomId("goto_modal")
              .setTitle("Go to page")
              .addComponents(
                new ActionRowBuilder().addComponents(
                  new TextInputBuilder()
                    .setCustomId("page_input")
                    .setLabel(`Enter page (1-${totalPages})`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                )
              );

            await i.showModal(modal);

            // Await modal submission directly for this user
            const submitted = await i.awaitModalSubmit({
              filter: (modalInt) => modalInt.user.id === interaction.user.id,
              time: 60_000,
            }).catch(() => null);

            if (submitted) {
              let newPage = parseInt(submitted.fields.getTextInputValue("page_input"));
              if (isNaN(newPage) || newPage < 1 || newPage > totalPages) newPage = 1;
              page = newPage - 1;
              await submitted.update({ content: getTable(), components: getComponents() });
            }
            return;
          }

          await i.update({ content: getTable(), components: getComponents() });
        }
      });
    } catch (err) {
      console.error("viewlogs error:", err);
      if (!interaction.replied) {
        await interaction.reply({ content: "Failed to fetch logs.", ephemeral: true });
      }
    }
  },
};
