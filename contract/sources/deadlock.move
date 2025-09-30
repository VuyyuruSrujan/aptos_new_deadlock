module srujan_addr::deadlock_v2 {   
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use aptos_std::table;

    struct LockedFunds has key {
        amount: coin::Coin<AptosCoin>
    }

    struct UserProfile has key, drop {
        first_name: vector<u8>,
        last_name: vector<u8>,
        email: vector<u8>,
        bio: vector<u8>,
        check_in_seconds: u64  // Stored in seconds for more precise tracking
    }

    public entry fun delete_profile(user: &signer) acquires UserProfile {
        let user_addr = signer::address_of(user);
        assert!(exists<UserProfile>(user_addr), 0); // Assert profile exists
        move_from<UserProfile>(user_addr); // Remove and destroy the profile
    }

    struct Beneficiary has copy, drop, store {
        addr: address,
        percentage: u8,
    }

    // Removed event-related structs

    struct AddedAsBeneficiary has key {
        owners: vector<OwnerEntry>
    }

    struct OwnerEntry has copy, drop, store {
        owner: address,
        percentage: u8,
        claimed: bool,  // Track if funds have been claimed
    }

    struct GlobalIndex has key {
        map: table::Table<address, vector<OwnerEntry>>,
    }

    struct Beneficiaries has key {
        list: vector<Beneficiary>
    }

    struct DeadlockConfig has key, drop {
        address: address,                    // User's address
        inactivity_period_seconds: u64,      // Inactivity period in seconds (converted from days)
        last_updated_timestamp: u64,         // Timestamp when configuration was last updated
    }

    struct UserSubAccount has key {
        main_account: address,               // The main account that owns this subaccount
        subaccount_address: address,         // The address of this subaccount
        funds: coin::Coin<AptosCoin>,       // Funds stored in the subaccount
        created_timestamp: u64,             // When the subaccount was created
    }

    struct SubAccountRegistry has key {
        subaccount_address: address,         // Maps main account to its subaccount address
    }

    public entry fun initialize_global_index(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        // Only allow the module deployer to initialize
        assert!(deployer_addr == @srujan_addr, 1001);
        
        if (!exists<GlobalIndex>(@srujan_addr)) {
            let map = table::new();
            move_to(deployer, GlobalIndex { map });
        };
    }

    public entry fun add_beneficiary(user: &signer, beneficiary_addr: address, percentage: u8) 
        acquires Beneficiaries, GlobalIndex 
    {
        let user_addr = signer::address_of(user);
        let new_beneficiary = Beneficiary { addr: beneficiary_addr, percentage };

        // 1. Update user's beneficiary list
        if (exists<Beneficiaries>(user_addr)) {
            let b = borrow_global_mut<Beneficiaries>(user_addr);
            let len = vector::length(&b.list);
            
            // Check if beneficiary already exists
            let i = 0;
            while (i < len) {
                let ben = vector::borrow(&b.list, i);
                if (ben.addr == beneficiary_addr) {
                    abort EDUPLICATE_BENEFICIARY; // Beneficiary already exists
                };
                i = i + 1;
            };
            
            let total = {
                let acc = 0u64;
                let j = 0;
                while (j < len) {
                    let ben = vector::borrow(&b.list, j);
                    acc = acc + (ben.percentage as u64);
                    j = j + 1;
                };
                acc
            };
            // Check if adding this beneficiary would exceed 100%
            if ((total + (percentage as u64)) > 100) {
                abort EOVER_PERCENTAGE;
            };
            vector::push_back(&mut b.list, new_beneficiary);
        } else {
            // Only one beneficiary, so just check percentage
            if ((percentage as u64) > 100) {
                abort EOVER_PERCENTAGE;
            };
            move_to(user, Beneficiaries { list: vector::singleton(new_beneficiary) });
        };

        // 2. Update global index to track who added whom as beneficiary
        let owner_entry = OwnerEntry { owner: user_addr, percentage, claimed: false };
        
        // Use the module's address to store the global index
        if (exists<GlobalIndex>(@srujan_addr)) {
            let global_index = borrow_global_mut<GlobalIndex>(@srujan_addr);
            if (table::contains(&global_index.map, beneficiary_addr)) {
                let owners = table::borrow_mut(&mut global_index.map, beneficiary_addr);
                vector::push_back(owners, owner_entry);
            } else {
                let owners = vector::singleton(owner_entry);
                table::add(&mut global_index.map, beneficiary_addr, owners);
            };
        }
        // If GlobalIndex doesn't exist, we need to initialize it first
        // This is handled by the initialize_global_index function
    }

    #[view]
    public fun get_beneficiaries(addr: address): vector<Beneficiary> acquires Beneficiaries {
        if (exists<Beneficiaries>(addr)) {
            let b = borrow_global<Beneficiaries>(addr);
            b.list
        } else {
            vector::empty<Beneficiary>()
        }
    }

    #[view]
    public fun get_beneficiaries_details(addr: address): (vector<address>, vector<u8>) acquires Beneficiaries {
        if (exists<Beneficiaries>(addr)) {
            let b = borrow_global<Beneficiaries>(addr);
            let len = vector::length(&b.list);
            let addresses = vector::empty<address>();
            let percentages = vector::empty<u8>();
            
            let i = 0;
            while (i < len) {
                let beneficiary = vector::borrow(&b.list, i);
                vector::push_back(&mut addresses, beneficiary.addr);
                vector::push_back(&mut percentages, beneficiary.percentage);
                i = i + 1;
            };
            
            (addresses, percentages)
        } else {
            (vector::empty<address>(), vector::empty<u8>())
        }
    }

    #[view]
    public fun get_beneficiaries_count(addr: address): u64 acquires Beneficiaries {
        if (exists<Beneficiaries>(addr)) {
            let b = borrow_global<Beneficiaries>(addr);
            vector::length(&b.list)
        } else {
            0
        }
    }

    #[view]
    public fun beneficiary_exists(user_addr: address, beneficiary_addr: address): bool acquires Beneficiaries {
        if (exists<Beneficiaries>(user_addr)) {
            let b = borrow_global<Beneficiaries>(user_addr);
            let len = vector::length(&b.list);
            let i = 0;
            while (i < len) {
                let ben = vector::borrow(&b.list, i);
                if (ben.addr == beneficiary_addr) {
                    return true
                };
                i = i + 1;
            };
            false
        } else {
            false
        }
    }

    #[view]
    public fun get_added_as_beneficiary(addr: address): vector<OwnerEntry> acquires GlobalIndex {
        if (exists<GlobalIndex>(@srujan_addr)) {
            let global_index = borrow_global<GlobalIndex>(@srujan_addr);
            if (table::contains(&global_index.map, addr)) {
                *table::borrow(&global_index.map, addr)
            } else {
                vector::empty<OwnerEntry>()
            }
        } else {
            vector::empty<OwnerEntry>()
        }
    }

    #[view]
    public fun has_been_added_as_beneficiary(addr: address): bool acquires GlobalIndex {
        if (exists<GlobalIndex>(@srujan_addr)) {
            let global_index = borrow_global<GlobalIndex>(@srujan_addr);
            table::contains(&global_index.map, addr)
        } else {
            false
        }
    }

    #[view]
    public fun get_beneficiary_owners_count(addr: address): u64 acquires GlobalIndex {
        if (exists<GlobalIndex>(@srujan_addr)) {
            let global_index = borrow_global<GlobalIndex>(@srujan_addr);
            if (table::contains(&global_index.map, addr)) {
                let owners = table::borrow(&global_index.map, addr);
                vector::length(owners)
            } else {
                0
            }
        } else {
            0
        }
    }

    #[view]
    public fun get_beneficiary_details(addr: address): vector<OwnerEntry> acquires GlobalIndex {
        get_added_as_beneficiary(addr)
    }

    #[view]
    public fun get_unclaimed_inheritances(addr: address): vector<OwnerEntry> acquires GlobalIndex {
        if (exists<GlobalIndex>(@srujan_addr)) {
            let global_index = borrow_global<GlobalIndex>(@srujan_addr);
            if (table::contains(&global_index.map, addr)) {
                let owners = table::borrow(&global_index.map, addr);
                let unclaimed = vector::empty<OwnerEntry>();
                let len = vector::length(owners);
                let i = 0;
                while (i < len) {
                    let owner_entry = vector::borrow(owners, i);
                    if (!owner_entry.claimed) {
                        vector::push_back(&mut unclaimed, *owner_entry);
                    };
                    i = i + 1;
                };
                unclaimed
            } else {
                vector::empty<OwnerEntry>()
            }
        } else {
            vector::empty<OwnerEntry>()
        }
    }

    // Get the total percentage this address can inherit (from all unclaimed sources)
    #[view]
    public fun get_total_inheritable_percentage(addr: address): u64 acquires GlobalIndex {
        let unclaimed = get_unclaimed_inheritances(addr);
        let total_percentage = 0u64;
        let len = vector::length(&unclaimed);
        let i = 0;
        while (i < len) {
            let owner_entry = vector::borrow(&unclaimed, i);
            total_percentage = total_percentage + (owner_entry.percentage as u64);
            i = i + 1;
        };
        total_percentage
    }

    #[view]
    public fun get_owner_entry_details_by_index(addr: address, index: u64): (address, u8, bool) acquires GlobalIndex {
        let owners = get_added_as_beneficiary(addr);
        assert!(index < vector::length(&owners), 9001); // Index out of bounds
        let owner_entry = vector::borrow(&owners, index);
        (owner_entry.owner, owner_entry.percentage, owner_entry.claimed)
    }

    #[view]
    public fun get_all_owner_entries_details(addr: address): (vector<address>, vector<u8>, vector<bool>) acquires GlobalIndex {
        let owners = get_added_as_beneficiary(addr);
        let len = vector::length(&owners);
        let owners_addrs = vector::empty<address>();
        let percentages = vector::empty<u8>();
        let claimed_statuses = vector::empty<bool>();
        
        let i = 0;
        while (i < len) {
            let owner_entry = vector::borrow(&owners, i);
            vector::push_back(&mut owners_addrs, owner_entry.owner);
            vector::push_back(&mut percentages, owner_entry.percentage);
            vector::push_back(&mut claimed_statuses, owner_entry.claimed);
            i = i + 1;
        };
        
        (owners_addrs, percentages, claimed_statuses)
    }

    public entry fun claim_inherited_funds(
        beneficiary: &signer, 
        owner_addr: address
    ) acquires GlobalIndex, LockedFunds {
        let beneficiary_addr = signer::address_of(beneficiary);
        
        // Check if GlobalIndex exists
        assert!(exists<GlobalIndex>(@srujan_addr), 1001); // GlobalIndex not initialized
        
        let global_index = borrow_global_mut<GlobalIndex>(@srujan_addr);
        assert!(table::contains(&global_index.map, beneficiary_addr), 1002); // Not a beneficiary
        
        let owners = table::borrow_mut(&mut global_index.map, beneficiary_addr);
        let len = vector::length(owners);
        
        // Find the owner entry and check if already claimed
        let i = 0;
        while (i < len) {
            let owner_entry = vector::borrow_mut(owners, i);
            if (owner_entry.owner == owner_addr) {
                assert!(!owner_entry.claimed, 1003); // Already claimed
                owner_entry.claimed = true;
                
                let percentage = owner_entry.percentage;
                
                // Check if owner has locked funds
                assert!(exists<LockedFunds>(owner_addr), 1005); // Owner has no locked funds
                
                let locked_funds = borrow_global_mut<LockedFunds>(owner_addr);
                let total_locked = coin::value(&locked_funds.amount);
                
                // Calculate the amount to transfer (percentage of total locked funds)
                let claim_amount = (total_locked * (percentage as u64)) / 100;
                assert!(claim_amount > 0, 1006); // No funds to claim
                
                // Extract the funds
                let claimed_coins = coin::extract(&mut locked_funds.amount, claim_amount);
                
                // Deposit to beneficiary's account
                coin::deposit(beneficiary_addr, claimed_coins);
                return
            };
            i = i + 1;
        };
        
        // If we reach here, owner was not found
        assert!(false, 1004); // Owner not found
    }

    #[view]
    public fun get_user_balance(addr: address): u64 {
        coin::balance<AptosCoin>(addr)
    }

    public fun get_user_balance_generic<CoinType>(addr: address): u64 {
        coin::balance<CoinType>(addr)
    }

    public fun get_my_balance(user: &signer): u64 {
        let user_addr = signer::address_of(user);
        coin::balance<AptosCoin>(user_addr)
    }

    public fun has_sufficient_balance(addr: address, required_amount: u64): bool {
        let current_balance = coin::balance<AptosCoin>(addr);
        current_balance >= required_amount
    }

    public fun get_balance_info(addr: address): (u64, bool) {
        let balance = coin::balance<AptosCoin>(addr);
        let has_balance = balance > 0;
        (balance, has_balance)
    }

    const EINSUFFICIENT_BALANCE: u64 = 1;
    const EINVALID_PERCENTAGE: u64 = 2;
    const EOVER_PERCENTAGE: u64 = 3;
    const EDUPLICATE_BENEFICIARY: u64 = 4;
    const EBENEFICIARY_NOT_FOUND: u64 = 5;
    const EINVALID_DAYS: u64 = 6;
    const ESUBACCOUNT_ALREADY_EXISTS: u64 = 7;
    const ESUBACCOUNT_NOT_FOUND: u64 = 8;

    // Constants for time conversion
    const SECONDS_PER_DAY: u64 = 86400; // 24 * 60 * 60 = 86400 seconds in a day

    // Create a subaccount for the user (simplified version stored under main account)
    public entry fun create_subaccount(user: &signer) {
        let user_addr = signer::address_of(user);
        
        // Check if user already has a subaccount
        assert!(!exists<SubAccountRegistry>(user_addr), ESUBACCOUNT_ALREADY_EXISTS);
        
        // Generate subaccount address using the user's address and a seed
        let subaccount_seed = b"deadlock_subaccount";
        let subaccount_address = account::create_resource_address(&user_addr, subaccount_seed);
        
        // Create the registry entry for this user
        move_to(user, SubAccountRegistry { 
            subaccount_address 
        });
        
        // Initialize the subaccount data under the main user account
        let empty_coins = coin::zero<AptosCoin>();
        
        move_to(user, UserSubAccount {
            main_account: user_addr,
            subaccount_address,
            funds: empty_coins,
            created_timestamp: timestamp::now_seconds(),
        });
    }

    // Check if user has a subaccount
    #[view]
    public fun has_subaccount(user_addr: address): bool {
        exists<SubAccountRegistry>(user_addr)
    }

    // Get subaccount address for a user
    #[view]
    public fun get_subaccount_address(user_addr: address): address acquires SubAccountRegistry {
        assert!(exists<SubAccountRegistry>(user_addr), ESUBACCOUNT_NOT_FOUND);
        let registry = borrow_global<SubAccountRegistry>(user_addr);
        registry.subaccount_address
    }

    // Get subaccount details
    #[view]
    public fun get_subaccount_details(user_addr: address): (address, u64, u64) acquires SubAccountRegistry, UserSubAccount {
        let subaccount_addr = get_subaccount_address(user_addr);
        
        assert!(exists<UserSubAccount>(user_addr), ESUBACCOUNT_NOT_FOUND);
        let subaccount = borrow_global<UserSubAccount>(user_addr);
        
        let balance = coin::value(&subaccount.funds);
        (subaccount_addr, balance, subaccount.created_timestamp)
    }

    // Deposit funds to subaccount
    public entry fun deposit_to_subaccount(user: &signer, amount: u64) acquires UserSubAccount {
        let user_addr = signer::address_of(user);
        
        // Withdraw from user's main account
        let coins = coin::withdraw<AptosCoin>(user, amount);
        
        // Add to subaccount stored under main account
        let subaccount = borrow_global_mut<UserSubAccount>(user_addr);
        coin::merge(&mut subaccount.funds, coins);
    }

    // Transfer funds from subaccount back to main account or to another address
    public entry fun transfer_from_subaccount(
        user: &signer, 
        to_address: address, 
        amount: u64
    ) acquires UserSubAccount {
        let user_addr = signer::address_of(user);
        
        // Get subaccount and check balance
        let subaccount = borrow_global_mut<UserSubAccount>(user_addr);
        let available_balance = coin::value(&subaccount.funds);
        assert!(available_balance >= amount, EINSUFFICIENT_BALANCE);
        
        // Extract funds from subaccount
        let transfer_coins = coin::extract(&mut subaccount.funds, amount);
        
        // Deposit to target address
        coin::deposit(to_address, transfer_coins);
    }

public entry fun lock_funds(user: &signer, amount: u64) acquires LockedFunds {
    let addr = signer::address_of(user);

    let current_balance = coin::balance<AptosCoin>(addr);
    if (current_balance < amount) {
        abort EINSUFFICIENT_BALANCE;
    };

    let coins = coin::withdraw<AptosCoin>(user, amount);
    if (exists<LockedFunds>(addr)) {
        let locked = borrow_global_mut<LockedFunds>(addr);
        coin::merge(&mut locked.amount, coins);
    } else {
        move_to(user, LockedFunds { amount: coins });
    }
}

    #[view]
    public fun get_locked_funds(addr: address): u64 acquires LockedFunds {
        if (exists<LockedFunds>(addr)) {
            let locked = borrow_global<LockedFunds>(addr);
            coin::value(&locked.amount)
        } else {
            0
        }
    }

    #[view]
    public fun check_beneficiary_percentage(
        addr: address, 
        beneficiary_addr: address, 
        new_percentage: u8
    ): bool acquires Beneficiaries {
        if (!exists<Beneficiaries>(addr)) {
            // No beneficiaries yet, just check if new percentage > 100
            (new_percentage as u64) > 100
        } else {
            let b = borrow_global<Beneficiaries>(addr);
            let len = vector::length(&b.list);
            // Calculate total percentages including the new/updated percentage
            let total = {
                let sum = 0u64;
                let found = false;
                let i = 0;
                while (i < len) {
                    let ben = vector::borrow(&b.list, i);
                    if (ben.addr == beneficiary_addr) {
                        sum = sum + (new_percentage as u64);
                        found = true;
                    } else {
                        sum = sum + (ben.percentage as u64)
                    };
                    i = i + 1
                };
                // If beneficiary not found, add new percentage
                if (!found) {
                    sum = sum + (new_percentage as u64)
                };
                sum
            };
            total > 100
        }
    }

    public entry fun store_user_profile(
        user: &signer, 
        first_name: vector<u8>,
        last_name: vector<u8>,
        email: vector<u8>,
        bio: vector<u8>,
        check_in_days: u64,
        check_in_decimals: u64
    ) acquires UserProfile {
        let user_addr = signer::address_of(user);
        let check_in_seconds = (check_in_days * 86400) + ((check_in_decimals * 86400) / 100); // Convert days.decimals to seconds

        if (!exists<UserProfile>(user_addr)) {
            move_to(user, UserProfile {
                first_name,
                last_name,
                email,
                bio,
                check_in_seconds
            });
        } else {
            let profile = borrow_global_mut<UserProfile>(user_addr);
            profile.first_name = first_name;
            profile.last_name = last_name;
            profile.email = email;
            profile.bio = bio;
            profile.check_in_seconds = check_in_seconds;
        }
    }

    #[view]
    public fun get_user_profile(user_addr: address): (vector<u8>, vector<u8>, vector<u8>, vector<u8>, u64) acquires UserProfile {
        assert!(exists<UserProfile>(user_addr), 2001); // Error if profile doesn't exist
        let profile = borrow_global<UserProfile>(user_addr);
        
        (
            profile.first_name,
            profile.last_name,
            profile.email,
            profile.bio,
            profile.check_in_seconds
        )
    }

    public entry fun update_beneficiary(user: &signer, beneficiary_addr: address, new_percentage: u8) acquires Beneficiaries, GlobalIndex {
        let user_addr = signer::address_of(user);
        assert!(exists<Beneficiaries>(user_addr), 1001); // 1001 = No beneficiaries
        let b = borrow_global_mut<Beneficiaries>(user_addr);
        let len = vector::length(&b.list);
        
        // First check if beneficiary exists
        let exists_at = {
            let i = 0;
            let found_index = len; // Default to len (invalid index) if not found
            while (i < len) {
                let ben = vector::borrow(&b.list, i);
                if (ben.addr == beneficiary_addr) {
                    found_index = i;
                    break
                };
                i = i + 1
            };
            found_index
        };

        // Abort if beneficiary not found
        if (exists_at == len) {
            abort EBENEFICIARY_NOT_FOUND
        };

        // Calculate total percentages with the new percentage
        let total = {
            let sum = 0u64;
            let i = 0;
            while (i < len) {
                let ben = vector::borrow(&b.list, i);
                if (i == exists_at) {
                    sum = sum + (new_percentage as u64)
                } else {
                    sum = sum + (ben.percentage as u64)
                };
                i = i + 1
            };
            sum
        };

        // Verify total percentage is not over 100%
        if (total > 100) {
            abort EOVER_PERCENTAGE
        };

        // Update the beneficiary's percentage
        let ben = vector::borrow_mut(&mut b.list, exists_at);
        ben.percentage = new_percentage;

        // Also update the percentage in the global index
        if (exists<GlobalIndex>(@srujan_addr)) {
            let global_index = borrow_global_mut<GlobalIndex>(@srujan_addr);
            if (table::contains(&global_index.map, beneficiary_addr)) {
                let owners = table::borrow_mut(&mut global_index.map, beneficiary_addr);
                let owners_len = vector::length(owners);
                let i = 0;
                while (i < owners_len) {
                    let owner_entry = vector::borrow_mut(owners, i);
                    if (owner_entry.owner == user_addr) {
                        owner_entry.percentage = new_percentage;
                        break
                    };
                    i = i + 1;
                };
            };
        }
    }

    public entry fun remove_beneficiary(user: &signer, beneficiary_addr: address) acquires Beneficiaries, GlobalIndex {
        let user_addr = signer::address_of(user);
        assert!(exists<Beneficiaries>(user_addr), 1001); // No beneficiaries
        
        let b = borrow_global_mut<Beneficiaries>(user_addr);
        let len = vector::length(&b.list);
        
        // Find and remove beneficiary from user's list
        let i = 0;
        let found = false;
        while (i < len) {
            let ben = vector::borrow(&b.list, i);
            if (ben.addr == beneficiary_addr) {
                vector::remove(&mut b.list, i);
                found = true;
                break
            };
            i = i + 1;
        };
        
        if (!found) {
            abort EBENEFICIARY_NOT_FOUND
        };

        // Also remove from global index
        if (exists<GlobalIndex>(@srujan_addr)) {
            let global_index = borrow_global_mut<GlobalIndex>(@srujan_addr);
            if (table::contains(&global_index.map, beneficiary_addr)) {
                let owners = table::borrow_mut(&mut global_index.map, beneficiary_addr);
                let owners_len = vector::length(owners);
                let i = 0;
                while (i < owners_len) {
                    let owner_entry = vector::borrow(owners, i);
                    if (owner_entry.owner == user_addr) {
                        vector::remove(owners, i);
                        break
                    };
                    i = i + 1;
                };
                
                // If no more owners for this beneficiary, remove the entire entry
                if (vector::is_empty(owners)) {
                    table::remove(&mut global_index.map, beneficiary_addr);
                };
            };
        }
    }

    // Set deadlock configuration for a user (accepts days, converts to seconds)
    public entry fun set_deadlock_config(user: &signer, inactivity_days: u64) acquires DeadlockConfig {
        let user_addr = signer::address_of(user);
        
        // Validate input - minimum 1 day
        assert!(inactivity_days >= 1, EINVALID_DAYS);
        
        // Convert days to seconds for more accurate tracking
        let inactivity_seconds = inactivity_days * SECONDS_PER_DAY;
        
        // Get current timestamp from the blockchain
        let current_time = timestamp::now_seconds();
        
        // Store or update the configuration
        if (exists<DeadlockConfig>(user_addr)) {
            // Update existing configuration
            let existing_config = borrow_global_mut<DeadlockConfig>(user_addr);
            existing_config.inactivity_period_seconds = inactivity_seconds;
            existing_config.last_updated_timestamp = current_time;
        } else {
            // Create new configuration
            let config = DeadlockConfig {
                address: user_addr,
                inactivity_period_seconds: inactivity_seconds,
                last_updated_timestamp: current_time,
            };
            move_to(user, config);
        };
    }

    // Set deadlock configuration for a user (accepts seconds directly for decimal precision)
    public entry fun set_deadlock_config_seconds(user: &signer, inactivity_seconds: u64) acquires DeadlockConfig {
        let user_addr = signer::address_of(user);
        
        // Validate input - minimum 1 second 
        assert!(inactivity_seconds >= 1, EINVALID_DAYS);
        
        // Get current timestamp from the blockchain
        let current_time = timestamp::now_seconds();
        
        // Store or update the configuration
        if (exists<DeadlockConfig>(user_addr)) {
            // Update existing configuration
            let existing_config = borrow_global_mut<DeadlockConfig>(user_addr);
            existing_config.inactivity_period_seconds = inactivity_seconds;
            existing_config.last_updated_timestamp = current_time;
        } else {
            // Create new configuration
            let config = DeadlockConfig {
                address: user_addr,
                inactivity_period_seconds: inactivity_seconds,
                last_updated_timestamp: current_time,
            };
            move_to(user, config);
        };
    }

    // Get deadlock configuration for a user
    #[view]
    public fun get_deadlock_config(addr: address): (address, u64, u64) acquires DeadlockConfig {
        if (exists<DeadlockConfig>(addr)) {
            let config = borrow_global<DeadlockConfig>(addr);
            (config.address, config.inactivity_period_seconds, config.last_updated_timestamp)
        } else {
            // Return default values if no configuration exists
            (addr, 0, 0)
        }
    }

    // Get deadlock configuration in user-friendly format (days instead of seconds)
    #[view]
    public fun get_deadlock_config_in_days(addr: address): (address, u64, u64) acquires DeadlockConfig {
        let (address, inactivity_seconds, last_updated) = get_deadlock_config(addr);
        let inactivity_days = if (inactivity_seconds > 0) { 
            inactivity_seconds / SECONDS_PER_DAY 
        } else { 
            0 
        };
        (address, inactivity_days, last_updated)
    }

    // Get deadlock configuration with decimal precision (returns seconds for precise calculation)
    #[view]
    public fun get_deadlock_config_precise(addr: address): (address, u64, u64) acquires DeadlockConfig {
        get_deadlock_config(addr)
    }

    // Check if a user has deadlock configuration set
    #[view]
    public fun has_deadlock_config(addr: address): bool {
        exists<DeadlockConfig>(addr)
    }

    // Get only the inactivity period in days for a user
    #[view]
    public fun get_inactivity_period_days(addr: address): u64 acquires DeadlockConfig {
        let (_, inactivity_days, _) = get_deadlock_config_in_days(addr);
        inactivity_days
    }

    // Get only the last updated timestamp for a user
    #[view]
    public fun get_last_updated_timestamp(addr: address): u64 acquires DeadlockConfig {
        let (_, _, last_updated) = get_deadlock_config(addr);
        last_updated
    }
}