module srujan_addr::deadlock1 {   
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_std::table;
    // Events/guid removed to avoid friend-only API usage

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

    /// Deletes the user's profile data
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

    /// Initialize the global index - should be called by the module deployer
    public entry fun initialize_global_index(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        // Only allow the module deployer to initialize
        assert!(deployer_addr == @srujan_addr, 1001);
        
        if (!exists<GlobalIndex>(@srujan_addr)) {
            let map = table::new();
            move_to(deployer, GlobalIndex { map });
        };
    }

    /// Add a beneficiary for the sender. Each user has their own Beneficiaries resource.
    public entry fun add_beneficiary(user: &signer, beneficiary_addr: address, percentage: u8) 
        acquires Beneficiaries, GlobalIndex 
    {
        let user_addr = signer::address_of(user);
        let new_beneficiary = Beneficiary { addr: beneficiary_addr, percentage };

        // 1. Update user's beneficiary list
        if (exists<Beneficiaries>(user_addr)) {
            let b = borrow_global_mut<Beneficiaries>(user_addr);
            let len = vector::length(&b.list);
            let total = {
                let acc = 0u64;
                let i = 0;
                while (i < len) {
                    let ben = vector::borrow(&b.list, i);
                    acc = acc + (ben.percentage as u64);
                    i = i + 1;
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

    /// Claim inherited funds from someone who added you as beneficiary
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

    /// Store or update user profile information
    /// Check-in period is converted from days (as decimal) to seconds for storage
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

    public entry fun update_beneficiary(user: &signer, beneficiary_addr: address, new_percentage: u8) acquires Beneficiaries {
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

        // Return early if beneficiary not found
        if (exists_at == len) {
            return
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
        ben.percentage = new_percentage
    }
}