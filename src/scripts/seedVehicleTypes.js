/**
 * Seed script to populate initial vehicle categories and types
 * Run with: node src/scripts/seedVehicleTypes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const VehicleCategory = require('../models/vehicleCategory.model');
const VehicleType = require('../models/vehicleType.model');

const INITIAL_DATA = [
    {
        category: { name: 'Car', slug: 'car', icon: '🚗', displayOrder: 1 },
        types: [
            { bodyType: 'hatchback', name: 'Hatchback', icon: '🚗', displayOrder: 1 },
            { bodyType: 'sedan', name: 'Sedan', icon: '🚙', displayOrder: 2 },
            { bodyType: 'suv', name: 'SUV', icon: '🚐', displayOrder: 3 },
            { bodyType: 'luxury', name: 'Luxury', icon: '🏎️', displayOrder: 4 },
        ],
    },
    {
        category: { name: 'Bike', slug: 'bike', icon: '🏍️', displayOrder: 2 },
        types: [
            { bodyType: 'super-bike', name: 'Super Bike', icon: '🏍️', displayOrder: 1 },
            { bodyType: 'sports-bike', name: 'Sports Bike', icon: '🏁', displayOrder: 2 },
            { bodyType: 'cruiser', name: 'Cruiser', icon: '🛵', displayOrder: 3 },
            { bodyType: 'scooty', name: 'Scooty', icon: '🛴', displayOrder: 4 },
        ],
    },
];

async function seedVehicleTypes() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/easywash';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        for (const item of INITIAL_DATA) {
            // Create or update category
            let category = await VehicleCategory.findOne({ slug: item.category.slug });
            if (!category) {
                category = await VehicleCategory.create(item.category);
                console.log(`Created category: ${category.name}`);
            } else {
                console.log(`Category exists: ${category.name}`);
            }

            // Create types
            for (const typeData of item.types) {
                const exists = await VehicleType.findOne({
                    category: item.category.slug,
                    bodyType: typeData.bodyType,
                });

                if (!exists) {
                    await VehicleType.create({
                        ...typeData,
                        category: item.category.slug,
                    });
                    console.log(`  Created type: ${typeData.name}`);
                } else {
                    console.log(`  Type exists: ${typeData.name}`);
                }
            }
        }

        console.log('Seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seedVehicleTypes();
