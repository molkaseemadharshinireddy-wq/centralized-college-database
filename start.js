const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const mysql = require('mysql2');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const databaseName = process.env.DB_NAME || 'CCD';
const databaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '#',
  port: Number(process.env.DB_PORT) || 3306
};
const services = [
  { name: 'student', script: 'script.js', envName: 'PORT', defaultPort: 3000 },
  { name: 'search', script: 'script2.js', envName: 'SEARCH_PORT', defaultPort: 4000 },
  { name: 'instructor', script: 'script3.js', envName: 'INSTRUCTOR_PORT', defaultPort: 5000 }
];

function isServiceRunning(service, port) {
  return new Promise(resolve => {
    const request = http.get({
      hostname: '127.0.0.1',
      port,
      path: `/__health/${service.name}`,
      timeout: 1500
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 128) {
          request.destroy();
        }
      });
      response.on('end', () => {
        resolve(response.statusCode === 200 && body === JSON.stringify({ service: service.name }));
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function ensurePortsAvailable() {
  const usedPorts = new Set();
  const servicesToStart = [];
  for (const service of services) {
    const port = Number(process.env[service.envName]) || service.defaultPort;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`${service.envName} must be a valid TCP port between 1 and 65535.`);
    }
    if (usedPorts.has(port)) {
      throw new Error(`Port ${port} is assigned to more than one service. Set unique service ports.`);
    }
    usedPorts.add(port);

    let portAvailable = true;
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', reject);
      server.listen(port, () => {
        server.close(error => error ? reject(error) : resolve());
      });
    }).catch(error => {
      if (error.code === 'EADDRINUSE') {
        return isServiceRunning(service, port).then(isRunning => {
          if (!isRunning) {
            throw new Error(
              `Port ${port} is in use by another application and cannot be used by the ${service.name} service. ` +
              `Stop that application or set ${service.envName} to a free port.`
            );
          }
          portAvailable = false;
          console.log(`${service.name} service is already running on port ${port}; reusing it.`);
        });
      }
      throw error;
    });
    if (portAvailable) {
      servicesToStart.push(service);
    }
  }
  return servicesToStart;
}

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

    const [emailColumn] = await query(
      connection,
      'SELECT COUNT(*) AS column_count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [databaseName, 'app_users', 'email']
    );
    if (emailColumn.column_count === 0) {
      await query(connection, 'ALTER TABLE app_users ADD COLUMN email VARCHAR(254) NULL');
    }

    const [emailIndex] = await query(
      connection,
      'SELECT COUNT(*) AS index_count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
      [databaseName, 'app_users', 'uq_app_users_email']
    );
    if (emailIndex.index_count === 0) {
      await query(connection, 'CREATE UNIQUE INDEX uq_app_users_email ON app_users (email)');
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

function startServices(servicesToStart) {
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

  for (const service of servicesToStart) {
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

const setupOnly = process.argv.includes('--setup-only');
(setupOnly ? setupDatabase().then(() => []) : ensurePortsAvailable())
  .then(servicesToStart => {
    if (setupOnly) return;
    if (servicesToStart.length === 0) {
      console.log('All application services are already running.');
      return;
    }
    return setupDatabase().then(() => startServices(servicesToStart));
  })
  .catch(error => {
    console.error('Application startup failed:', error.message);
    process.exitCode = 1;
  });
