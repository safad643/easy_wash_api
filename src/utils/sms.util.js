const axios = require('axios');
const config = require('../config/config');

const sendOTP = async (phone, otp) => {
  try {
    // MSG91 API implementation
    const response = await axios.post('https://api.msg91.com/api/v5/otp', {
      template_id: 'your_template_id_here',
      mobile: phone,
      authkey: config.sms.apiKey,
      otp: otp
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('SMS sending failed:', error.message);
    throw new Error('Failed to send OTP');
  }
};

// Alternative: Twilio implementation (comment out MSG91 above and use this)
/*
const twilio = require('twilio');
const client = twilio(config.sms.accountSid, config.sms.authToken);

const sendOTP = async (phone, otp) => {
  try {
    await client.messages.create({
      body: `Your verification code is: ${otp}`,
      from: config.sms.phoneNumber,
      to: phone
    });
  } catch (error) {
    console.error('SMS sending failed:', error.message);
    throw new Error('Failed to send OTP');
  }
};
*/

module.exports = { sendOTP };
