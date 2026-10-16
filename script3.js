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

// Route for handling form submissions
app.post('/', (req, res) => {
  const { instructor_id, instructor_name, department_id, action } = req.body;

  if (action === 'add') {
    // Insert new instructor into the database
    const sql = `INSERT INTO instructor (instructor_id, instructor_name, department_id) 
                 VALUES (${instructor_id}, '${instructor_name}', ${department_id})`;
    connection.query(sql, (err, result) => {
      if (err) throw err;
      console.log('New instructor added to the database');
      res.redirect('/');
    });
  } else if (action === 'delete') {
    // Check if there are at least 2 instructors in the database
    const sql = 'SELECT COUNT(*) as num_instructors FROM instructor';
    connection.query(sql, (err, result) => {
      if (err) throw err;
      const { num_instructors } = result[0];

      if (num_instructors < 2) {
        // Cannot delete instructor if there are fewer than 2 instructors in the database
        console.log('Cannot delete instructor');
        res.send('Cannot delete instructor');
      } else {
        // Delete instructor from the database
        const sql = `DELETE FROM instructor WHERE instructor_id = ${instructor_id}`;
        connection.query(sql, (err, result) => {
          if (err) throw err;
          console.log(`Instructor ${instructor_id} deleted from the database`);
          res.redirect('/');
        });
      }
    });
  }
});

// Start the server
const port = Number(process.env.INSTRUCTOR_PORT) || 5000;
app.listen(port, () => {
  console.log(`Instructor server started on port ${port}`);
});
