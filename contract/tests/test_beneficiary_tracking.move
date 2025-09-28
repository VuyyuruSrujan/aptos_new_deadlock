#[test_only]
module srujan_addr::test_beneficiary_tracking {
    use srujan_addr::deadlock_v2;
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::aptos_account;

    #[test(aptos_framework = @aptos_framework, deployer = @srujan_addr, alice = @0x123, bob = @0x456)]
    fun test_beneficiary_tracking_functionality(
        aptos_framework: &signer,
        deployer: &signer,
        alice: &signer,
        bob: &signer
    ) {
        // Initialize Aptos coin and accounts
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        
        aptos_account::create_account(signer::address_of(alice));
        aptos_account::create_account(signer::address_of(bob));
        aptos_account::create_account(signer::address_of(deployer));

        // Give Alice some coins
        let alice_addr = signer::address_of(alice);
        let bob_addr = signer::address_of(bob);
        
        coin::register<AptosCoin>(alice);
        coin::register<AptosCoin>(bob);
        coin::register<AptosCoin>(deployer);
        
        let alice_coins = coin::mint(1000, &mint_cap);
        coin::deposit(alice_addr, alice_coins);

        // Initialize global index (deployer only)
        deadlock_v2::initialize_global_index(deployer);

        // Test 1: Alice adds Bob as beneficiary with 30% 
        deadlock_v2::add_beneficiary(alice, bob_addr, 30);

        // Test 2: Check that Bob can see Alice added him as beneficiary
        let bob_beneficiary_info = deadlock_v2::get_added_as_beneficiary(bob_addr);
        assert!(vector::length(&bob_beneficiary_info) == 1, 1);
        
        let (owner, percentage, claimed) = deadlock_v2::get_owner_entry_details_by_index(bob_addr, 0);
        assert!(owner == alice_addr, 2);
        assert!(percentage == 30, 3);
        assert!(!claimed, 4);

        // Test 3: Check helper functions
        assert!(deadlock_v2::has_been_added_as_beneficiary(bob_addr), 5);
        assert!(deadlock_v2::get_beneficiary_owners_count(bob_addr) == 1, 6);
        assert!(deadlock_v2::get_total_inheritable_percentage(bob_addr) == 30, 7);

        // Test 4: Test unclaimed inheritances
        let unclaimed = deadlock_v2::get_unclaimed_inheritances(bob_addr);
        assert!(vector::length(&unclaimed) == 1, 8);

        // Test 5: Alice locks some funds
        deadlock_v2::lock_funds(alice, 100);
        assert!(deadlock_v2::get_locked_funds(alice_addr) == 100, 9);

        // Test 6: Bob claims inheritance
        deadlock_v2::claim_inherited_funds(bob, alice_addr);
        
        // Verify Bob received 30% of Alice's locked funds (30 coins)
        assert!(coin::balance<AptosCoin>(bob_addr) == 30, 10);
        
        // Verify Alice has 70 coins left in locked funds
        assert!(deadlock_v2::get_locked_funds(alice_addr) == 70, 11);

        // Test 7: Check that Bob's inheritance is now marked as claimed
        let (_, _, claimed_status) = deadlock_v2::get_owner_entry_details_by_index(bob_addr, 0);
        assert!(claimed_status, 12);

        // Test 8: Verify unclaimed inheritances is now empty
        let unclaimed_after_claim = deadlock_v2::get_unclaimed_inheritances(bob_addr);
        assert!(vector::length(&unclaimed_after_claim) == 0, 13);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    #[test(aptos_framework = @aptos_framework, deployer = @srujan_addr, alice = @0x123, bob = @0x456, charlie = @0x789)]
    fun test_multiple_beneficiary_tracking(
        aptos_framework: &signer,
        deployer: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer
    ) {
        // Initialize
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        
        aptos_account::create_account(signer::address_of(alice));
        aptos_account::create_account(signer::address_of(bob));
        aptos_account::create_account(signer::address_of(charlie));
        aptos_account::create_account(signer::address_of(deployer));

        let alice_addr = signer::address_of(alice);
        let bob_addr = signer::address_of(bob);
        let charlie_addr = signer::address_of(charlie);
        
        coin::register<AptosCoin>(alice);
        coin::register<AptosCoin>(bob);
        coin::register<AptosCoin>(charlie);
        coin::register<AptosCoin>(deployer);

        // Initialize global index
        deadlock_v2::initialize_global_index(deployer);

        // Both Alice and Charlie add Bob as beneficiary
        deadlock_v2::add_beneficiary(alice, bob_addr, 25);
        deadlock_v2::add_beneficiary(charlie, bob_addr, 40);

        // Bob should see both Alice and Charlie added him
        let bob_info = deadlock_v2::get_added_as_beneficiary(bob_addr);
        assert!(vector::length(&bob_info) == 2, 1);
        assert!(deadlock_v2::get_beneficiary_owners_count(bob_addr) == 2, 2);
        assert!(deadlock_v2::get_total_inheritable_percentage(bob_addr) == 65, 3); // 25 + 40

        // Test updating beneficiary percentage
        deadlock_v2::update_beneficiary(alice, bob_addr, 30); // Update Alice's allocation from 25% to 30%
        
        // Check updated percentage
        let updated_info = deadlock_v2::get_added_as_beneficiary(bob_addr);
        assert!(deadlock_v2::get_total_inheritable_percentage(bob_addr) == 70, 4); // 30 + 40

        // Test removing beneficiary
        deadlock_v2::remove_beneficiary(charlie, bob_addr); // Charlie removes Bob as beneficiary
        
        // Bob should now only see Alice
        let final_info = deadlock_v2::get_added_as_beneficiary(bob_addr);
        assert!(vector::length(&final_info) == 1, 5);
        assert!(deadlock_v2::get_beneficiary_owners_count(bob_addr) == 1, 6);
        assert!(deadlock_v2::get_total_inheritable_percentage(bob_addr) == 30, 7); // Only Alice's 30%

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }
}