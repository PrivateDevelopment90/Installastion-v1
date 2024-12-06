const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const { OWNER_IDS, PREFIX_COMMANDS, EMBED_COLORS } = require("@root/config");
const { parsePermissions } = require("@helpers/Utils");
const { timeformat } = require("@helpers/Utils");

const cooldownCache = new Map();

module.exports = {
  handlePrefixCommand: async function (message, cmd, client) {
    const settings = client.db.get(`guild_${message.guild.id}`) || { prefix: PREFIX_COMMANDS.DEFAULT_PREFIX };
    const prefix = settings.prefix;
    const args = message.content.replace(prefix, "").split(/\s+/);
    const invoke = args.shift().toLowerCase();

    const data = {};
    data.settings = settings;
    data.prefix = prefix;
    data.invoke = invoke;

    if (!message.channel.permissionsFor(message.guild.members.me).has("SendMessages")) return;

    if (cmd.validations) {
      for (const validation of cmd.validations) {
        if (!validation.callback(message)) {
          return message.safeReply(validation.message);
        }
      }
    }

    if (cmd.category === "OWNER" && !OWNER_IDS.includes(message.author.id)) {
      return message.safeReply("This command is only accessible to bot owners");
    }

    if (cmd.userPermissions && cmd.userPermissions?.length > 0) {
      if (!message.channel.permissionsFor(message.member).has(cmd.userPermissions)) {
        return message.safeReply(`You need ${parsePermissions(cmd.userPermissions)} for this command`);
      }
    }

    if (cmd.botPermissions && cmd.botPermissions.length > 0) {
      if (!message.channel.permissionsFor(message.guild.members.me).has(cmd.botPermissions)) {
        return message.safeReply(`I need ${parsePermissions(cmd.botPermissions)} for this command`);
      }
    }

    if (cmd.command.minArgsCount > args.length) {
      const usageEmbed = this.getCommandUsage(cmd, prefix, invoke);
      return message.safeReply({ embeds: [usageEmbed] });
    }

    if (cmd.cooldown > 0) {
      const remaining = getRemainingCooldown(message.author.id, cmd);
      if (remaining > 0) {
        return message.safeReply(`You are on cooldown. You can again use the command in \`${timeformat(remaining)}\``);
      }
    }

    try {
      await cmd.messageRun(message, args, data);
    } catch (ex) {
      message.client.logger.error("messageRun", ex);
      message.safeReply("An error occurred while running this command");
    } finally {
      if (cmd.cooldown > 0) applyCooldown(message.author.id, cmd);
    }
  },

  handleSlashCommand: async function (interaction, client) {
    const cmd = interaction.client.slashCommands.get(interaction.commandName);
    if (!cmd) return interaction.reply({ content: "An error has occurred", ephemeral: true }).catch(() => {});

    const settings = client.db.get(`guild_${interaction.guild.id}`) || { prefix: PREFIX_COMMANDS.DEFAULT_PREFIX };

    if (cmd.validations) {
      for (const validation of cmd.validations) {
        if (!validation.callback(interaction)) {
          return interaction.reply({
            content: validation.message,
            ephemeral: true,
          });
        }
      }
    }

    if (cmd.category === "OWNER" && !OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: `This command is only accessible to bot owners`,
        ephemeral: true,
      });
    }

    if (interaction.member && cmd.userPermissions?.length > 0) {
      if (!interaction.member.permissions.has(cmd.userPermissions)) {
        return interaction.reply({
          content: `You need ${parsePermissions(cmd.userPermissions)} for this command`,
          ephemeral: true,
        });
      }
    }

    if (cmd.botPermissions && cmd.botPermissions.length > 0) {
      if (!interaction.guild.members.me.permissions.has(cmd.botPermissions)) {
        return interaction.reply({
          content: `I need ${parsePermissions(cmd.botPermissions)} for this command`,
          ephemeral: true,
        });
      }
    }

    if (cmd.cooldown > 0) {
      const remaining = getRemainingCooldown(interaction.user.id, cmd);
      if (remaining > 0) {
        return interaction.reply({
          content: `You are on cooldown. You can again use the command in \`${timeformat(remaining)}\``,
          ephemeral: true,
        });
      }
    }

    try {
      await interaction.deferReply({ ephemeral: cmd.slashCommand.ephemeral });
      await cmd.interactionRun(interaction, { settings });
    } catch (ex) {
      await interaction.followUp("Oops! An error occurred while running the command");
      interaction.client.logger.error("interactionRun", ex);
    } finally {
      if (cmd.cooldown > 0) applyCooldown(interaction.user.id, cmd);
    }
  },

  getCommandUsage(cmd, prefix = PREFIX_COMMANDS.DEFAULT_PREFIX, invoke, title = "Usage") {
    let desc = "";
    if (cmd.command.subcommands && cmd.command.subcommands.length > 0) {
      cmd.command.subcommands.forEach((sub) => {
        desc += `\`${prefix}${invoke || cmd.name} ${sub.trigger}\`\n❯ ${sub.description}\n\n`;
      });
      if (cmd.cooldown) {
        desc += `**Cooldown:** ${timeformat(cmd.cooldown)}`;
      }
    } else {
      desc += `\`\`\`css\n${prefix}${invoke || cmd.name} ${cmd.command.usage}\`\`\``;
      if (cmd.description !== "") desc += `\n**Help:** ${cmd.description}`;
      if (cmd.cooldown) desc += `\n**Cooldown:** ${timeformat(cmd.cooldown)}`;
    }

    const embed = new EmbedBuilder().setColor(EMBED_COLORS.BOT_EMBED).setDescription(desc);
    if (title) embed.setAuthor({ name: title });
    return embed;
  },

  getSlashUsage(cmd) {
    let desc = "";
    if (cmd.slashCommand.options?.find((o) => o.type === ApplicationCommandOptionType.Subcommand)) {
      const subCmds = cmd.slashCommand.options.filter((opt) => opt.type === ApplicationCommandOptionType.Subcommand);
      subCmds.forEach((sub) => {
        desc += `\`/${cmd.name} ${sub.name}\`\n❯ ${sub.description}\n\n`;
      });
    } else {
      desc += `\`/${cmd.name}\`\n\n**Help:** ${cmd.description}`;
    }

    if (cmd.cooldown) {
      desc += `\n**Cooldown:** ${timeformat(cmd.cooldown)}`;
    }

    return new EmbedBuilder().setColor(EMBED_COLORS.BOT_EMBED).setDescription(desc);
  },
};

function applyCooldown(memberId, cmd) {
  const key = cmd.name + "|" + memberId;
  cooldownCache.set(key, Date.now());
}

function getRemainingCooldown(memberId, cmd) {
  const key = cmd.name + "|" + memberId;
  if (cooldownCache.has(key)) {
    const remaining = (Date.now() - cooldownCache.get(key)) * 0.001;
    if (remaining > cmd.cooldown) {
      cooldownCache.delete(key);
      return 0;
    }
    return cmd.cooldown - remaining;
  }
  return 0;
}
