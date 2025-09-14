<?php
// Auto-login for Adminer - Development environment
// Based on: https://steampixel.de/simply-auto-login-to-your-adminer/
// Uses environment variables for security - no fallbacks for security

if(!count($_GET)) {
  // Require environment variables - fail if not set
  if (!isset($_ENV['ADMINER_DEFAULT_USER']) || 
      !isset($_ENV['ADMINER_DEFAULT_PASSWORD']) || 
      !isset($_ENV['ADMINER_DEFAULT_DB'])) {
    die('ERROR: Adminer environment variables not configured (ADMINER_DEFAULT_USER, ADMINER_DEFAULT_PASSWORD, ADMINER_DEFAULT_DB)');
  }

  $_POST['auth'] = [
    'server' => 'postgres',
    'username' => $_ENV['ADMINER_DEFAULT_USER'],
    'password' => $_ENV['ADMINER_DEFAULT_PASSWORD'],
    'driver' => 'pgsql',
    'db'    => $_ENV['ADMINER_DEFAULT_DB']
  ];
}

include "adminer.php";
?>