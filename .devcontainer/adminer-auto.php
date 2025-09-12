<?php
// Auto-login for Adminer - Development environment
// Based on: https://steampixel.de/simply-auto-login-to-your-adminer/
// Uses environment variables for security

if(!count($_GET)) {
  $_POST['auth'] = [
    'server' => 'postgres',
    'username' => $_ENV['ADMINER_DEFAULT_USER'] ?? 'nexus',
    'password' => $_ENV['ADMINER_DEFAULT_PASSWORD'] ?? 'nexus_secure_2024',
    'driver' => 'pgsql',
    'db'    => $_ENV['ADMINER_DEFAULT_DB'] ?? 'nexus_db'
  ];
}

include "adminer.php";
?>