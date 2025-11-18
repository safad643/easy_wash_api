const config = require('../config/config');

const sendOTP = async (email, otp) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 OTP Email');
  console.log(`Email: ${email}`);
  console.log(`OTP Code: ${otp}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // TODO: Implement actual email sending (e.g., using nodemailer, sendgrid, etc.)
  // For now, this is a mock implementation
  return { type: 'success', mock: true };
};

module.exports = { sendOTP };

