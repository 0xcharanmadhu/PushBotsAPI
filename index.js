import restana from "restana";
import { PushAPI, CONSTANTS } from '@pushprotocol/restapi';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import Groq from "groq-sdk";
import { sepoliaRpcUrl, whitelistContractAddress } from "./helpers/Consts.js";
import abi from "./contracts/whitelist/abi/abi.json" assert { type: "json" };
import { BufferMemory } from "langchain/memory";
import { ChatGroq } from "@langchain/groq";
import { ConversationChain } from "langchain/chains";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const signer = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY);

const pushBotInitializer = await PushAPI.initialize(signer, {
    env: CONSTANTS.ENV.PROD,
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
    const whitelisted = await whitelistContract.isWhitelisted(senderAddress);
    return whitelisted;
}

async function sendResponseMessage(message, recipient) {
    try {
        await pushBotInitializer.chat.send(recipient, {
            type: 'Text',
            content: message,
        });
        console.log("Response Sent");
    } catch {
        console.log("Response Sending failed");
    }
}

const memoryMap = new Map();

const model = new ChatGroq({
    model: "llama3-8b-8192",
    temperature: 0,
});

function getMemoryForChatId(chatId) {
    if (!memoryMap.has(chatId)) {
        memoryMap.set(chatId, new BufferMemory());
    }
    return memoryMap.get(chatId);
}

function getConversationChainForChatId(chatId) {
    const memory = getMemoryForChatId(chatId);
    return new ConversationChain({
        llm: model,
        memory: memory,
    });
}

async function groqResponseMessage(request, chatId) {
    const chain = getConversationChainForChatId(chatId);
    const response = await chain.call({
        input: request
    });
    return response;
}

stream.on(CONSTANTS.STREAM.CHAT, async (message) => {
    try {
        if (message.origin === "other" && (message.event === "chat.message" || message.event === "chat.request")) {
            const senderAddress = message.from.replace("eip155:", "");
            const isWhitelisted = await checkWhitelisted(senderAddress); 
            if (message.event === "chat.request") {
                await pushBotInitializer.chat.accept(senderAddress);
            }
            if (isWhitelisted) {
                if (message.message.content.startsWith("/bot")) {
                    const request = message.message.content.replace("/bot", "");
                    const response = await groqResponseMessage(request, message.chatId);
                    sendResponseMessage(response.response, message.chatId);
                }
            } else {
                sendResponseMessage("You are not Whitelisted!", message.chatId);
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
