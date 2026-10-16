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

app.post('/submit', (req, res) => {
  const studentId = Number(req.body.student_id);
  const courseId = Number(req.body.course_id);
  const studentName = typeof req.body.student_name === 'string' ? req.body.student_name.trim() : '';
  const year = Number(req.body.year);
  const age = Number(req.body.age);
  const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';

  if (!Number.isInteger(studentId) || studentId <= 0 ||
      !Number.isInteger(courseId) || courseId <= 0 ||
      !studentName || !Number.isInteger(year) ||
      !Number.isInteger(age) || age <= 0 || !address) {
    res.status(400).send('Enter valid student details and select a course.');
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
      console.error('Error inserting student into MySQL database:', err.message);
      res.status(500).send('Error inserting student data into the database.');
      return;
    }
    console.log('Data inserted into MySQL database with ID ' + result.insertId);
    res.send('Student data inserted successfully');
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
