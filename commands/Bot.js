import { BufferMemory } from "langchain/memory";
import { ChatGroq } from "@langchain/groq";
import { ConversationChain } from "langchain/chains";
import { UpstashRedisChatMessageHistory } from "@langchain/community/stores/message/upstash_redis";
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

const defaultModel = "llama3-8b-8192";

const redis = new Redis({
  url: "https://proven-swan-30163.upstash.io",
  token: process.env.UPSTASH_TOKEN,
});

function getConversationChainForChatId(chatId, model = defaultModel) {
    const memory = new BufferMemory({
        chatHistory: new UpstashRedisChatMessageHistory({
            sessionId: chatId,
            config: {
                url: "https://proven-swan-30163.upstash.io",
                token: process.env.UPSTASH_TOKEN,
            }
        })
    });

    const llmModel = new ChatGroq({
        model: model,
        temperature: 0,
    });

    return new ConversationChain({
        llm: llmModel,
        memory: memory,
    });
}

export async function BotResponseMessage(request, chatId) {
    const model = await redis.get(`model:${chatId}`) || defaultModel;
    const chain = getConversationChainForChatId(chatId, model);
    const response = await chain.call({
        input: request
    });
    return response;
}

export async function setModelForChatId(chatId, model) {
    const validModels = ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768", "gemma-7b-it"];
    if(validModels.includes(model)){
        await redis.set(`model:${chatId}`, model);
        return `Model Set: ${model}`;
    } else {
        return `Failed to set model: ${model} is not a valid model.`;
    }
}

export async function getModelForChatId(chatId) {
    const model = await redis.get(`model:${chatId}`) || defaultModel;
    return model;
}
