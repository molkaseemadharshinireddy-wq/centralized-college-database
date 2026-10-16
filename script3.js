const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '#',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'CCD'
};

// Set up MySQL connection
const connection = mysql.createConnection(dbConfig);

// Connect to MySQL
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL');
});

// Set up express middleware
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'instructor.html'));
  });

app.get('/departments', (req, res) => {
  connection.query(
    'SELECT department_id, department_name FROM department ORDER BY department_name',
    (err, departments) => {
      if (err) {
        console.error('Could not load departments:', err.message);
        res.status(500).send('Could not load departments.');
        return;
      }
      res.json(departments);
    }
  );
});

// Route for handling form submissions
app.post('/', (req, res) => {
  const { instructor_id, instructor_name, department_id, action } = req.body;

  if (action === 'add') {
    const instructorId = Number(instructor_id);
    const departmentId = Number(department_id);
    const instructorName = typeof instructor_name === 'string' ? instructor_name.trim() : '';

    if (!Number.isInteger(instructorId) || instructorId <= 0 ||
        !Number.isInteger(departmentId) || departmentId <= 0 ||
        !instructorName || instructorName.length > 255) {
      res.status(400).send('Enter a valid instructor ID, instructor name, and department ID.');
      return;
    }

    const sql = 'INSERT INTO instructor (instructor_id, instructor_name, department_id) VALUES (?, ?, ?)';
    connection.query(sql, [instructorId, instructorName, departmentId], (err) => {
      if (err) {
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
          res.status(400).send(`Department ID ${departmentId} does not exist.`);
          return;
        }
        if (err.code === 'ER_DUP_ENTRY') {
          res.status(409).send(`Instructor ID ${instructorId} already exists.`);
          return;
        }
        console.error('Could not add instructor:', err.message);
        res.status(500).send('Could not add instructor.');
        return;
      }
      console.log('New instructor added to the database');
      res.send('Instructor added successfully.');
    });
  } else if (action === 'delete') {
    const instructorId = Number(instructor_id);
    if (!Number.isInteger(instructorId) || instructorId <= 0) {
      res.status(400).send('Enter a valid instructor ID to delete.');
      return;
    }

    // Check if there are at least 2 instructors in the database
    const sql = 'SELECT COUNT(*) as num_instructors FROM instructor';
    connection.query(sql, (err, result) => {
      if (err) {
        console.error('Could not check instructor count:', err.message);
        res.status(500).send('Could not delete instructor.');
        return;
      }
      const { num_instructors } = result[0];

      if (num_instructors < 2) {
        // Cannot delete instructor if there are fewer than 2 instructors in the database
        console.log('Cannot delete instructor');
        res.send('Cannot delete instructor');
      } else {
        // Delete instructor from the database
        const sql = 'DELETE FROM instructor WHERE instructor_id = ?';
        connection.query(sql, [instructorId], (err) => {
          if (err) {
            console.error('Could not delete instructor:', err.message);
            res.status(500).send('Could not delete instructor.');
            return;
          }
          console.log(`Instructor ${instructorId} deleted from the database`);
          res.send('Instructor deleted successfully.');
        });
      }
    });
  } else {
    res.status(400).send('Choose whether to add or delete an instructor.');
  }
});

// Start the server
const port = Number(process.env.INSTRUCTOR_PORT) || 5000;
app.listen(port, () => {
  console.log(`Instructor server started on port ${port}`);
});
