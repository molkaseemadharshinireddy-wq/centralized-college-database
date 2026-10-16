const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Manshisahu12',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'CCD'
};

const db = mysql.createConnection(dbConfig);

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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
