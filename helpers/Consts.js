import dotenv from 'dotenv';
dotenv.config();

export const sepoliaRpcUrl = `https://sepolia.infura.io/v3/${process.env.INFURA_API}`;
export const whitelistContractAddress = "0x249Ff81042619747E259A4E8eF6bf6921bB511C0"