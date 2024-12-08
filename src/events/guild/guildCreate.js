const { ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

module.exports = async (client, guild) => {
    if (!guild || !guild.id) return;  

    client.db.set(`prefix_${guild.id}`, client.prefix);

    client.logger.log(`Added to: ${guild.name} | ${guild.memberCount}`, 'guild');

    let mCh = guild.channels.cache.find(channel => channel.type === 0);  
    if (!mCh || !mCh.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages | PermissionsBitField.Flags.EmbedLinks)) {
        client.logger.error('No valid text channel found with send message or embed links permission.');
        return;
    }

    const ch = await client.channels.fetch("1299579753023410269").catch(() => null);  
    if (!ch || !ch.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.ViewChannel | PermissionsBitField.Flags.SendMessages | PermissionsBitField.Flags.EmbedLinks)) {
        client.logger.error('No valid log channel found with necessary permissions.');
        return;
    }

    const invite = await mCh.createInvite({ maxAge: 0, reason: `Security purposes` }).catch(() => null);
    if (!invite) {
        client.logger.error('Failed to create an invite link.');
        return;
    }

    let own = await guild.fetchOwner().catch(() => null);
    if (!own) {
        client.logger.error('Failed to fetch server owner.');
        return;
    }

    const emb = new client.emb()
        .desc("Added To A New Server!")
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setAuthor({ name: `installastion`, iconURL: guild.iconURL({ dynamic: true }) })
        .addFields([
            { name: `Server Name`, value: `**\`${guild.name}\`**` },
            { name: `Server Owner`, value: `**\`${own ? own.user.tag : "Unknown User"}\`**` },
            { name: `Server Members`, value: `**\`${guild.memberCount}\`**` },
            {
                name: `Cluster Stats **[${guild.shardId}]**`,
                value: `**\`${client.guilds.cache.size} Guilds\`** | **\`${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)} Users\`**`
            }
        ]);

    ch.send({
        embeds: [emb],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Server Invite")
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.gg/${invite.code}`)
            )
        ]
    });

    const welcomeMessages = [
        "Hey there, thanks for inviting me to your server!",
        "Sup, CodeX in the house!",
        "Poggers! Thanks for adding me!",
        "Let's make this server awesome together!",
        "Thanks for the invite! Ready to roll!",
        "Woohoo! I'm here to help you manage this server!",
        "Hey! Can't wait to help make your server better!"
    ];

    const randomWelcomeMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

    const welcomeEmbed = new EmbedBuilder()
        .setColor("Blue")
        .setTitle("Thanks for Inviting CodeX!")
        .setDescription(`
        Hello **${guild.name}**! ${randomWelcomeMessage}
        
        I'm **Installastions**, here to help you with advanced server management, fun commands, and custom features! 
        Use \`${client.prefix}help\` to view commands, or visit the **Dashboard** to customize settings.

        **Resources**: Click the buttons below to access the dashboard or join the support server for help.
        `)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Let’s make your server awesome!" })
        .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("Dashboard")
            .setStyle(ButtonStyle.Link)
            .setURL("https://installastion.koyeb.app"),

        new ButtonBuilder()
            .setLabel("Support Server")
            .setStyle(ButtonStyle.Link)
            .setURL(client.invite)
    );

    mCh.send({
        embeds: [welcomeEmbed],
        components: [actionRow]
    }).catch(err => {
        client.logger.error(`Failed to send welcome message: ${err.message}`);
    });
};
