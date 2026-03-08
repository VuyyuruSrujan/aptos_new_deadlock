require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");

const modules = [
  { address: process.env.VITE_MODULE_ADDRESS || process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS, name: "deadlock_v2" },
  { address: "0x1", name: "coin" },
];

async function getAbi() {
  // Wait for 5 seconds to ensure the module is deployed
  await new Promise((resolve) => setTimeout(resolve, 5000));
  modules.forEach((module) => {
    const url = `https://fullnode.${process.env.VITE_APP_NETWORK}.aptoslabs.com/v1/accounts/${module.address}/module/${module.name}`;
    fetch(url)
      .then((response) => response.json())
      .then((response) => {
        const abi = response.abi;
        const abiString = `export const ${module.name.toUpperCase()}_ABI = ${JSON.stringify(abi)} as const;`;
        const outDir = path.join("frontend", "types");
        fs.mkdirSync(outDir, { recursive: true });
        const outFile = path.join(outDir, `${module.name}_abi.ts`);
        fs.writeFileSync(outFile, abiString);
        console.log(`${module.name} ABI saved to ${outFile}`);
      })
      .catch((error) => {
        console.error("Error fetching ABI:", error);
      });
  });
}

getAbi();
