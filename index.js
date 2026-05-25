const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// --- CONFIGURATION ---
const TORN_API_KEY = process.env.TORN_API_KEY; // Requires a valid public key
const CHANNEL_ID = '1508557031307743252'; // The channel where pings will go
const CHECK_INTERVAL = 3 * 60 * 1000; // Time in milliseconds (3 minutes)
client.login('MTUwODU1MzY1MjgzMzM1Nzg3Nw.GvvqN9.2XutAKMjBpbrZZIhzEwj7l6hUd3oEl4jC293n8');

// Map Torn's API keys to your Discord Roles, Text Names, and exact security counts
const shopConfig = {
    sweet_shop: { name: "Sally's Sweet Shop", roleId: "1508555055941292133", maxMeasures: 1 },
    bits_bobs: { name: "Bits 'n' Bobs", roleId: "1508555178918543421", maxMeasures: 1 },
    clothes: { name: "TC Clothing", roleId: "1508556207106031636", maxMeasures: 2 },
    supermarket: { name: "Super Store", roleId: "1508555242176909511", maxMeasures: 2 },
    pharmacy: { name: "Pharmacy", roleId: "1508556561163747378", maxMeasures: 2 },
    cyberforce: { name: "Cyber Force", roleId: "1508555676929097951", maxMeasures: 2 },
    jewelry: { name: "Jewelry Store", roleId: "1508555762199171229", maxMeasures: 2 },
    gun_shop: { name: "Big Al's Gun Shop", roleId: "1508555852221776053", maxMeasures: 2 }
};

// Memory cache to remember what the state was on the last check
// This prevents the bot from spamming every 3 minutes while a shop is open.
let previousDisabledShops = new Set();

client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}. Automation sequence active.`);
    
    // Run the check immediately on startup, then loop it
    checkTornShoplifting();
    setInterval(checkTornShoplifting, CHECK_INTERVAL);
});

async function checkTornShoplifting() {
    try {
        const url = `https://api.torn.com/torn/?selections=shoplifting&key=${TORN_API_KEY}`;
        const response = await axios.get(url);
        
        if (!response.data || !response.data.shoplifting) {
            console.error("Failed to fetch accurate data from Torn API. Check Key.");
            return;
        }

        const shopsData = response.data.shoplifting;
        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel) return;

        // Loop through all the shops configured
        for (const [shopKey, config] of Object.entries(shopConfig)) {
            const shopApiData = shopsData[shopKey];
            
            if (!shopApiData || !shopApiData.disabled_security) continue;

            // Dynamically check if the number of disabled security measures 
            // matches the total security measures that shop possesses.
            const completelyClear = shopApiData.disabled_security.length === config.maxMeasures;

            if (completelyClear) {
                // Check if we already alerted for this specific opening
                if (!previousDisabledShops.has(shopKey)) {
                    
                    // Create a flexible description based on whether it has 1 or 2 measures down
                    const securityText = config.maxMeasures === 1 ? "Its security tracking measure is" : "All security tracking measures are";

                    // Create the alert embed
                    const alertEmbed = new EmbedBuilder()
                        .setTitle(`🚨 SECURITY DOWN: ${config.name} 🚨`)
                        .setDescription(`${securityText} currently **DISABLED**! Free loot window is open.`)
                        .setColor(0x00FF00)
                        .setTimestamp();

                    // Send message and ping the exact role
                    await channel.send({ content: `<@&${config.roleId}>`, embeds: [alertEmbed] });
                    
                    // Add to tracking set so we don't spam
                    previousDisabledShops.add(shopKey);
                    console.log(`Alert sent for ${config.name}`);
                }
            } else {
                // If security is back up, remove it from the tracking list
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