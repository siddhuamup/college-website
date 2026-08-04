/**
 * PM2 Ecosystem Configuration — SSCC Junnar ERP Production
 * Cluster mode with automatic restarts and log management.
 */

module.exports = {
  apps: [
    {
      name: 'sscc-junnar-api',
      script: 'src/index.js',
      instances: 'max', // Scale to CPU core count
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};
