const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const mysql = require('mysql2');

const databaseName = process.env.DB_NAME || 'CCD';
const databaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '#',
  port: Number(process.env.DB_PORT) || 3306
};
const services = [
  { name: 'student', script: 'script.js' },
  { name: 'search', script: 'script2.js' },
  { name: 'instructor', script: 'script3.js' }
];

function query(connection, sql, values) {
  return new Promise((resolve, reject) => {
    connection.query(sql, values, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

async function setupDatabase() {
  if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
  }

  const connection = mysql.createConnection(databaseConfig);
  let connected = false;
  try {
    await new Promise((resolve, reject) => {
      connection.connect(error => {
        if (error) {
          reject(error);
          return;
        }
        connected = true;
        resolve();
      });
    });

    await query(connection, 'CREATE DATABASE IF NOT EXISTS ??', [databaseName]);
    await query(connection, 'USE ??', [databaseName]);

    const schemaPath = path.join(__dirname, 'DatabaseDesign.sql');
    const statements = fs.readFileSync(schemaPath, 'utf8')
      .split(';')
      .map(statement => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await query(connection, statement);
    }

    console.log(`Database "${databaseName}" and required tables are ready.`);
  } finally {
    if (connected) {
      await new Promise((resolve, reject) => {
        connection.end(error => error ? reject(error) : resolve());
      });
    } else {
      connection.destroy();
    }
  }
}

function startServices() {
  const children = [];
  let shuttingDown = false;

  function stopServices(exitCode) {
    if (shuttingDown) return;
    shuttingDown = true;
    process.exitCode = exitCode;
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
      }
    }
  }

  for (const service of services) {
    const child = spawn(process.execPath, [path.join(__dirname, service.script)], {
      cwd: __dirname,
      env: process.env,
      stdio: 'inherit'
    });
    children.push(child);

    child.on('error', error => {
      console.error(`Could not start ${service.name} service:`, error);
      stopServices(1);
    });
    child.on('exit', (code, signal) => {
      if (!shuttingDown) {
        console.error(
          `${service.name} service exited unexpectedly (${signal || `code ${code}`}).`
        );
        stopServices(code || 1);
      }
    });
  }

  process.on('SIGINT', () => stopServices(0));
  process.on('SIGTERM', () => stopServices(0));
}

setupDatabase()
  .then(() => {
    if (process.argv.includes('--setup-only')) {
      return;
    }
    startServices();
  })
  .catch(error => {
    console.error('Application startup failed:', error.message);
    process.exitCode = 1;
  });
