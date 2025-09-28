// Test to verify beneficiaries functionality
#[test_only]
module srujan_addr::test_beneficiaries_dashboard {
    use srujan_addr::deadlock_v2;
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::aptos_account;

    #[test(aptos_framework = @aptos_framework, deployer = @srujan_addr, alice = @0x123, bob = @0x456, charlie = @0x789)]
    fun test_get_beneficiaries_dashboard(
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

        // Test 1: Initially, Alice should have no beneficiaries
        let beneficiaries = deadlock_v2::get_beneficiaries(alice_addr);
        assert!(vector::length(&beneficiaries) == 0, 1);
        assert!(deadlock_v2::get_beneficiaries_count(alice_addr) == 0, 2);

        // Test 2: Alice adds Bob and Charlie as beneficiaries
        deadlock_v2::add_beneficiary(alice, bob_addr, 30);
        deadlock_v2::add_beneficiary(alice, charlie_addr, 40);

        // Test 3: Check Alice's beneficiaries using original function
        let beneficiaries = deadlock_v2::get_beneficiaries(alice_addr);
        assert!(vector::length(&beneficiaries) == 2, 3);

        // Test 4: Check Alice's beneficiaries using new helper functions
        assert!(deadlock_v2::get_beneficiaries_count(alice_addr) == 2, 4);
        
        let (addresses, percentages) = deadlock_v2::get_beneficiaries_details(alice_addr);
        assert!(vector::length(&addresses) == 2, 5);
        assert!(vector::length(&percentages) == 2, 6);

        // Test 5: Verify the beneficiaries data is correct
        let first_addr = vector::borrow(&addresses, 0);
        let first_percentage = vector::borrow(&percentages, 0);
        let second_addr = vector::borrow(&addresses, 1);
        let second_percentage = vector::borrow(&percentages, 1);

        // Should be Bob (30%) and Charlie (40%)
        assert!(*first_addr == bob_addr && *first_percentage == 30, 7);
        assert!(*second_addr == charlie_addr && *second_percentage == 40, 8);

        // Test 6: Update beneficiary and check again
        deadlock_v2::update_beneficiary(alice, bob_addr, 35); // Change Bob from 30% to 35%
        
        let (updated_addresses, updated_percentages) = deadlock_v2::get_beneficiaries_details(alice_addr);
        let updated_first_percentage = vector::borrow(&updated_percentages, 0);
        assert!(*updated_first_percentage == 35, 9); // Should be updated to 35%

        // Test 7: Remove beneficiary and check
        deadlock_v2::remove_beneficiary(alice, charlie_addr); // Remove Charlie
        
        assert!(deadlock_v2::get_beneficiaries_count(alice_addr) == 1, 10); // Should have only 1 now
        let (final_addresses, final_percentages) = deadlock_v2::get_beneficiaries_details(alice_addr);
        assert!(vector::length(&final_addresses) == 1, 11);
        assert!(vector::length(&final_percentages) == 1, 12);
        
        // Should only have Bob now
        let remaining_addr = vector::borrow(&final_addresses, 0);
        let remaining_percentage = vector::borrow(&final_percentages, 0);
        assert!(*remaining_addr == bob_addr && *remaining_percentage == 35, 13);

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }
}