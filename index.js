const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const express = require('express'); // Added for free hosting support

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent // <-- This is the missing link!
    ] 
});
const app = express(); // Create the web server instance

// --- FAKE WEBPAGE FOR RENDER ---
// This creates a simple webpage at your bot's URL. 
app.all('/', (req, res) => {
    res.sendStatus(200); // Instantly sends a clean, tiny "OK" back for BOTH GET and HEAD requests
});

// Start listening on Render's assigned port (default to 3000 if local)
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server successfully bound to port ${PORT}`);
});

// --- CONFIGURATION ---
const TORN_API_KEY = process.env.TORN_API_KEY; 
const CHANNEL_ID = '1508557031307743252'; 
const CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes

const shopConfig = {
    sallys_sweet_shop: { name: "Sally's Sweet Shop", roleId: "1508555055941292133", maxMeasures: 1 },
    Bits_n_bobs: { name: "Bits 'n' Bobs", roleId: "1508555178918543421", maxMeasures: 1 },
    tc_clothing: { name: "TC Clothing", roleId: "1508556207106031636", maxMeasures: 2 },
    super_store: { name: "Super Store", roleId: "1508555242176909511", maxMeasures: 2 },
    pharmacy: { name: "Pharmacy", roleId: "1508556561163747378", maxMeasures: 2 },
    cyber_force: { name: "Cyber Force", roleId: "1508555676929097951", maxMeasures: 2 },
    jewelry_store: { name: "Jewelry Store", roleId: "1508555762199171229", maxMeasures: 2 },
    big_als: { name: "Big Al's Gun Shop", roleId: "1508555852221776053", maxMeasures: 2 }
};

let previousDisabledShops = new Set();

client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}. Automation sequence active.`);
    checkTornShoplifting();
    setInterval(checkTornShoplifting, CHECK_INTERVAL);
});

// --- INTERACTIVE TEXT COMMAND ---
// --- INTERACTIVE STATUS DASHBOARD ---
// Listens for !check and replies with a live breakdown of all store security states
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '!check') {
        try {
            // Send a temporary loading indicator
            const statusLoadingMessage = await message.reply("🛰️ Querying Torn City data centers... Fetching live shop security status.");

            // Request fresh data from Torn
            const url = `https://api.torn.com/torn/?selections=shoplifting&key=${TORN_API_KEY}&comment=LupinBot`;
            const response = await axios.get(url);

            if (!response.data || !response.data.shoplifting) {
                await statusLoadingMessage.edit("❌ System online, but the Torn API returned an empty response. Check your API key.");
                return;
            }

            const shopsData = response.data.shoplifting;
            let statusDescription = "";

// Loop through each shop to compile our report card
            for (const [shopKey, config] of Object.entries(shopConfig)) {
                const shopApiData = shopsData[shopKey]; // shopApiData is an array now!
                
                // Count how many items in the array have "disabled: true"
                let currentDisabledCount = 0;
                if (Array.isArray(shopApiData)) {
                    currentDisabledCount = shopApiData.filter(measure => measure.disabled === true).length;
                }
                
                // Choose a visual indicator depending on security state
                let statusIcon = "🔒"; 
                if (currentDisabledCount === config.maxMeasures) {
                    statusIcon = "🚨"; 
                } else if (currentDisabledCount > 0) {
                    statusIcon = "⚠️"; 
                }

                statusDescription += `${statusIcon} **${config.name}**: ${currentDisabledCount}/${config.maxMeasures} measures disabled\n`;
            }

            // Wrap the data in a crisp Discord Embed
            const statusEmbed = new EmbedBuilder()
                .setTitle("🏪 Torn Shoplifting Security Dashboard")
                .setDescription(statusDescription)
                .setColor(0x3498DB) // Neutral blue color for regular checks
                .setFooter({ text: "Lupin Surveillance System" })
                .setTimestamp();

            // Edit our initial message to display the completed dashboard
            await statusLoadingMessage.edit({ content: "✅ Live status report compiled successfully:", embeds: [statusEmbed] });

        } catch (error) {
            console.error("Error during manual !check status compilation:", error.message);
            await message.reply("❌ Error compiling the live status. Check Render server logs for raw output details.");
        }
    }
});

async function checkTornShoplifting() {
    try {
        if (!TORN_API_KEY) {
            console.error("CRITICAL ERROR: TORN_API_KEY variable is missing from the environment configuration.");
            return;
        }

        const url = `https://api.torn.com/torn/?selections=shoplifting&key=${TORN_API_KEY}&comment=LupinBot`;
        const response = await axios.get(url);
        
        if (!response.data || !response.data.shoplifting) {
            console.error("Failed to fetch accurate data from Torn API. Check Key.");
            return;
        }

        const shopsData = response.data.shoplifting;
        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel) return;

for (const [shopKey, config] of Object.entries(shopConfig)) {
            const shopApiData = shopsData[shopKey];
            
            if (!Array.isArray(shopApiData)) continue;

            // Count how many items are disabled
            const currentDisabledCount = shopApiData.filter(measure => measure.disabled === true).length;
            const completelyClear = currentDisabledCount === config.maxMeasures;

            if (completelyClear) {
                if (!previousDisabledShops.has(shopKey)) {
                    const securityText = config.maxMeasures === 1 ? "Its security tracking measure is" : "All security tracking measures are";

                    const alertEmbed = new EmbedBuilder()
                        .setTitle(`🚨 SECURITY DOWN: ${config.name} 🚨`)
                        .setDescription(`${securityText} currently **DISABLED**! Free loot window is open.`)
                        .setColor(0x00FF00)
                        .setTimestamp();

                    await channel.send({ content: `<@&${config.roleId}>`, embeds: [alertEmbed] });
                    previousDisabledShops.add(shopKey);
                    console.log(`Alert sent for ${config.name}`);
                }
            } else {
                if (previousDisabledShops.has(shopKey)) {
                    previousDisabledShops.delete(shopKey);
                    console.log(`Security restored at ${config.name}. Resetting watch state.`);
                }
            }
        }

    } catch (error) {
        console.error("Error running the automated Torn API check:", error.message);
    }
}

client.login(process.env.DISCORD_BOT_TOKEN);
