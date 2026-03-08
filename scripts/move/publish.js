require("dotenv").config();
const fs = require("node:fs");
const cli = require("@aptos-labs/ts-sdk/dist/common/cli/index.js");
const aptosSDK = require("@aptos-labs/ts-sdk")

async function publish() {

  if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS) {
    throw new Error(
      "VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY variable is not set, make sure you have set the publisher account address",
    );
  }

  if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY) {
    throw new Error(
      "VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY variable is not set, make sure you have set the publisher account private key",
    );
  }

  const move = new cli.Move();

  await move.publish({
    packageDirectoryPath: "contract",
    namedAddresses: {
      srujan_addr: process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS,
    },
    extraArguments: [
      `--private-key=${process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY}`,
      `--url=${aptosSDK.NetworkToNodeAPI[process.env.VITE_APP_NETWORK]}`,
      "--assume-yes",
    ],
  });

  const filePath = ".env";
  let envContent = "";

  if (fs.existsSync(filePath)) {
    envContent = fs.readFileSync(filePath, "utf8");
  }

  const regex = /^VITE_MODULE_ADDRESS=.*$/m;
  const newEntry = `VITE_MODULE_ADDRESS=${process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS}`;

  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, newEntry);
  } else {
    envContent += `\n${newEntry}`;
  }

  fs.writeFileSync(filePath, envContent, "utf8");
}
publish();
