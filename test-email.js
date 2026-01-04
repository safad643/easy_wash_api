/**
 * Nodemailer Test Script
 * Run with: node test-email.js
 * 
 * Make sure your .env file has these variables set:
 * - EMAIL_HOST (optional, defaults to smtp.gmail.com)
 * - EMAIL_PORT (optional, defaults to 587)
 * - EMAIL_USER (required)
 * - EMAIL_PASS (required)
 * - EMAIL_FROM (optional, defaults to EMAIL_USER)
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

// Email configuration from env
const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📧 Nodemailer Test Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check if credentials are configured
if (!emailConfig.user || !emailConfig.pass) {
    console.error('❌ EMAIL_USER and EMAIL_PASS must be set in .env file!');
    console.log('\nRequired environment variables:');
    console.log('  EMAIL_USER - Your email address');
    console.log('  EMAIL_PASS - Your email password or app password');
    console.log('\nOptional environment variables:');
    console.log('  EMAIL_HOST - SMTP host (default: smtp.gmail.com)');
    console.log('  EMAIL_PORT - SMTP port (default: 587)');
    console.log('  EMAIL_FROM - From address (default: EMAIL_USER)');
    process.exit(1);
}

console.log('Configuration:');
console.log(`  Host: ${emailConfig.host}`);
console.log(`  Port: ${emailConfig.port}`);
console.log(`  User: ${emailConfig.user}`);
console.log(`  From: ${emailConfig.from}`);
console.log(`  Secure: ${emailConfig.port === 465}`);
console.log('');

// Create transporter
const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.port === 465,
    auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
    },
});

async function testEmail() {
    try {
        // Step 1: Verify connection
        console.log('🔄 Step 1: Verifying SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection successful!\n');

        // Step 2: Send test email
        console.log('🔄 Step 2: Sending test email...');

        const testOTP = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP

        const mailOptions = {
            from: `"Eazy Wash Test" <${emailConfig.from}>`,
            to: 'safad643@gmail.com', // Send to yourself for testing
            subject: '🧪 Test Email - Eazy Wash Nodemailer',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 20px 0;">
            <h1 style="color: #333; margin: 0;">Eazy Wash</h1>
            <p style="color: #666; margin: 5px 0;">Email Test</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center;">
            <h2 style="color: white; margin: 0 0 10px 0;">✅ Email Test Successful!</h2>
            <div style="background: white; padding: 20px; border-radius: 8px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${testOTP}</span>
            </div>
            <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0 0; font-size: 14px;">
              This is a test OTP code
            </p>
          </div>
          
          <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
            <p>If you received this email, your nodemailer configuration is working correctly!</p>
            <p style="margin-top: 10px;">Sent at: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `,
            text: `Eazy Wash Email Test\n\nTest OTP: ${testOTP}\n\nIf you received this email, your nodemailer configuration is working correctly!\n\nSent at: ${new Date().toLocaleString()}`
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Test email sent successfully!\n');
        console.log('Email Details:');
        console.log(`  Message ID: ${info.messageId}`);
        console.log(`  Sent to: ${emailConfig.user}`);
        console.log(`  Test OTP: ${testOTP}`);
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 All tests passed! Your nodemailer is working correctly.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('❌ Email test failed!');
        console.error('');
        console.error('Error:', error.message);
        console.error('');

        // Common error hints
        if (error.message.includes('Invalid login')) {
            console.log('💡 Hint: For Gmail, you need to use an App Password, not your regular password.');
            console.log('   1. Go to your Google Account → Security → 2-Step Verification');
            console.log('   2. At the bottom, select App passwords');
            console.log('   3. Generate a new app password for "Mail"');
            console.log('   4. Use that 16-character password in EMAIL_PASS');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.log('💡 Hint: Could not connect to the SMTP server.');
            console.log('   - Check your EMAIL_HOST and EMAIL_PORT settings');
            console.log('   - Make sure your firewall allows outgoing connections on the SMTP port');
        } else if (error.message.includes('certificate')) {
            console.log('💡 Hint: SSL/TLS certificate issue.');
            console.log('   - Try changing EMAIL_PORT to 587 for TLS or 465 for SSL');
        }

        process.exit(1);
    }
}

testEmail();
