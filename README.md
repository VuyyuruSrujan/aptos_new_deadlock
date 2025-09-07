🪙 DeadLock
DeadLock is a decentralized application (dApp) designed to act as a digital will and life activity monitor on the blockchain.
It ensures that your assets are securely distributed according to your wishes if you become inactive for a specified period.

🚀 Concept
When a user registers on DeadLock, they:

Specify how often they will open or interact with the dApp (e.g., every 30 days).
Provide beneficiary details – wallet addresses of family members or others, along with the percentage of funds each should receive.
Deposit funds into the contract.
If the user fails to check in within the specified time:

The contract automatically assumes the user is inactive (or deceased).
Funds are released to the beneficiaries in the exact percentages set during registration.
🛠 Features
Life Activity Tracking – Monitors user activity based on the frequency they choose.
Decentralized Inheritance – Distributes funds without middlemen or legal delays.
Customizable Beneficiaries – Users can set multiple recipients with custom allocation percentages.
Trustless & Transparent – Powered by blockchain smart contracts, ensuring fairness and security.
📌 Example Workflow
User Registration

Inputs:
Activity check-in interval (e.g., every 60 days)
List of beneficiaries (address + percentage)
Deposit amount
Activity Tracking

Smart contract checks if the user visited within the set interval.
Fund Distribution

If the user fails to check in on time:
Funds are released automatically to beneficiaries.
🏗 Tech Stack
Smart Contract Language: Move
Frontend: TypeScript
Blockchain Network: Aptos
Wallet Integration: Aptos Wallet (Petra)
📦 Installation & Setup
Clone the repository:
git clone https://github.com/your-username/deadlock.git
cd deadlock
