<?php
// Auto-login for Adminer - Development environment
// Based on: https://steampixel.de/simply-auto-login-to-your-adminer/

if(!count($_GET)) {
  $_POST['auth'] = [
    'server' => 'postgres',
    'username' => 'nexus',
    'password' => 'nexus_secure_2024',
    'driver' => 'pgsql',
    'db'    => 'nexus_db'
  ];
}

include "adminer.php";
?>