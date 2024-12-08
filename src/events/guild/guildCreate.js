module.exports = async (client, guild) => {
    if (!guild.name) return;

    client.logger.log(`Left : ${guild.name} | ${guild.memberCount}`, 'guild');

    // Delete guild-related data from your database
    client.db.delete(`prefix_${guild.id}`);
    client.db.delete(`wlUser_${guild.id}`);
    client.db.delete(`exown_${guild.id}`);
    client.db.delete(`wlRole_${guild.id}`);

    try {
        // Fetch the server owner
        let own = await guild.fetchOwner();

        // Find the channel where you want to send the embed (replace 'channelID' with actual channel ID)
        const leaveChannel = await client.channels.fetch('1299579753023410269');
        if (!leaveChannel) {
            client.logger.log('Leave channel not found!', 'error');
            return;
        }

        // embed for guild Delete
       const emb = new client.emb().desc("Removed From A Server!").setThumbnail(client.user.displayAvatarURL({dynmaic : true})).setTimestamp().setAuthor({name : `CodeX` , iconURL : guild.iconURL({dynmaic : true})}).addFields([
                {name : `Server Name` , value : `**\`${guild.name}\`**`},
                {name : `Server Owner` , value : `**\`${guild.members.cache.get(own.id) ? guild.members.cache.get(own.id).user.tag : "Unknown User"}\`**`},
                {name : `Server Members` , value : `**\`${guild.memberCount}\`**`},
              {
                name: `Cluster Stats **[${guild.shardId}]**`,
                value: `**\`${client.guilds.cache.size} Guilds\`** | **\`${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount,0,)} Users\`**`
              }
                ])
        
        // Send the embed to the 'leave' channel
        await leaveChannel.send({ embeds: [embed] });

    } catch (error) {
        // Catch any errors related to fetching owner, channel, or sending the embed
        client.logger.log(`Failed to send embed to leave channel: ${error.message}`, 'error');
    }
};
