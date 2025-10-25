const app = require('./app');
const connectDB = require('./config/database');
const config = require('./config/config');

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.env}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
