module.exports = {
  apps: [
    {
      name: 'sova-x-mentions',
      cwd: __dirname,
      script: 'dist/scripts/mention-worker.js',
      interpreter: 'node',
      node_args: '--enable-source-maps',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      exp_backoff_restart_delay: 100,
      restart_delay: 5000,
      min_uptime: '30s',
      kill_timeout: 15000,
      max_memory_restart: '512M',
      merge_logs: true,
      time: true,
      out_file: 'out/logs/mention-worker.out.log',
      error_file: 'out/logs/mention-worker.err.log',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
