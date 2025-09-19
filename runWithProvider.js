const dotenv = require('dotenv');
const { execSync } = require('child_process');
const { existsSync, copyFileSync, unlinkSync } = require('fs');
const path = require('path');

dotenv.config();

const { DATABASE_PROVIDER } = process.env;
const databaseProviderDefault = DATABASE_PROVIDER ?? 'postgresql';

if (!DATABASE_PROVIDER) {
  console.warn(`DATABASE_PROVIDER is not set in the .env file, using default: ${databaseProviderDefault}`);
}

// Function to determine which schema file to use
function getSchemaFile(provider) {
  switch (provider) {
    case 'psql_bouncer':
      return 'postgresql-schema.prisma'; // psql_bouncer uses postgresql schema
    default:
      return `${provider}-schema.prisma`;
  }
}

// Function to determine which migrations folder to use
function getMigrationsFolder(provider) {
  switch (provider) {
    case 'psql_bouncer':
      return 'postgresql-migrations'; // psql_bouncer uses postgresql migrations
    default:
      return `${provider}-migrations`;
  }
}

const schemaFile = getSchemaFile(databaseProviderDefault);
const migrationsFolder = getMigrationsFolder(databaseProviderDefault);
const sourceSchemaPath = path.join('prisma', schemaFile);
const targetSchemaPath = path.join('prisma', 'schema.prisma');

// Ensure source schema exists
if (!existsSync(sourceSchemaPath)) {
  console.error(`Schema file not found: ${sourceSchemaPath}`);
  process.exit(1);
}

// Copy the appropriate schema to the default location
try {
  copyFileSync(sourceSchemaPath, targetSchemaPath);
  console.log(`Copied ${sourceSchemaPath} to ${targetSchemaPath}`);
} catch (error) {
  console.error(`Failed to copy schema file: ${error.message}`);
  process.exit(1);
}

let command = process.argv
  .slice(2)
  .join(' ')
  .replace(/DATABASE_PROVIDER/g, databaseProviderDefault)
  .replace(/--schema\s+[^\s]+/g, '') // Remove --schema arguments since we're using default location
  .trim();

// Replace migrations folder references
const migrationsPattern = new RegExp(`${databaseProviderDefault}-migrations`, 'g');
command = command.replace(migrationsPattern, migrationsFolder);

// Handle Windows rmdir command
if (command.includes('rmdir') && existsSync('prisma\\migrations')) {
  try {
    execSync('rmdir /S /Q prisma\\migrations', { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error removing directory: prisma\\migrations`);
    process.exit(1);
  }
} else if (command.includes('rmdir')) {
  console.warn(`Directory 'prisma\\migrations' does not exist, skipping removal.`);
}

// Handle Unix rm command
if (command.includes('rm -rf ./prisma/migrations') && existsSync('./prisma/migrations')) {
  try {
    execSync('rm -rf ./prisma/migrations', { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error removing directory: ./prisma/migrations`);
    process.exit(1);
  }
}

try {
  console.log(`Executing command: ${command}`);
  execSync(command, { stdio: 'inherit' });
  console.log('Command executed successfully');
} catch (error) {
  console.error(`Error executing command: ${command}`);
  console.error(`Error details: ${error.message}`);
  process.exit(1);
} finally {
  // Clean up: remove the temporary schema file if it's different from source
  if (existsSync(targetSchemaPath) && sourceSchemaPath !== targetSchemaPath) {
    try {
      unlinkSync(targetSchemaPath);
      console.log(`Cleaned up temporary schema file: ${targetSchemaPath}`);
    } catch (error) {
      console.warn(`Failed to clean up temporary schema file: ${error.message}`);
    }
  }
}