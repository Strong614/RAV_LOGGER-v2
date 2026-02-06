import "dotenv/config";
import { Client, GatewayIntentBits, Collection, REST, Routes, ChannelType } from "discord.js";
import fs from "fs";
import { startReminders } from "./jobs/reminders.js";

const { TOKEN, CLIENT_ID, GUILD_ID, LOG_CHANNEL_ID } = process.env;

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !LOG_CHANNEL_ID) {
  console.error("❌ Missing TOKEN, CLIENT_ID, GUILD_ID, or LOG_CHANNEL_ID in .env");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Collection to store commands
client.commands = new Collection();

// Load commands dynamically
async function loadCommands() {
  const commands = [];
  const commandFiles = fs.readdirSync("./commands").filter(f => f.endsWith(".js") && f !== "deploy-commands.js");

  for (const file of commandFiles) {
    const commandModule = await import(`./commands/${file}`);
    const command = commandModule.default ?? commandModule;

    if (!command.data || !command.execute) {
      console.warn(`⚠️ Command file ${file} is missing data or execute`);
      continue;
    }

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  return commands;
}

// Deploy commands to your guild
async function deployCommands(commands) {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    console.log(`🚀 Registering ${commands.length} commands to guild ${GUILD_ID}...`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Commands registered successfully!");
  } catch (err) {
    console.error(err);
  }
}

// Send startup message to log channel
async function sendLogChannelMessage(message) {
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID);
    if (channel?.type === ChannelType.GuildText) {
      channel.send({ content: message });
    }
  } catch (err) {
    console.error("Failed to send log message:", err);
  }
}

client.once("ready", async () => {
  console.log(`✅ Bot is ONLINE: ${client.user.tag}`);

  // Send startup message
  await sendLogChannelMessage(`✅ Bot is ONLINE: ${client.user.tag}`);

  // Start reminders
  startReminders(client);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (!interaction.replied) {
      await interaction.reply({ content: "There was an error executing that command!", ephemeral: true });
    }
  }
});

// Start bot
(async () => {
  const commands = await loadCommands();
  await deployCommands(commands);
  await client.login(TOKEN);
})();
