import restana from "restana";
import { PushAPI, CONSTANTS } from '@pushprotocol/restapi';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import Groq from "groq-sdk";
import { sepoliaRpcUrl, whitelistContractAddress } from "./helpers/Consts.js";
import abi from "./contracts/whitelist/abi/abi.json" assert { type: "json" };

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const signer = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY);

const dellamaUser = await PushAPI.initialize(signer, {
    env: CONSTANTS.ENV.PROD,
});

const stream = await dellamaUser.initStream([CONSTANTS.STREAM.CHAT]);

const providerUrl = sepoliaRpcUrl;
const provider = new ethers.providers.JsonRpcProvider(providerUrl);
const contractAddress = whitelistContractAddress;

const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
const whitelistContract = new ethers.Contract(contractAddress, abi, wallet);

async function checkWhitelisted(senderAddress) {
    const whitelisted = await whitelistContract.isWhitelisted(senderAddress);
    return whitelisted;
}

async function sendResponseMessage(message,recipient){
    try{
        await dellamaUser.chat.send(recipient, {
            type: 'Text',
            content: message,
        });
        console.log("Response Sent")
    }catch{
        console.log("Response Sending failed")
    }
    
}

async function groqResponseMessage(request){
    const response = await groq.chat.completions.create({
        messages: [
            {
            role: "user",
            content: `${request}`,
            },
        ],
        model: "llama3-8b-8192",
    });
    return response;
}

stream.on(CONSTANTS.STREAM.CHAT, async (message) => { 
    console.log(message.event)
    try {
        if (message.event ==="chat.message" || message.event ==="chat.request") {
            const senderAddress = message.from.replace("eip155:", "");
            const isWhitelisted = await checkWhitelisted(senderAddress); 
            if(message.event==="chat.request"){
                await dellamaUser.chat.accept(senderAddress);
            }
            if(isWhitelisted){
                if(message.message.content.startsWith("/llama")){
                    const request = message.message.content.replace("/llama", "");
                    const response = await groqResponseMessage(request);
                    sendResponseMessage(response.choices[0].message.content,message.chatId)
                }
            }
            if(!isWhitelisted){
                sendResponseMessage("You are not Whitelisted!",message.chatId)
            }
        } 
    } catch (error) {
        console.error(error); 
    }
});
  
stream.connect();

const service = restana()
service.get('/hi', (req, res) => res.send('Hello World!'))

service.start(3001);