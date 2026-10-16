CREATE TABLE IF NOT EXISTS department (
  department_id INT PRIMARY KEY,
  department_name VARCHAR(255)
);

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
