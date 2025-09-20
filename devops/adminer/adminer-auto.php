<?php
/**
 * Auto-login for Adminer - Project Nexus Development Environment
 *
 * This script automatically logs into PostgreSQL for development convenience.
 * Based on: https://steampixel.de/simply-auto-login-to-your-adminer/
 *
 * Security Note: This is for development environments only.
 * Never use in production.
 */

if(!count($_GET)) {
  // Retrieve environment variables for database connection
  // Multiple sources checked for compatibility with different Docker setups
  $user = $_ENV['ADMINER_DEFAULT_USER'] ?? getenv('ADMINER_DEFAULT_USER') ?? 'nexus';
  $password = $_ENV['ADMINER_DEFAULT_PASSWORD'] ?? getenv('ADMINER_DEFAULT_PASSWORD') ?? 'nexus_secure_2024';
  $db = $_ENV['ADMINER_DEFAULT_DB'] ?? getenv('ADMINER_DEFAULT_DB') ?? 'nexus_db';
  $server = $_ENV['ADMINER_DEFAULT_SERVER'] ?? getenv('ADMINER_DEFAULT_SERVER') ?? 'postgres';

  // Auto-populate login form
  $_POST['auth'] = [
    'server' => $server,
    'username' => $user,
    'password' => $password,
    'driver' => 'pgsql',
    'db' => $db
  ];
}

// Include the main Adminer script
include "adminer.php";
?>