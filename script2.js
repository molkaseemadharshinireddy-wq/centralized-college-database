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

// Create a connection to the MySQL database
const connection = mysql.createConnection(dbConfig);

app.get('/__health/search', (req, res) => {
    res.json({ service: 'search' });
});

// Connect to the database
connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'searchFilter.html'));
});

app.get('/portal.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'portal.css'));
});

app.use(express.static('DBMS PROJECT'));

app.get('/filters', async (req, res) => {
    try {
        const database = connection.promise();
        const [departments] = await database.query(
            'SELECT department_id AS id, department_name AS name FROM department ORDER BY department_name'
        );
        const [instructors] = await database.query(
            'SELECT instructor_id AS id, instructor_name AS name FROM instructor ORDER BY instructor_name, instructor_id'
        );
        const [courses] = await database.query(
            'SELECT c.course_id AS id, c.course_name AS name, d.department_name AS department ' +
            'FROM courses c JOIN department d ON d.department_id = c.department_id ' +
            'ORDER BY c.course_name, c.course_id'
        );
        const [students] = await database.query(
            'SELECT DISTINCT student_id AS id, student_name AS name FROM student ' +
            'ORDER BY student_name, student_id'
        );
        const [years] = await database.query(
            'SELECT DISTINCT year FROM student WHERE year IS NOT NULL ORDER BY year DESC'
        );
        res.json({ departments, instructors, courses, students, years: years.map(row => row.year) });
    } catch (err) {
        console.error('Could not load search filters:', err.message);
        res.status(500).json({ message: 'Could not load search options. Please try again.' });
    }
});

app.get('/search', (req, res) => {
    const filters = {
        department_id: 'd.department_id',
        instructor_id: 'i.instructor_id',
        course_id: 'c.course_id',
        student_id: 's.student_id',
        year: 's.year'
    };
    const conditions = [];
    const values = [];
    for (const [name, column] of Object.entries(filters)) {
        const value = req.query[name];
        if (typeof value === 'string' && value !== '') {
            if (!/^\d+$/.test(value)) {
                res.status(400).json({ message: `Invalid ${name.replace('_', ' ')} filter.` });
                return;
            }
            conditions.push(`${column} = ?`);
            values.push(Number(value));
        }
    }

    const sql = 'SELECT s.student_id, s.student_name, s.year, s.age, s.address, ' +
        'c.course_id, c.course_name, c.course_duration, ' +
        'i.instructor_id, i.instructor_name, ' +
        'd.department_id, d.department_name ' +
        'FROM student s ' +
        'JOIN courses c ON s.course_id = c.course_id ' +
        'JOIN instructor i ON c.instructor_id = i.instructor_id ' +
        'JOIN department d ON c.department_id = d.department_id ' +
        (conditions.length ? `WHERE ${conditions.join(' AND ')}` : '') +
        ' ORDER BY s.student_name, c.course_name';

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Could not search college records:', err.message);
            res.status(500).json({ message: 'Could not search records. Please try again.' });
            return;
        }
        res.json(result);
    });
});

// Start the server
const port = Number(process.env.SEARCH_PORT) || 4000;
const server = app.listen(port, () => {
    console.log(`Search server started on port ${port}`);
});
server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Search service cannot start: port ${port} is already in use. Stop the existing app or set SEARCH_PORT to a free port.`);
    } else {
        console.error('Search service failed to start:', error.message);
    }
    process.exit(1);
});
