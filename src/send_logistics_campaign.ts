import { readFile } from "node:fs/promises";
import { sendCampaign } from "./logistics_campaign.js";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: npm run demo -- <campaign.json>");
const input: unknown = JSON.parse(await readFile(inputPath, "utf8"));

console.log(JSON.stringify(await sendCampaign(input), null, 2));
