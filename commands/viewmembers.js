import { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} from "discord.js";
import { getAllMembers } from "../db/postgres.js";

const PAGE_SIZE = 20;

const RANK_ORDER = [
  "Vanguard Supreme",
  "Phantom Leader",
  "Phantom Regent",
  "Night Council",
  "Black Sigil",
  "Honorary",
  "Spectre",
  "Revenant",
  "Vantage",
  "Dagger",
  "Neophyte"
];

export default {
  data: new SlashCommandBuilder()
    .setName("viewmembers")
    .setDescription("Displays members in a code block with pagination")
    .addStringOption(opt => 
      opt.setName("name")
        .setDescription("Filter by name (partial match)")
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName("rank")
        .setDescription("Filter by rank")
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName("sort")
        .setDescription("Sort by field")
        .addChoices(
          { name: "Name", value: "name" },
          { name: "Rank", value: "rank" },
          { name: "Joined", value: "joined" }
        )
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName("order")
        .setDescription("Sort order")
        .addChoices(
          { name: "Ascending", value: "asc" },
          { name: "Descending", value: "desc" }
        )
        .setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();

    const ALLOWED_ROLES = ["1361016918001058005", "1420896047839838249"];
    const ALLOWED_CHANNEL = "1469057497166905375";

    if (interaction.channelId !== ALLOWED_CHANNEL) {
      return interaction.editReply({
        content: `❌ You can only use this command in <#${ALLOWED_CHANNEL}>.`
      });
    }

    const memberRoles = interaction.member.roles.cache.map(r => r.id);
    const hasAccess = memberRoles.some(r => ALLOWED_ROLES.includes(r));
    if (!hasAccess) {
      return interaction.editReply({
        content: "❌ You do not have permission to use this command."
      });
    }

    try {
      const nameFilter = interaction.options.getString("name") || null;
      const rankFilter = interaction.options.getString("rank") || null;
      const sortField = interaction.options.getString("sort") || "joined";
      const sortOrder = interaction.options.getString("order") || "asc";

      let members = await getAllMembers({
        name: nameFilter,
        rank: rankFilter,
        sortField,
        sortOrder: sortOrder === "desc" ? "desc" : "asc",
        status: "active"
      });

      if (sortField === "rank") {
        members.sort((a, b) => {
          const aIndex = RANK_ORDER.indexOf(a.rank) !== -1 ? RANK_ORDER.indexOf(a.rank) : RANK_ORDER.length;
          const bIndex = RANK_ORDER.indexOf(b.rank) !== -1 ? RANK_ORDER.indexOf(b.rank) : RANK_ORDER.length;
          const comp = aIndex - bIndex;
          return sortOrder === "asc" ? comp : -comp;
        });
      }

      if (!members.length) {
        return interaction.editReply({ content: "No members found for the specified filters." });
      }

      let page = 0;
      const totalPages = Math.ceil(members.length / PAGE_SIZE);

      const NAME_WIDTH = 18;
      const USERNAME_WIDTH = 18;
      const RANK_WIDTH = 18;
      const JOINED_WIDTH = 19;

      const center = (str, width) => {
        str = str.toString();
        if (str.length > width) str = str.slice(0, width - 3) + "...";
        const padTotal = width - str.length;
        const padLeft = Math.floor(padTotal / 2);
        const padRight = padTotal - padLeft;
        return " ".repeat(padLeft) + str + " ".repeat(padRight);
      };

      const formatMember = (m) => {
        const date = new Date(m.joinedAt);
        const dateStr = date.toLocaleDateString("en-GB");
        const timeStr = date.toLocaleTimeString("en-GB", { hour12: false });
        const joinedStr = `${dateStr} ${timeStr}`;
        return `${center(m.name, NAME_WIDTH)} | ${center(m.username, USERNAME_WIDTH)} | ${center(m.rank, RANK_WIDTH)} | ${center(joinedStr, JOINED_WIDTH)}`;
      };

      const getTable = (page) => {
        const start = page * PAGE_SIZE;
        const slice = members.slice(start, start + PAGE_SIZE);

        const header = `${center('Name', NAME_WIDTH)} | ${center('Username', USERNAME_WIDTH)} | ${center('Rank', RANK_WIDTH)} | ${center('Joined', JOINED_WIDTH)}
${'-'.repeat(NAME_WIDTH + USERNAME_WIDTH + RANK_WIDTH + JOINED_WIDTH + 9)}`;

        const table = slice.map(formatMember).join('\n');
        const footer = `\nPage ${page + 1}/${totalPages} | Total Members: ${members.length}`;
        return `\`\`\`\n${header}\n${table}${footer}\n\`\`\``;
      };

      const getComponents = () => [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev")
            .setLabel("⬅️ Previous")
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
        )
      ];

      const message = await interaction.editReply({
        content: getTable(page),
        components: getComponents()
      });

      const collector = message.createMessageComponentCollector({ time: 5 * 60 * 1000 });

      collector.on("collect", async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: "These buttons aren't for you!", ephemeral: true });
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

            const submitted = await i.awaitModalSubmit({
              filter: (modalInt) => modalInt.user.id === interaction.user.id,
              time: 60_000
            }).catch(() => null);

            if (submitted) {
              let newPage = parseInt(submitted.fields.getTextInputValue("page_input"));
              if (isNaN(newPage) || newPage < 1 || newPage > totalPages) newPage = 1;
              page = newPage - 1;
              await submitted.update({ content: getTable(page), components: getComponents() });
            }
            return;
          }

          await i.update({ content: getTable(page), components: getComponents() });
        }
      });

    } catch (err) {
      console.error("Error fetching members:", err);
      await interaction.editReply({ content: "Failed to fetch members." });
    }
  },
};