require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const config = require('../config/config');
const User = require('../models/user.model');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function resetAdmin() {
    try {
        // Get new credentials from user
        const email = await prompt('Enter new admin email: ');
        const phone = await prompt('Enter new admin phone (optional, press Enter to skip): ');
        const password = await prompt('Enter new admin password: ');

        if (!email || !password) {
            console.error('Error: Email and password are required');
            process.exit(1);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.error('Error: Invalid email format');
            process.exit(1);
        }

        // Validate password length
        if (password.length < 6) {
            console.error('Error: Password must be at least 6 characters');
            process.exit(1);
        }

        console.log('\nConnecting to MongoDB...');
        await mongoose.connect(config.mongodb.uri);
        console.log('Connected to MongoDB');

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Find existing admin
        const admin = await User.findOne({ role: 'admin' });

        if (admin) {
            console.log(`Found existing admin: ${admin.email || admin.phone || admin._id}`);

            // Update admin credentials
            const updateData = {
                email: email.toLowerCase().trim(),
                password: hashedPassword
            };
            if (phone) updateData.phone = phone.trim();

            await User.findOneAndUpdate(
                { role: 'admin' },
                updateData
            );
            console.log('\n✅ Admin credentials updated successfully!');
        } else {
            console.log('No admin found. Creating new admin...');

            // Create new admin
            const adminData = {
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                role: 'admin',
                name: 'Admin',
                status: 'active'
            };
            if (phone) adminData.phone = phone.trim();

            await User.create(adminData);
            console.log('\n✅ Admin created successfully!');
        }

        console.log(`   Email: ${email}`);
        if (phone) console.log(`   Phone: ${phone}`);

    } catch (error) {
        console.error('Error resetting admin:', error.message);
        process.exit(1);
    } finally {
        rl.close();
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

resetAdmin();
