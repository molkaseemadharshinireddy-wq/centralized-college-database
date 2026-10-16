CREATE TABLE IF NOT EXISTS department (
  department_id INT PRIMARY KEY,
  department_name VARCHAR(255)
);

INSERT IGNORE INTO department (department_id, department_name) VALUES
  (1, 'Computer Science'),
  (2, 'Electrical Engineering'),
  (3, 'Math'),
  (4, 'English'),
  (5, 'History');

CREATE TABLE IF NOT EXISTS instructor (
  instructor_id INT PRIMARY KEY,
  instructor_name VARCHAR(255),
  department_id INT,
  FOREIGN KEY (department_id) REFERENCES department(department_id)
);

CREATE TABLE IF NOT EXISTS courses (
  course_id INT PRIMARY KEY,
  course_name VARCHAR(255),
  department_id INT,
  instructor_id INT,
  course_duration varchar(255),
  FOREIGN KEY (department_id) REFERENCES department(department_id),
  FOREIGN KEY (instructor_id) REFERENCES instructor(instructor_id)
);

INSERT IGNORE INTO courses
  (course_id, course_name, department_id, instructor_id, course_duration)
VALUES
  (1, 'Introduction to Computer Science', 1, NULL, '6 months'),
  (2, 'Digital Logic Design', 1, NULL, '6 months'),
  (3, 'Calculus I', 3, NULL, '6 months'),
  (4, 'Introduction to Literature', 4, NULL, '6 months'),
  (5, 'US History I', 5, NULL, '6 months'),
  (6, 'Data Structures and Algorithms', 1, NULL, '6 months'),
  (7, 'Power Systems', 2, NULL, '6 months'),
  (8, 'Linear Algebra', 3, NULL, '6 months'),
  (9, 'Shakespearean Literature', 4, NULL, '6 months'),
  (10, 'World History I', 5, NULL, '6 months'),
  (11, 'Computer Networks', 1, NULL, '6 months'),
  (12, 'Electronics I', 2, NULL, '6 months'),
  (13, 'Calculus II', 3, NULL, '6 months'),
  (14, 'Modern American Literature', 4, NULL, '6 months'),
  (15, 'US History II', 5, NULL, '6 months'),
  (16, 'Database Systems', 1, NULL, '6 months'),
  (17, 'Power Electronics', 2, NULL, '6 months'),
  (18, 'Multivariable Calculus', 3, NULL, '6 months'),
  (19, 'British Literature', 4, NULL, '6 months'),
  (20, 'World History II', 5, NULL, '6 months');

CREATE TABLE IF NOT EXISTS student (
  student_id INT,
  course_id INT,
  PRIMARY KEY (student_id, course_id),
  student_name VARCHAR(255),
  year INT,
  age INT,
  address VARCHAR(255),
  FOREIGN KEY (course_id) REFERENCES courses(course_id)
);
