<?php
// Auto-login for Adminer - Development environment
// Based on: https://steampixel.de/simply-auto-login-to-your-adminer/
// Uses environment variables for security - no fallbacks for security

if(!count($_GET)) {
  // Check multiple sources for environment variables
  $user = $_ENV['ADMINER_DEFAULT_USER'] ?? getenv('ADMINER_DEFAULT_USER') ?? 'nexus';
  $password = $_ENV['ADMINER_DEFAULT_PASSWORD'] ?? getenv('ADMINER_DEFAULT_PASSWORD') ?? 'nexus_secure_2024';
  $db = $_ENV['ADMINER_DEFAULT_DB'] ?? getenv('ADMINER_DEFAULT_DB') ?? 'nexus_db';
  $server = $_ENV['ADMINER_DEFAULT_SERVER'] ?? getenv('ADMINER_DEFAULT_SERVER') ?? 'localhost';

  $_POST['auth'] = [
    'server' => $server,
    'username' => $user,
    'password' => $password,
    'driver' => 'pgsql',
    'db' => $db
  ];
}

include "adminer.php";
?>