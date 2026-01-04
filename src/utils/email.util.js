const nodemailer = require('nodemailer');
const config = require('../config/config');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
};

const sendOTP = async (email, otp) => {
  // If email credentials not configured, use mock
  if (!config.email.user || !config.email.pass) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 OTP Email (MOCK - No email config)');
    console.log(`Email: ${email}`);
    console.log(`OTP Code: ${otp}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { type: 'success', mock: true };
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: `"Eazy Wash" <${config.email.from}>`,
    to: email,
    subject: 'Your OTP Code - Eazy Wash',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0;">
          <h1 style="color: #333; margin: 0;">Eazy Wash</h1>
          <p style="color: #666; margin: 5px 0;">Premium Car Care Services</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center;">
          <h2 style="color: white; margin: 0 0 10px 0;">Your Verification Code</h2>
          <div style="background: white; padding: 20px; border-radius: 8px; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otp}</span>
          </div>
          <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0 0; font-size: 14px;">
            This code expires in 10 minutes
          </p>
        </div>
        
        <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
          <p>If you didn't request this code, please ignore this email.</p>
          <p style="margin-top: 20px;">&copy; ${new Date().getFullYear()} Eazy Wash. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ OTP email sent to ${email}`);
    return { type: 'success', mock: false };
  } catch (error) {
    console.error('Email send error:', error.message);
    throw new Error('Failed to send email');
  }
};

module.exports = { sendOTP };
