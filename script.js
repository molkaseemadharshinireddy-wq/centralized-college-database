const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const app = express();
const scrypt = promisify(crypto.scrypt);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/__health/student', (req, res) => {
  res.json({ service: 'student' });
});

app.use('/auth', (req, res, next) => {
  const origin = req.get('origin');
  if (origin) {
    try {
      const url = new URL(origin);
      const isLocalOrigin = url.protocol === 'http:' &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
      if (isLocalOrigin) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Vary', 'Origin');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
      }
    } catch (error) {
      res.status(400).json({ message: 'Invalid request origin.' });
      return;
    }
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Manshisahu12',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'CCD'
};

const db = mysql.createConnection(dbConfig);

async function verifyPassword(password, passwordHash) {
  const [saltHex, hashHex] = passwordHash.split(':');
  if (!/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(hashHex)) {
    throw new Error('Stored password hash has an invalid format.');
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const actualHash = await scrypt(password, salt, expectedHash.length);
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL database with connection ID ' + db.threadId);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'addStudent.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/aboutCollege.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'aboutCollege.html'));
});

app.get('/style1.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style1.css'));
});

app.get('/portal.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'portal.css'));
});

app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/tree.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'tree.js'));
});

app.get('/departments.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'departments.json'));
});

app.get('/node_modules/animejs/lib/anime.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'animejs', 'lib', 'anime.min.js'));
});

app.post('/auth/register', async (req, res) => {
  const username = typeof req.body.username === 'string'
    ? req.body.username.trim().toLowerCase()
    : '';
  const email = typeof req.body.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    res.status(400).json({
      message: 'Username must be 3–32 characters using letters, numbers, or underscores.'
    });
    return;
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'Enter a valid email address.' });
    return;
  }
  if (password.length < 10 || password.length > 128) {
    res.status(400).json({ message: 'Password must be between 10 and 128 characters.' });
    return;
  }

  try {
    const salt = crypto.randomBytes(16);
    const derivedKey = await scrypt(password, salt, 64);
    const passwordHash = `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
    db.query(
      'INSERT INTO app_users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash],
      err => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ message: 'That username or email is already registered.' });
            return;
          }
          console.error('Could not register account:', err.message);
          res.status(500).json({ message: 'Could not create the account.' });
          return;
        }
        res.status(201).json({ message: 'Account created. You can now log in.' });
      }
    );
  } catch (error) {
    console.error('Could not secure new account password:', error.message);
    res.status(500).json({ message: 'Could not create the account.' });
  }
});

app.post('/auth/link-email', (req, res) => {
  const username = typeof req.body.username === 'string'
    ? req.body.username.trim().toLowerCase()
    : '';
  const email = typeof req.body.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    res.status(400).json({ message: 'Enter your account username.' });
    return;
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ message: 'Enter a valid email address.' });
    return;
  }
  if (!password || password.length > 128) {
    res.status(401).json({ message: 'Invalid username or password.' });
    return;
  }

  db.query(
    'SELECT user_id, password_hash FROM app_users WHERE username = ?',
    [username],
    async (err, users) => {
      if (err) {
        console.error('Could not look up account for email linking:', err.message);
        res.status(500).json({ message: 'Could not link the email address.' });
        return;
      }
      if (users.length !== 1) {
        res.status(401).json({ message: 'Invalid username or password.' });
        return;
      }

      try {
        const passwordMatches = await verifyPassword(password, users[0].password_hash);
        if (!passwordMatches) {
          res.status(401).json({ message: 'Invalid username or password.' });
          return;
        }

        db.query(
          'UPDATE app_users SET email = ? WHERE user_id = ?',
          [email, users[0].user_id],
          updateError => {
            if (updateError) {
              if (updateError.code === 'ER_DUP_ENTRY') {
                res.status(409).json({ message: 'That email address is already linked to an account.' });
                return;
              }
              console.error('Could not save account email:', updateError.message);
              res.status(500).json({ message: 'Could not link the email address.' });
              return;
            }
            res.json({ message: 'Email linked. You can now log in with this email address.' });
          }
        );
      } catch (error) {
        console.error('Could not verify account password for email linking:', error.message);
        res.status(500).json({ message: 'Could not link the email address.' });
      }
    }
  );
});

app.post('/auth/login', (req, res) => {
  const identifierValue = typeof req.body.identifier === 'string'
    ? req.body.identifier
    : req.body.username;
  const identifier = typeof identifierValue === 'string'
    ? identifierValue.trim().toLowerCase()
    : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!identifier || !password || password.length > 128) {
    res.status(401).json({ message: 'Invalid username or password.' });
    return;
  }

  const invalidCredentialsMessage = identifier.includes('@')
    ? 'Invalid username or password. If this is an older account, link the email address to your account first.'
    : 'Invalid username or password.';

  db.query(
    'SELECT password_hash FROM app_users WHERE username = ? OR LOWER(email) = ?',
    [identifier, identifier],
    async (err, users) => {
      if (err) {
        console.error('Could not look up account:', err.message);
        res.status(500).json({ message: 'Could not log in.' });
        return;
      }
      if (users.length !== 1) {
        res.status(401).json({ message: invalidCredentialsMessage });
        return;
      }

      try {
        const passwordMatches = await verifyPassword(password, users[0].password_hash);
        if (!passwordMatches) {
          res.status(401).json({ message: invalidCredentialsMessage });
          return;
        }
        res.json({ message: 'Login successful.' });
      } catch (error) {
        console.error('Could not verify account password:', error.message);
        res.status(500).json({ message: 'Could not log in.' });
      }
    }
  );
});

app.use('/auth', (req, res) => {
  res.status(404).json({ message: 'Authentication endpoint not found.' });
});

app.get('/courses', (req, res) => {
  const sql = `
    SELECT c.course_id, c.course_name, d.department_name
    FROM courses c
    JOIN department d ON d.department_id = c.department_id
    LEFT JOIN instructor i ON i.instructor_id = c.instructor_id
    WHERE c.instructor_id IS NULL OR i.department_id = c.department_id
    ORDER BY d.department_name, c.course_name
  `;

  db.query(sql, (err, courses) => {
    if (err) {
      console.error('Could not load courses:', err.message);
      res.status(500).send('Could not load courses.');
      return;
    }
    res.json(courses);
  });
});

app.post('/submit', (req, res) => {
  const studentId = Number(req.body.student_id);
  const courseId = Number(req.body.course_id);
  const studentName = typeof req.body.student_name === 'string' ? req.body.student_name.trim() : '';
  const year = Number(req.body.year);
  const age = Number(req.body.age);
  const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
  const currentYear = new Date().getFullYear();

  if (!Number.isInteger(studentId) || studentId <= 0 ||
      !Number.isInteger(courseId) || courseId <= 0 ||
      !studentName || studentName.length > 255 ||
      !Number.isInteger(year) || year <= 0 || year > currentYear ||
      !Number.isInteger(age) || age <= 0 || age > 120 ||
      !address || address.length > 255) {
    res.status(400).send('Enter valid student details and select a course.');
    return;
  }

  const courseSql = `
    SELECT c.course_id
    FROM courses c
    JOIN department d ON d.department_id = c.department_id
    LEFT JOIN instructor i ON i.instructor_id = c.instructor_id
    WHERE c.course_id = ?
      AND (c.instructor_id IS NULL OR i.department_id = c.department_id)
  `;
  db.query(courseSql, [courseId], (courseError, courses) => {
    if (courseError) {
      console.error('Could not validate selected course:', courseError.message);
      res.status(500).send('Could not validate the selected course.');
      return;
    }
    if (courses.length === 0) {
      res.status(400).send('The selected course is unavailable or has mismatched department data. Choose another course.');
      return;
    }

    const sql = 'INSERT INTO student (student_id, course_id, student_name, year,age,address) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [studentId, courseId, studentName, year, age, address];

    db.query(sql, values, (err, result) => {
      if (err) {
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
          res.status(400).send(`Course ID ${courseId} does not exist. Run npm run db:setup and try again.`);
          return;
        }
        if (err.code === 'ER_DUP_ENTRY') {
          res.status(409).send('This student is already enrolled in the selected course.');
          return;
        }
        console.error('Error inserting student into MySQL database:', err.message);
        res.status(500).send('Error inserting student data into the database.');
        return;
      }
      console.log('Data inserted into MySQL database with ID ' + result.insertId);
      res.send('Student data inserted successfully');
    });
  });
});

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Student service cannot start: port ${port} is already in use. Stop the existing app or set PORT to a free port.`);
  } else {
    console.error('Student service failed to start:', error.message);
  }
  process.exit(1);
});
