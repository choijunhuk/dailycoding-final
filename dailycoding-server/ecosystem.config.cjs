module.exports = {
  apps: [{
    name: 'dailycoding-api',
    script: 'src/index.js',
    interpreter: 'node',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '512M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000,
      JUDGE_MODE: 'docker',
    },
    error_file: '/var/log/dailycoding/error.log',
    out_file: '/var/log/dailycoding/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
