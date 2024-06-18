import restana from "restana";
import { PushAPI, CONSTANTS } from '@pushprotocol/restapi';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { sepoliaRpcUrl, whitelistContractAddress } from "./helpers/Consts.js";
import abi from "./contracts/whitelist/abi/abi.json" assert { type: "json" };
import { BotResponseMessage, setModelForChatId, getModelForChatId } from "./commands/Bot.js";
import { getAvailableModels, getCommandsList, getWhitelistedResponse, inaccurateRespose } from "./helpers/Responses.js";

dotenv.config();

const signer = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY);

export const pushBotInitializer = await PushAPI.initialize(signer, {
    env: CONSTANTS.ENV.STAGING,
});

const stream = await pushBotInitializer.initStream(
    [
        CONSTANTS.STREAM.CHAT, 
        CONSTANTS.STREAM.NOTIF, 
        CONSTANTS.STREAM.CONNECT, 
        CONSTANTS.STREAM.DISCONNECT,
    ],
    {
        filter: {
            chats: ["*"],
        },
        connection: {
            retries: 3,
        },
        raw: false,
    },
);

const providerUrl = sepoliaRpcUrl;
const provider = new ethers.providers.JsonRpcProvider(providerUrl);
const contractAddress = whitelistContractAddress;

const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
const whitelistContract = new ethers.Contract(contractAddress, abi, wallet);

async function checkWhitelisted(senderAddress) {
    return await whitelistContract.isWhitelisted(senderAddress);
}

async function sendResponseMessage(message, recipient) {
    try {
        await pushBotInitializer.chat.send(recipient, {
            type: 'Text',
            content: message,
        });
        console.log("Response Sent");
    } catch (error) {
        console.log("Response Sending failed", error);
    }
}

async function handleBotCommand(request, chatId) {
    const botResponse = await BotResponseMessage(request, chatId);
    sendResponseMessage(`${botResponse.response} ${inaccurateRespose}`, chatId);
}

async function handleSetModelCommand(modelId, chatId) {
    const response = await setModelForChatId(chatId, modelId);
    sendResponseMessage(response, chatId);
}

async function handleGetModelCommand(chatId) {
    const currentModel = await getModelForChatId(chatId);
    sendResponseMessage(`Current Model: ${currentModel}`, chatId);
}

async function handleCommand(message) {
    const content = message.message.content.trim();
    const command = (content.split(" ")[0].toLowerCase() || "hi").trim();
    const args = content.slice(command.length).trim();
    const chatId = message.chatId;

    switch (command) {
        case "/bot":
            await handleBotCommand(args, chatId);
            break;
        case "/setmodel":
            await handleSetModelCommand(args, chatId);
            break;
        case "/model":
            await handleGetModelCommand(chatId);
            break;
        case "/models":
            sendResponseMessage(getAvailableModels, chatId);
            break;
        case "/list":
            sendResponseMessage(getCommandsList, chatId);
            break;
    }
}

stream.on(CONSTANTS.STREAM.CHAT, async (message) => {
    try {
        if (message.origin === "other" && ["chat.message", "chat.request"].includes(message.event) && message.message.content) {
            const senderAddress = message.from.replace("eip155:", "");
            const isWhitelisted = await checkWhitelisted(senderAddress);

            if (message.event === "chat.request") {
                await pushBotInitializer.chat.accept(senderAddress);
            }

            if (isWhitelisted) {
                await handleCommand(message);
            } else {
                sendResponseMessage(getWhitelistedResponse, message.chatId);
            }
        }
    } catch (error) {
        console.error(error);
    }
});

stream.connect();

const service = restana();
service.get('/hi', (req, res) => res.send('Hello World!'));

service.start(3001);
