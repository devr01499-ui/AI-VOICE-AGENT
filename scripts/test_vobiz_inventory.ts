import { VobizInventoryService } from '../server/src/services/VobizInventoryService';

async function testInventory() {
    const service = new VobizInventoryService();
    console.log("Fetching available numbers...");
    try {
        const numbers = await service.getAvailableNumbers('test-user-id', {});
        console.log("Success! Received numbers:");
        console.log(JSON.stringify(numbers, null, 2));

        if (numbers.length > 0) {
            console.log("\nFetching details for the first number...");
            const details = await service.getNumberDetails('test-user-id', numbers[0].id);
            console.log("Number details:");
            console.log(JSON.stringify(details, null, 2));
        } else {
            console.log("No numbers found in inventory.");
        }
    } catch (e: any) {
        console.error("Test Failed:");
        console.error(e.message);
    }
}

testInventory();
