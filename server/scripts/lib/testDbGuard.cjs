'use strict';
/**
 * Test-database guard — load this FIRST in every test script and every script
 * that touches the database. It aborts the process unless TEST_DATABASE_URL
 * points at a dedicated test database (never the one in server/.env), then
 * forces DATABASE_URL/DIRECT_URL to that test URL. There is no bypass switch.
 * Logic and documentation: ./testDbGuardCore.cjs
 */
require('./testDbGuardCore.cjs').assertTestDatabase();
