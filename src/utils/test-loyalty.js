import {
  getTierByLifetimePoints,
  getDiscountByTier,
  calculatePointsEarned,
  calculatePointsToNextTier,
  calculateFinalTotal,
  getLoyaltySummary,
} from './loyalty.js';

console.log(getTierByLifetimePoints(0));       // GUEST
console.log(getTierByLifetimePoints(499));     // GUEST
console.log(getTierByLifetimePoints(500));     // BRONZE
console.log(getTierByLifetimePoints(999));     // BRONZE
console.log(getTierByLifetimePoints(1000));    // SILVER
console.log(getTierByLifetimePoints(1499));    // SILVER
console.log(getTierByLifetimePoints(1500));    // GOLD
console.log(getTierByLifetimePoints(2499));    // GOLD
console.log(getTierByLifetimePoints(2500));    // PLATINUM

console.log(getDiscountByTier('GUEST'));       // 0
console.log(getDiscountByTier('BRONZE'));      // 5
console.log(getDiscountByTier('SILVER'));      // 10
console.log(getDiscountByTier('GOLD'));        // 15
console.log(getDiscountByTier('PLATINUM'));    // 20

console.log(calculatePointsEarned(100));       // 5
console.log(calculatePointsEarned(95));        // 5
console.log(calculatePointsEarned(44));        // 2

console.log(calculatePointsToNextTier(300));   // 200
console.log(calculatePointsToNextTier(800));   // 200
console.log(calculatePointsToNextTier(1200));  // 300
console.log(calculatePointsToNextTier(2000));  // 500
console.log(calculatePointsToNextTier(2600));  // 0

console.log(calculateFinalTotal(100, 'SILVER')); // 90

console.log(getLoyaltySummary(1200, 300));